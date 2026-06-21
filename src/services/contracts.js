import {
  TransactionBuilder,
  Contract,
  BASE_FEE,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk'
import {
  signTransaction,
  getAddress,
} from '@stellar/freighter-api'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
const INITIAL_POLL_INTERVAL_MS = 1500
const MAX_TX_POLL_ATTEMPTS = 40
const MAX_SUBMIT_RETRIES = 3
const TX_TIMEOUT_SECONDS = 180
const DEFAULT_NFT_APPROVAL_LEDGER_BUFFER = 518400

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Progressive backoff: starts at 1.5s, moves to 3s after 15 attempts, then 5s after 30.
 * Total wait time: ~15×1.5 + 15×3 + 10×5 = 22.5 + 45 + 50 = ~117s (~2 min)
 */
const getPollInterval = (attempt) => {
  if (attempt < 15) return INITIAL_POLL_INTERVAL_MS
  if (attempt < 30) return 3000
  return 5000
}

/**
 * Fetch dynamic fee from the network. Uses 2× the 80th-percentile fee
 * to stay competitive during congestion. Falls back to 10× BASE_FEE.
 */
const getDynamicFee = async () => {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'fee-stats',
        method: 'getFeeStats',
        params: {},
      }),
    })
    const payload = await response.json()
    if (payload.result) {
      // sorobanInclusionFee contains the actual Soroban fee market stats
      const stats = payload.result.sorobanInclusionFee || payload.result.inclusionFee
      if (stats) {
        const p80Fee = parseInt(stats.p80 || stats.p90 || '100', 10)
        const dynamicFee = Math.max(p80Fee * 2, parseInt(BASE_FEE, 10) * 10).toString()
        console.log(`[Soroban] Dynamic fee: ${dynamicFee} stroops (p80=${stats.p80}, p90=${stats.p90})`)
        return dynamicFee
      }
    }
  } catch (err) {
    console.warn('[Soroban] Could not fetch fee stats, using fallback:', err.message)
  }
  // Fallback: 10× base fee (1000 stroops)
  const fallbackFee = (parseInt(BASE_FEE, 10) * 10).toString()
  console.log(`[Soroban] Using fallback fee: ${fallbackFee} stroops`)
  return fallbackFee
}

