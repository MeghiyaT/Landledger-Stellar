import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { xdr } from '@stellar/stellar-sdk'

dotenv.config()

const args = new Set(process.argv.slice(2))
const shouldWrite = args.has('--write')
const propertyArg = process.argv.find((arg) => arg.startsWith('--property='))
const propertyFilter = propertyArg ? propertyArg.split('=')[1] : null

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const rpcUrl = 'https://soroban-testnet.stellar.org'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const decodeScVal = (value) => {
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
    case 'scvString':
      return value.str().toString()
    case 'scvSymbol':
      return value.sym().toString()
    case 'scvBool':
      return value.b()
    case 'scvVoid':
      return null
    case 'scvVec':
      return (value.vec() || []).map(decodeScVal)
    case 'scvMap':
      return (value.map() || []).reduce((acc, entry) => {
        acc[decodeScVal(entry.key())] = decodeScVal(entry.val())
        return acc
      }, {})
    default:
      return value.switch().name
  }
}

const fetchRawTransaction = async (hash) => {
  const response = await fetch(rpcUrl, {
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
    throw new Error(`RPC getTransaction failed for ${hash}: ${payload.error.message}`)
  }

  return payload.result
}

const extractFnReturn = (diagnosticEventsXdr = [], methodName) => {
  for (const encoded of diagnosticEventsXdr) {
    const diagnosticEvent = xdr.DiagnosticEvent.fromXDR(encoded, 'base64')
    const body = diagnosticEvent.event().body().v0()
    const topics = body.topics().map(decodeScVal)

    if (topics[0] === 'fn_return' && topics[1] === methodName) {
      return decodeScVal(body.data())
    }
  }

  return null
}

const maybeRecoverFnReturn = async (hash, methodName, cache) => {
  if (!hash) return null
  if (!cache.has(hash)) {
    cache.set(hash, fetchRawTransaction(hash))
  }

  const transaction = await cache.get(hash)
  return extractFnReturn(transaction.diagnosticEventsXdr || [], methodName)
}

const now = () => new Date().toISOString()

const propertyQuery = supabase
  .from('properties')
  .select('id,title,user_id,sold_to,status,sold_at,blockchain_property_id,blockchain_tx_hash,nft_token_id,nft_mint_tx_hash,nft_transfer_tx_hash')
  .order('created_at', { ascending: true })

const { data: properties, error: propertiesError } = propertyFilter
  ? await propertyQuery.eq('id', propertyFilter)
  : await propertyQuery

if (propertiesError) {
  console.error('Failed to load properties:', propertiesError)
  process.exit(1)
}

const propertyIds = (properties || []).map((property) => property.id)
const transactionMap = new Map()

if (propertyIds.length > 0) {
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('id,property_id,user_id,transaction_type,status,blockchain_tx_hash,metadata')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: true })

  if (transactionsError) {
    console.error('Failed to load transactions:', transactionsError)
    process.exit(1)
  }

  for (const transaction of transactions || []) {
    const list = transactionMap.get(transaction.property_id) || []
    list.push(transaction)
    transactionMap.set(transaction.property_id, list)
  }
}

const rpcCache = new Map()
const report = []

for (const property of properties || []) {
  const propertyTransactions = transactionMap.get(property.id) || []
  const propertyUpdates = {}
  const transactionUpdates = []
  const notes = []

  const recoveredPropertyId = await maybeRecoverFnReturn(
    property.blockchain_tx_hash,
    'register_property',
    rpcCache
  )

  if (recoveredPropertyId && String(property.blockchain_property_id) !== String(recoveredPropertyId)) {
    propertyUpdates.blockchain_property_id = String(recoveredPropertyId)
  }

  const recoveredNftTokenId = await maybeRecoverFnReturn(
    property.nft_mint_tx_hash,
    'mint',
    rpcCache
  )

  if (recoveredNftTokenId && String(property.nft_token_id) !== String(recoveredNftTokenId)) {
    propertyUpdates.nft_token_id = String(recoveredNftTokenId)
  }

  if (property.status === 'sold' && property.sold_to && property.user_id !== property.sold_to) {
    propertyUpdates.user_id = property.sold_to
  }

  for (const transaction of propertyTransactions) {
    const currentEscrowId = transaction.metadata?.escrow_transaction_id
    const needsEscrowRepair =
      transaction.blockchain_tx_hash &&
      transaction.metadata &&
      (currentEscrowId === 'stellar-escrow' || currentEscrowId == null)

    if (!needsEscrowRepair) continue

    const recoveredEscrowId = await maybeRecoverFnReturn(
      transaction.blockchain_tx_hash,
      'create_escrow',
      rpcCache
    )

    if (recoveredEscrowId && String(currentEscrowId) !== String(recoveredEscrowId)) {
      transactionUpdates.push({
        id: transaction.id,
        metadata: {
          ...transaction.metadata,
          escrow_transaction_id: recoveredEscrowId,
        },
      })
    }
  }

  if (property.status === 'sold' && property.nft_token_id && !property.nft_transfer_tx_hash) {
    notes.push('completed sale still missing nft_transfer_tx_hash; seller must approve NFT transfer and buyer must finalize deed transfer')
  }

  if (Object.keys(propertyUpdates).length > 0) {
    propertyUpdates.updated_at = now()
  }

  if (shouldWrite) {
    if (Object.keys(propertyUpdates).length > 0) {
      const { error } = await supabase
        .from('properties')
        .update(propertyUpdates)
        .eq('id', property.id)

      if (error) {
        console.error(`Failed to update property ${property.id}:`, error)
        process.exit(1)
      }
    }

    for (const update of transactionUpdates) {
      const { error } = await supabase
        .from('transactions')
        .update({
          metadata: update.metadata,
          updated_at: now(),
        })
        .eq('id', update.id)

      if (error) {
        console.error(`Failed to update transaction ${update.id}:`, error)
        process.exit(1)
      }
    }
  }

  report.push({
    propertyId: property.id,
    title: property.title,
    propertyUpdates,
    transactionUpdates: transactionUpdates.map((update) => ({
      id: update.id,
      escrow_transaction_id: update.metadata.escrow_transaction_id,
    })),
    notes,
  })
}

console.log(JSON.stringify({
  mode: shouldWrite ? 'write' : 'dry-run',
  propertyCount: report.length,
  report,
}, null, 2))
