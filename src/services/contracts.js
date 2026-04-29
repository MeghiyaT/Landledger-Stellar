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
const POLL_INTERVAL_MS = 1500
const MAX_TX_POLL_ATTEMPTS = 20
const DEFAULT_NFT_APPROVAL_LEDGER_BUFFER = 518400

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
      return value.str().toString()
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
  for (let attempt = 0; attempt < MAX_TX_POLL_ATTEMPTS; attempt += 1) {
    try {
      const response = await server.getTransaction(hash)

      if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          hash,
          returnValue: scValToNative(response.returnValue ?? fallbackReturnValue),
          rawReturnValue: response.returnValue ?? fallbackReturnValue,
        }
      }

      if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed on-chain for hash ${hash}`)
      }
    } catch (error) {
      console.warn('[Soroban] SDK getTransaction decode failed, falling back to raw RPC:', error.message)
      const rawResponse = await getRawSorobanTransaction(hash)

      if (rawResponse.status === 'SUCCESS') {
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
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Timed out waiting for Soroban transaction ${hash}`)
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
 * Helper to invoke a Soroban contract method.
 * Designed for @stellar/freighter-api v3.1.0
 */
const invokeSoroban = async (contractId, method, args = []) => {
  const { address } = await getAddress()
  const server = new rpc.Server(RPC_URL)
  const account = await server.getAccount(address)
  const contract = new Contract(contractId)

  // 1. Build initial transaction
  const txInitial = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  // 2. Simulate transaction to get footprint and resource usage
  const simulation = await server.simulateTransaction(txInitial)
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`)
  }
  const simulatedReturnValue = simulation.result?.retval ?? null

  // 3. Prepare transaction with simulation results (injects resource fees)
  const tx = await server.prepareTransaction(txInitial)

  // 4. Sign transaction
  // Freighter API v3.1.0: signTransaction(xdr, { networkPassphrase })
  // Returns: { signedTxXdr: string, signerAddress: string, error?: object }
  const xdrString = tx.toXDR()
  console.log('[Soroban] Sending to Freighter for signing:', xdrString.slice(0, 80) + '...')

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
  console.log('[Soroban] Transaction submitted:', result.hash, result.status)

  if (result.status === 'ERROR') {
    throw new Error(`Soroban transaction submission failed for ${method}`)
  }

  const finalResult = await waitForSorobanTransaction(server, result.hash, method, simulatedReturnValue)
  return finalResult
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


// --- PropertyNFT Service ---
export const mintPropertyNFT = async (ownerAddress, propertyId, tokenUri) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured for NFT minting.')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/mint-property-nft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
export const getPropertyOwnershipHistory = async () => []