const parseRequiredU32 = (value, label) => {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative integer`)
  }
  return parsed
}

const scValToNative = (value) => {
  if (!value) return null

  switch (value.switch().name) {
    case 'scvU32':
      return value.u32()
    case 'scvI32':
      return value.i32()
    case 'scvU64':
      return Number(value.u64())
    case 'scvI64':
      return Number(value.i64())
    case 'scvU128': {
      const parts = value.u128()
      return BigInt(parts.hi()) << 64n | BigInt(parts.lo())
    }
    case 'scvI128': {
      const parts = value.i128()
      return BigInt(parts.hi()) << 64n | BigInt(parts.lo())
    }
    case 'scvString':
      return new TextDecoder().decode(value.bytes())
    case 'scvSymbol':
      return value.sym().toString()
    case 'scvBool':
      return value.b()
    case 'scvVoid':
      return null
    default:
      return value
  }
}

const decodeScValFromBase64 = (encoded) => {
  if (!encoded) return null
  return scValToNative(xdr.ScVal.fromXDR(encoded, 'base64'))
}

const extractFnReturnFromDiagnostics = (diagnosticEventsXdr = [], methodName) => {
  for (const encoded of diagnosticEventsXdr) {
    const diagnosticEvent = xdr.DiagnosticEvent.fromXDR(encoded, 'base64')
    const body = diagnosticEvent.event().body().v0()
    const topics = body.topics().map(scValToNative)

    if (topics[0] === 'fn_return' && topics[1] === methodName) {
      return scValToNative(body.data())
    }
  }

  return null
}

const getRawSorobanTransaction = async (hash) => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: hash,
      method: 'getTransaction',
      params: { hash },
    }),
  })

  const payload = await response.json()
  if (payload.error) {
    throw new Error(payload.error.message || `Raw RPC getTransaction failed for ${hash}`)
  }

  return payload.result
}

const waitForSorobanTransaction = async (server, hash, methodName, fallbackReturnValue = null) => {
  console.log(`[Soroban] Polling for tx ${hash} (up to ${MAX_TX_POLL_ATTEMPTS} attempts with backoff)`)

  for (let attempt = 0; attempt < MAX_TX_POLL_ATTEMPTS; attempt += 1) {
    const interval = getPollInterval(attempt)

    try {
      const response = await server.getTransaction(hash)

      if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        console.log(`[Soroban] tx ${hash} confirmed after ${attempt + 1} attempts`)
        return {
          hash,
          returnValue: scValToNative(response.returnValue ?? fallbackReturnValue),
          rawReturnValue: response.returnValue ?? fallbackReturnValue,
        }
      }

      if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed on-chain for hash ${hash}`)
      }

      // NOT_FOUND — transaction still pending, continue polling
      if (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        if (attempt % 5 === 0) {
          console.log(`[Soroban] tx ${hash} not yet found (attempt ${attempt + 1}/${MAX_TX_POLL_ATTEMPTS}, next poll in ${interval}ms)`)
        }
      }
    } catch (error) {
      // Only fall back to raw RPC for decode errors, not for explicit failures re-thrown above
      if (error.message?.includes('failed on-chain')) {
        throw error
      }

      console.warn(`[Soroban] SDK getTransaction error (attempt ${attempt + 1}), trying raw RPC:`, error.message)

      try {
        const rawResponse = await getRawSorobanTransaction(hash)

        if (rawResponse.status === 'SUCCESS') {
          console.log(`[Soroban] tx ${hash} confirmed via raw RPC after ${attempt + 1} attempts`)
          const returnValue =
            decodeScValFromBase64(rawResponse.returnValue) ??
            extractFnReturnFromDiagnostics(rawResponse.diagnosticEventsXdr || [], methodName) ??
            scValToNative(fallbackReturnValue)

          return {
            hash,
            returnValue,
            rawReturnValue: rawResponse.returnValue ?? null,
          }
        }

        if (rawResponse.status === 'FAILED') {
          throw new Error(`Transaction failed on-chain for hash ${hash}`)
        }

        // NOT_FOUND from raw RPC — still pending
        if (rawResponse.status === 'NOT_FOUND' && attempt % 5 === 0) {
          console.log(`[Soroban] raw RPC: tx ${hash} not found yet (attempt ${attempt + 1}/${MAX_TX_POLL_ATTEMPTS})`)
        }
      } catch (rawError) {
        if (rawError.message?.includes('failed on-chain')) {
          throw rawError
        }
        console.warn(`[Soroban] raw RPC also failed (attempt ${attempt + 1}):`, rawError.message)
      }
    }

    await sleep(interval)
  }

  throw new Error(
    `Timed out waiting for Soroban transaction ${hash} after ${MAX_TX_POLL_ATTEMPTS} attempts (~2 min). ` +
    `The transaction may still be processing — check https://stellar.expert/explorer/testnet/tx/${hash}`
  )
}

