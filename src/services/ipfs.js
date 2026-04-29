const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const callPinataUpload = async (payload, options = {}) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase function endpoint is not configured.')
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/pinata-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      kind: 'json',
      payload,
      options,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `Pinata upload failed with status ${response.status}`)
  }

  return result
}

export const initPinata = () => null

export const uploadFileToIPFS = async () => {
  throw new Error('Direct browser uploads to Pinata are disabled. Upload files to storage first, then pin metadata through the edge function.')
}

export const uploadFilesToIPFS = async () => {
  throw new Error('Direct browser uploads to Pinata are disabled. Upload files to storage first, then pin metadata through the edge function.')
}

export const uploadMetadataToIPFS = async (metadata, options = {}) => {
  const result = await callPinataUpload(metadata, options)

  return {
    cid: result.cid,
    ipfsUrl: result.ipfsUrl,
    gatewayUrl: result.gatewayUrl,
  }
}

export const getIPFSGatewayUrl = (cid, gateway = null) => {
  if (!cid) return null

  const cleanCid = cid.replace(/^ipfs:\/\//, '')

  if (gateway) {
    return `${gateway.replace(/\/$/, '')}/ipfs/${cleanCid}`
  }

  const configuredGateway = import.meta.env.VITE_PINATA_GATEWAY
  if (configuredGateway) {
    const gatewayUrl = configuredGateway.startsWith('http')
      ? configuredGateway
      : `https://${configuredGateway}`
    return `${gatewayUrl.replace(/\/$/, '')}/ipfs/${cleanCid}`
  }

  return `https://gateway.pinata.cloud/ipfs/${cleanCid}`
}

export const verifyIPFSCID = async (cid) => {
  if (!cid) return false

  try {
    const response = await fetch(getIPFSGatewayUrl(cid), { method: 'HEAD' })
    return response.ok
  } catch (error) {
    console.warn(`IPFS CID ${cid} may not be accessible:`, error)
    return false
  }
}

export const uploadPropertyToIPFS = async (_imageFiles, propertyMetadata, propertyId = null) => {
  const folderName = propertyId ? `property-${propertyId}` : `property-${Date.now()}`
  const uploadedAt = new Date().toISOString()

  const metadata = {
    ...propertyMetadata,
    images: propertyMetadata.images || [],
    uploadedAt,
  }

  const metadataResult = await uploadMetadataToIPFS(metadata, {
    name: `${folderName}/metadata.json`,
    keyvalues: {
      propertyId: propertyId || 'new',
      type: 'property-metadata',
    },
  })

  return {
    images: [],
    metadataCid: metadataResult.cid,
    metadataUrl: metadataResult.gatewayUrl,
    metadataIpfsUrl: metadataResult.ipfsUrl,
  }
}