const readSoroban = async (contractId, method, args = []) => {
  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)
  const account = await server.getAccount(address)
  const contract = new Contract(contractId)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const simulation = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`)
  }

  return scValToNative(simulation.result?.retval ?? null)
}

/**
 * Get contract IDs from environment variables
 */
export const getContractAddresses = () => {
  return {
    PropertyRegistry: import.meta.env.VITE_PROPERTY_REGISTRY_ADDRESS,
    PropertyNFT: import.meta.env.VITE_PROPERTY_NFT_ADDRESS,
    PropertyToken: import.meta.env.VITE_PROPERTY_TOKEN_ADDRESS,
    Escrow: import.meta.env.VITE_ESCROW_ADDRESS,
    PropertyOffers: import.meta.env.VITE_PROPERTY_OFFERS_ADDRESS,
    XLM_ASSET: 'native',
  }
}

/**
 * Helper to invoke a Soroban contract method with resilient submission.
 * - Uses dynamic fee based on current network congestion
 * - Transaction envelope valid for 180s (vs 30s default)
 * - Retries the full build→sign→submit cycle up to 3 times on tx-not-found
 * Designed for @stellar/freighter-api v3.1.0
 */
const invokeSoroban = async (contractId, method, args = []) => {
  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)
  const contract = new Contract(contractId)

  // Fetch dynamic fee once (shared across retries)
  const fee = await getDynamicFee()

  let lastError = null

  for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[Soroban] Retry attempt ${attempt}/${MAX_SUBMIT_RETRIES} for ${method}`)
        // Brief pause before retry to let the network settle
        await sleep(2000)
      }

      // Re-fetch account on each attempt to get a fresh sequence number
      const account = await server.getAccount(address)

      // 1. Build initial transaction with dynamic fee and longer timeout
      const txInitial = new TransactionBuilder(account, {
        fee,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build()

      // 2. Simulate transaction to get footprint and resource usage
      const simulation = await server.simulateTransaction(txInitial)
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Simulation failed: ${simulation.error}`)
      }
      const simulatedReturnValue = simulation.result?.retval ?? null

      // 3. Prepare transaction with simulation results (injects resource fees)
      const tx = await server.prepareTransaction(txInitial)

      // 4. Sign transaction via Freighter
      const xdrString = tx.toXDR()
      console.log(`[Soroban] Sending to Freighter for signing (attempt ${attempt}, fee=${fee}, timeout=${TX_TIMEOUT_SECONDS}s):`, xdrString.slice(0, 80) + '...')

      const response = await signTransaction(xdrString, {
        networkPassphrase: NETWORK_PASSPHRASE,
      })

      console.log('[Soroban] Freighter response:', response)

      // Check for Freighter-level errors (e.g. user rejected, network mismatch)
      if (response.error) {
        throw new Error(`Freighter error: ${JSON.stringify(response.error)}`)
      }

      const signedXdr = response.signedTxXdr
      if (!signedXdr) {
        throw new Error('Freighter returned empty signedTxXdr. User may have rejected the request.')
      }

      // 5. Submit signed transaction
      const txToSubmit = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
      const result = await server.sendTransaction(txToSubmit)
      console.log(`[Soroban] Transaction submitted (attempt ${attempt}):`, result.hash, result.status)

      if (result.status === 'ERROR') {
        // Submission-level error — may be recoverable with a fresh sequence number
        const errorMsg = result.errorResult
          ? `Submission error: ${JSON.stringify(result.errorResult)}`
          : `Soroban transaction submission failed for ${method}`
        console.warn(`[Soroban] ${errorMsg}`)
        lastError = new Error(errorMsg)
        continue // retry
      }

      // 6. Poll for confirmation
      const finalResult = await waitForSorobanTransaction(server, result.hash, method, simulatedReturnValue)
      return finalResult
    } catch (err) {
      lastError = err

      // Don't retry if the user rejected or there's a simulation failure
      const noRetryPatterns = [
        'Freighter error',
        'Freighter returned empty',
        'User may have rejected',
        'Simulation failed',
        'failed on-chain',
      ]
      if (noRetryPatterns.some(p => err.message?.includes(p))) {
        throw err
      }

      // Timed-out or NOT_FOUND — worth retrying with fresh sequence
      console.warn(`[Soroban] Attempt ${attempt}/${MAX_SUBMIT_RETRIES} failed for ${method}:`, err.message)

      if (attempt === MAX_SUBMIT_RETRIES) {
        break
      }
    }
  }

  throw lastError || new Error(`All ${MAX_SUBMIT_RETRIES} attempts failed for ${method}`)
}

/**
 * Invoke multiple Soroban contract calls in a single transaction (one Freighter signature).
 *
 * Stellar supports multiple InvokeHostFunction operations per transaction. We build them
 * all into one envelope, simulate the whole thing together so the RPC can compute a
 * unified footprint and resource budget, then prepareTransaction injects the auth entries
 * for every operation at once.  The user signs exactly once.
 *
 * @param {Array<{contractId: string, method: string, args: any[]}>} calls
 * @returns {Promise<{ hash: string, returnValues: any[] }>}
 */
const _invokeSorobanBatch = async (calls) => {
  if (!calls || calls.length === 0) {
    throw new Error('invokeSorobanBatch requires at least one call')
  }

  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)
  const fee = await getDynamicFee()

  let lastError = null

  for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[Soroban:batch] Retry attempt ${attempt}/${MAX_SUBMIT_RETRIES}`)
        await sleep(2000)
      }

      // Re-fetch account on each attempt to get a fresh sequence number
      const account = await server.getAccount(address)

      // 1. Build a single transaction with all operations
      const builder = new TransactionBuilder(account, {
        fee,
        networkPassphrase: NETWORK_PASSPHRASE,
      }).setTimeout(TX_TIMEOUT_SECONDS)

      for (const { contractId, method, args = [] } of calls) {
        const contract = new Contract(contractId)
        builder.addOperation(contract.call(method, ...args))
      }

      const txInitial = builder.build()

      // 2. Simulate the combined transaction — RPC handles all ops together
      const simulation = await server.simulateTransaction(txInitial)
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Batch simulation failed: ${simulation.error}`)
      }

      // 3. Prepare transaction — injects auth + resource fees for all operations
      const tx = await server.prepareTransaction(txInitial)

      // 4. Sign once via Freighter
      const xdrString = tx.toXDR()
      const methodLabels = calls.map(c => c.method).join(' + ')
      console.log(
        `[Soroban:batch] Sending ${calls.length} ops to Freighter (attempt ${attempt}, fee=${fee}): ${methodLabels}`
      )

      const response = await signTransaction(xdrString, {
        networkPassphrase: NETWORK_PASSPHRASE,
      })

      console.log('[Soroban:batch] Freighter response:', response)

      if (response.error) {
        throw new Error(`Freighter error: ${JSON.stringify(response.error)}`)
      }

      const signedXdr = response.signedTxXdr
      if (!signedXdr) {
        throw new Error('Freighter returned empty signedTxXdr. User may have rejected the request.')
      }

      // 5. Submit signed transaction
      const txToSubmit = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
      const result = await server.sendTransaction(txToSubmit)
      console.log(`[Soroban:batch] Transaction submitted (attempt ${attempt}):`, result.hash, result.status)

      if (result.status === 'ERROR') {
        const errorMsg = result.errorResult
          ? `Submission error: ${JSON.stringify(result.errorResult)}`
          : `Soroban batch transaction submission failed`
        console.warn(`[Soroban:batch] ${errorMsg}`)
        lastError = new Error(errorMsg)
        continue
      }

      // 6. Poll for confirmation (use the first method name for diagnostic event lookup)
      const finalResult = await waitForSorobanTransaction(server, result.hash, calls[0].method, null)
      return {
        hash: finalResult.hash,
        returnValues: [finalResult.returnValue],
      }
    } catch (err) {
      lastError = err

      const noRetryPatterns = [
        'Freighter error',
        'Freighter returned empty',
        'User may have rejected',
        'Batch simulation failed',
        'failed on-chain',
      ]
      if (noRetryPatterns.some(p => err.message?.includes(p))) {
        throw err
      }

      console.warn(`[Soroban:batch] Attempt ${attempt}/${MAX_SUBMIT_RETRIES} failed:`, err.message)

      if (attempt === MAX_SUBMIT_RETRIES) {
        break
      }
    }
  }

  throw lastError || new Error(`All ${MAX_SUBMIT_RETRIES} batch attempts failed`)
}

// --- PropertyRegistry Service ---

export const registerPropertyOnChain = async (title, location, price) => {
  const { PropertyRegistry } = getContractAddresses()
  const { address } = await getAddress()

  // Soroban args: owner (Address), title (String), location (String), price (u128)
  const result = await invokeSoroban(PropertyRegistry, 'register_property', [
    nativeToScVal(address, { type: 'address' }),
    nativeToScVal(title, { type: 'string' }),
    nativeToScVal(location, { type: 'string' }),
    nativeToScVal(BigInt(price), { type: 'u128' }),
  ])

  const propertyId = result.returnValue
  if (typeof propertyId !== 'number') {
    throw new Error('Soroban register_property did not return a valid property ID')
  }

  return { txHash: result.hash, propertyId: propertyId.toString() }
}

export const transferPropertyOwnership = async (propertyId, newOwner) => {
  const { PropertyRegistry } = getContractAddresses()
  const safePropertyId = parseRequiredU32(propertyId, 'Property ID')

  return await invokeSoroban(PropertyRegistry, 'transfer_ownership', [
    nativeToScVal(safePropertyId, { type: 'u32' }),
    nativeToScVal(newOwner, { type: 'address' }),
  ])
}

export const listPropertyForSale = async (propertyId, price) => {
  const { PropertyRegistry } = getContractAddresses()
  const safePropertyId = parseRequiredU32(propertyId, 'Property ID')

  return await invokeSoroban(PropertyRegistry, 'list_for_sale', [
    nativeToScVal(safePropertyId, { type: 'u32' }),
    nativeToScVal(BigInt(price), { type: 'u128' }),
  ])
}

// --- Escrow Service ---

export const createEscrowXLM = async (propertyId, seller, amount, deadline) => {
  const { Escrow } = getContractAddresses()
  const { address } = await getAddress()
  
  // Native XLM Contract Address on Stellar Testnet
  const XLM_TESTNET_TOKEN =
    import.meta.env.VITE_XLM_TOKEN_ADDRESS ||
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

  const safePropertyId = parseRequiredU32(propertyId, 'Property ID')

  // Convert amount to stroops for XLM (1 XLM = 10,000,000 stroops). 
  // We assume the amount provided from UI is already in decimal XLM form.
  const stroops = Math.floor(parseFloat(amount) * 10000000);
  
  // Soroban args: buyer (Address), property_id (u32), seller (Address), token (Address), amount (u128), deadline (u64)
  // Even though Native XLM uses i128 internally, the create_escrow method signature expects u128
  const result = await invokeSoroban(Escrow, 'create_escrow', [
    nativeToScVal(address, { type: 'address' }),
    nativeToScVal(safePropertyId, { type: 'u32' }),
    nativeToScVal(seller, { type: 'address' }),
    nativeToScVal(XLM_TESTNET_TOKEN, { type: 'address' }),
    nativeToScVal(BigInt(stroops), { type: 'u128' }),
    nativeToScVal(parseInt(deadline), { type: 'u64' }),
  ])

  const escrowId = result.returnValue
  if (typeof escrowId !== 'number') {
    throw new Error('Soroban create_escrow did not return a valid escrow ID')
  }

  return {
    hash: result.hash,
    escrowId,
  }
}

export const completeEscrowOnChain = async (transactionId) => {
  const { Escrow } = getContractAddresses()
  const { address } = await getAddress()

  const safeTxId = parseRequiredU32(transactionId, 'Escrow transaction ID')

  return await invokeSoroban(Escrow, 'complete_escrow', [
    nativeToScVal(safeTxId, { type: 'u32' }),
    nativeToScVal(address, { type: 'address' }),
  ])
}

export const cancelEscrowOnChain = async (transactionId) => {
  const { Escrow } = getContractAddresses()
  const { address } = await getAddress()

  const safeTxId = parseRequiredU32(transactionId, 'Escrow transaction ID')

  return await invokeSoroban(Escrow, 'cancel_escrow', [
    nativeToScVal(safeTxId, { type: 'u32' }),
    nativeToScVal(address, { type: 'address' }),
  ])
}

/**
 * Approve the Escrow contract to transfer a specific property on the PropertyRegistry.
 * Must be called by the property OWNER (seller) — requires their Freighter signature.
 * This resolves the cross-contract Auth.InvalidAction error when complete_escrow calls transfer_ownership.
 */
export const approveEscrowForProperty = async (propertyId) => {
  const { PropertyRegistry, Escrow } = getContractAddresses()
  const safePropertyId = parseRequiredU32(propertyId, 'Property ID')

  return await invokeSoroban(PropertyRegistry, 'approve', [
    nativeToScVal(safePropertyId, { type: 'u32' }),
    nativeToScVal(Escrow, { type: 'address' }),
  ])
}

export const approvePropertyNFTTransfer = async (tokenId, approvedAddress, liveUntilLedger = null) => {
  const { PropertyNFT } = getContractAddresses()
  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)

  const parsedTokenId = parseRequiredU32(tokenId, 'NFT token ID')

  let ledgerExpiry = liveUntilLedger
  if (!ledgerExpiry) {
    const latestLedger = await server.getLatestLedger()
    ledgerExpiry = latestLedger.sequence + DEFAULT_NFT_APPROVAL_LEDGER_BUFFER
  }

  return await invokeSoroban(PropertyNFT, 'approve', [
    nativeToScVal(address, { type: 'address' }),
    nativeToScVal(approvedAddress, { type: 'address' }),
    nativeToScVal(parsedTokenId, { type: 'u32' }),
    nativeToScVal(ledgerExpiry, { type: 'u32' }),
  ])
}

/**
 * Sequential: Approve escrow for property transfer AND approve NFT deed transfer.
 *
 * Soroban only allows ONE InvokeHostFunction operation per transaction, so these
 * must be two separate Freighter signing popups. The onProgress callback lets the
 * UI update its step indicator between the two signatures.
 *
 * @param {string|number} propertyId       - On-chain property ID (u32)
 * @param {string|number} nftTokenId       - NFT token ID (u32), or null if no NFT exists yet
 * @param {string}        buyerWallet      - Buyer's Stellar public key
 * @param {number|null}   liveUntilLedger  - Optional ledger expiry for NFT approval
 * @param {Function}      onProgress       - Called with step info: ({ step, total, label })
 * @returns {Promise<{ escrowApprovalHash: string, nftApprovalHash: string|null }>}
 */
export const approveEscrowAndNFT = async (
  propertyId,
  nftTokenId,
  buyerWallet,
  liveUntilLedger = null,
  onProgress = null
) => {
  const { PropertyRegistry, Escrow, PropertyNFT } = getContractAddresses()
  const safePropertyId = parseRequiredU32(propertyId, 'Property ID')
  const hasNFT = !!(nftTokenId && buyerWallet)
  const total = hasNFT ? 2 : 1

  // ── Signature 1: Registry approve (always required) ──────────────────────
  onProgress?.({ step: 1, total, label: 'Approving escrow authority over property deed…' })
  console.log('[Soroban] Step 1 of', total, ': approving registry escrow')
  const escrowResult = await invokeSoroban(PropertyRegistry, 'approve', [
    nativeToScVal(safePropertyId, { type: 'u32' }),
    nativeToScVal(Escrow, { type: 'address' }),
  ])

  if (!hasNFT) {
    return { hash: escrowResult.hash, escrowApprovalHash: escrowResult.hash, nftApprovalHash: null }
  }

  // ── Signature 2: NFT approve (only when NFT exists) ──────────────────────
  onProgress?.({ step: 2, total, label: 'Approving NFT deed transfer to buyer…' })
  console.log('[Soroban] Step 2 of', total, ': approving NFT deed transfer')

  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)
  const parsedTokenId = parseRequiredU32(nftTokenId, 'NFT token ID')
  
  // Verify ownership before attempting to approve (prevents confusing WasmVm traps)
  try {
    const ownerAddress = await readSoroban(PropertyNFT, 'owner_of', [
      nativeToScVal(parsedTokenId, { type: 'u32' })
    ])
    if (ownerAddress && ownerAddress !== address) {
      throw new Error(`Connected wallet (${address.slice(0,4)}...${address.slice(-4)}) is not the owner of this NFT deed. The actual owner is ${ownerAddress.slice(0,4)}...${ownerAddress.slice(-4)}. Please switch accounts in Freighter.`)
    }
  } catch (err) {
    if (err.message?.includes('not the owner')) {
      throw err
    }
    console.warn('[Soroban] Could not verify NFT owner beforehand:', err.message)
  }

  let ledgerExpiry = liveUntilLedger
  if (!ledgerExpiry) {
    const latestLedger = await server.getLatestLedger()
    ledgerExpiry = latestLedger.sequence + DEFAULT_NFT_APPROVAL_LEDGER_BUFFER
  }

  const nftResult = await invokeSoroban(PropertyNFT, 'approve', [
    nativeToScVal(address, { type: 'address' }),
    nativeToScVal(buyerWallet, { type: 'address' }),
    nativeToScVal(parsedTokenId, { type: 'u32' }),
    nativeToScVal(ledgerExpiry, { type: 'u32' }),
  ])

  return {
    hash: nftResult.hash,
    escrowApprovalHash: escrowResult.hash,
    nftApprovalHash: nftResult.hash,
  }
}

export const transferPropertyNFT = async (tokenId, fromAddress, toAddress) => {
  const { PropertyNFT } = getContractAddresses()
  const { address } = await getAddress()

  const parsedTokenId = parseRequiredU32(tokenId, 'NFT token ID')

  return await invokeSoroban(PropertyNFT, 'transfer_from', [
    nativeToScVal(address, { type: 'address' }),
    nativeToScVal(fromAddress, { type: 'address' }),
    nativeToScVal(toAddress, { type: 'address' }),
    nativeToScVal(parsedTokenId, { type: 'u32' }),
  ])
}

/**
 * Sequential: Complete the escrow on-chain AND transfer the NFT deed to the buyer.
 *
 * Soroban only allows ONE InvokeHostFunction per transaction, so these must be
 * two separate Freighter popups. The onProgress callback lets the UI update its
 * step indicator between the two signatures.
 *
 * @param {string|number} escrowTransactionId - On-chain escrow ID (u32)
 * @param {string|number} nftTokenId           - NFT token ID (u32), or null to skip NFT transfer
 * @param {string}        sellerWallet          - Seller's Stellar public key
 * @param {string}        buyerWallet           - Buyer's Stellar public key
 * @param {Function}      onProgress            - Called with ({ step, total, label })
 * @returns {Promise<{ escrowHash: string, nftHash: string|null }>}
 */
export const completeEscrowAndTransferNFT = async (
  escrowTransactionId,
  nftTokenId,
  sellerWallet,
  buyerWallet,
  onProgress = null
) => {
  const { Escrow, PropertyNFT } = getContractAddresses()
  const safeTxId = parseRequiredU32(escrowTransactionId, 'Escrow transaction ID')
  const hasNFT = !!(nftTokenId && sellerWallet && buyerWallet)
  const total = hasNFT ? 2 : 1

  // Resolve the connected wallet as the caller (buyer completing the purchase)
  const { address: callerAddress } = await getAddress()

  // ── Signature 1: complete_escrow (always required) ───────────────────────
  onProgress?.({ step: 1, total, label: 'Releasing funds from escrow to seller…' })
  console.log('[Soroban] Step 1 of', total, ': completing escrow')
  const escrowResult = await invokeSoroban(Escrow, 'complete_escrow', [
    nativeToScVal(safeTxId, { type: 'u32' }),
    nativeToScVal(callerAddress, { type: 'address' }),
  ])

  if (!hasNFT) {
    return { hash: escrowResult.hash, escrowHash: escrowResult.hash, nftHash: null }
  }

  // ── Signature 2: transfer_from NFT ───────────────────────────────────────
  onProgress?.({ step: 2, total, label: 'Transferring property NFT deed to your wallet…' })
  console.log('[Soroban] Step 2 of', total, ': transferring NFT deed')
  const parsedTokenId = parseRequiredU32(nftTokenId, 'NFT token ID')
  const nftResult = await invokeSoroban(PropertyNFT, 'transfer_from', [
    nativeToScVal(callerAddress, { type: 'address' }), // spender (buyer as approved operator)
    nativeToScVal(sellerWallet, { type: 'address' }),  // from
    nativeToScVal(buyerWallet, { type: 'address' }),   // to
    nativeToScVal(parsedTokenId, { type: 'u32' }),
  ])

  return {
    hash: nftResult.hash,
    escrowHash: escrowResult.hash,
    nftHash: nftResult.hash,
  }
}


// --- PropertyNFT Service ---
export const mintPropertyNFT = async (ownerAddress, propertyId, tokenUri) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is not configured for NFT minting.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/mint-property-nft`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      ownerAddress,
      propertyId,
      tokenUri,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Failed to mint property NFT via edge function.')
  }

  return {
    txHash: result.txHash,
    tokenId: result.tokenId,
    contractId: result.contractId,
  }
}

export const mintPropertyNFTDirect = async (ownerAddress, propertyId, tokenUri) => {
  const { PropertyNFT } = getContractAddresses()

  // The contract mint() signature:
  // mint(env, admin: Address, to: Address, property_id: u32, token_uri: String) -> u32
  // Admin is the contract deployer — in this setup the same wallet signs as admin.
  const { address: callerAddress } = await getAddress()

  // property_id must be a u32. If the ID is a non-numeric string (e.g. 'ledger-confirmed'),
  // generate a stable random u32 to serve as the on-chain property_id.
  const numericId = parseRequiredU32(propertyId, 'Property ID')

  const result = await invokeSoroban(PropertyNFT, 'mint', [
    nativeToScVal(callerAddress, { type: 'address' }),  // admin
    nativeToScVal(ownerAddress, { type: 'address' }),   // to
    nativeToScVal(numericId, { type: 'u32' }),          // property_id
    nativeToScVal(tokenUri, { type: 'string' }),        // token_uri
  ])

  const tokenId = result.returnValue
  if (typeof tokenId !== 'number') {
    throw new Error('Soroban mint did not return a valid token ID')
  }

  return { txHash: result.hash, tokenId: tokenId.toString() }
}

export const hasPropertyNFT = async (propertyId) => {
  const { PropertyNFT } = getContractAddresses()
  const numericId = parseRequiredU32(propertyId, 'Property ID')

  return await readSoroban(PropertyNFT, 'has_token', [
    nativeToScVal(numericId, { type: 'u32' }),
  ])
}

// Simple legacy placeholders for parts of the UI not yet fully migrated
export const getPropertyOnChain = async () => ({})
export const getPropertyTokenBalance = async () => '0'

/**
 * Fetch ownership transfer history for a property from Supabase.
 * Returns an array of transfer records ordered oldest-first.
 *
 * @param {string} propertyId - The property UUID (not the on-chain ID)
 */
export const getPropertyOwnershipHistory = async (propertyId) => {
  try {
    const { supabase } = await import('../lib/supabase')

    const { data, error } = await supabase
      .from('ownership_transfers')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })

    if (error) {
      // Table may not exist yet (migration not run) — degrade gracefully
      if (error.code === '42P01' || error.message?.includes('ownership_transfers')) {
        console.warn('[contracts] ownership_transfers table not found — returning empty history')
        return []
      }
      throw error
    }

    return (data || []).map((entry) => ({
      id: entry.id,
      previousOwner: entry.from_wallet || entry.from_owner_id || 'Genesis',
      newOwner: entry.to_wallet || entry.to_owner_id,
      timestamp: entry.created_at,
      transferType: entry.transfer_type === 'mint' ? 'Initial Registration' : 'Sale',
      blockchainTxHash: entry.blockchain_tx_hash,
      nftTransferTxHash: entry.nft_transfer_tx_hash,
      transactionId: entry.transaction_id,
    }))
  } catch (err) {
    console.error('Error fetching ownership history:', err)
    return []
  }
}
