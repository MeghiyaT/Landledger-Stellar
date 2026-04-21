import { PinataSDK } from 'pinata'

/**
 * IPFS Service using Pinata
 * 
 * Pinata provides IPFS pinning services with a free tier.
 * Get your API keys from: https://app.pinata.cloud/
 */

let pinataClient = null

/**
 * Initialize Pinata client
 */
export const initPinata = () => {
  const pinataJwt = import.meta.env.VITE_PINATA_JWT

  if (!pinataJwt) {
    console.warn(
      '⚠️ Pinata JWT not configured. Add VITE_PINATA_JWT to your .env file.\n' +
      'Get your JWT from: https://app.pinata.cloud/ → API Keys → Generate New Key'
    )
    return null
  }

  if (!pinataClient) {
    try {
      pinataClient = new PinataSDK({
        pinataJwt: pinataJwt,
        pinataGateway: import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud'
      })
      
      // Log client structure for debugging
      console.log('Pinata client initialized. Available methods:', {
        hasPinata: !!pinataClient.pinata,
        hasUpload: !!pinataClient.upload,
        hasPublic: !!pinataClient.public,
        clientKeys: Object.keys(pinataClient)
      })
    } catch (error) {
      console.error('Error initializing Pinata client:', error)
      throw error
    }
  }

  return pinataClient
}

/**
 * Upload a single file to IPFS via Pinata
 * @param {File} file - The file to upload
 * @param {Object} options - Optional metadata and settings
 * @returns {Promise<{cid: string, ipfsUrl: string, gatewayUrl: string}>}
 */
export const uploadFileToIPFS = async (file, options = {}) => {
  const client = initPinata()
  
  if (!client) {
    throw new Error('Pinata client not initialized. Please configure VITE_PINATA_JWT in your .env file.')
  }

  try {
    const uploadOptions = {
      name: options.name || file.name,
      keyvalues: options.keyvalues || {},
      ...options
    }

    // Pinata SDK v2 API structure - try different methods
    let result
    if (client.pinata?.upload?.file) {
      result = await client.pinata.upload.file(file, uploadOptions)
    } else if (client.upload?.file) {
      result = await client.upload.file(file, uploadOptions)
    } else if (client.public?.upload?.file) {
      result = await client.public.upload.file(file, uploadOptions)
    } else {
      result = await client.uploadFile(file, uploadOptions)
    }
    
    const cid = result.cid || result.IpfsHash || result.data?.IpfsHash
    if (!cid) {
      console.error('Pinata upload result:', result)
      throw new Error('No CID returned from Pinata upload')
    }
    
    const ipfsUrl = `ipfs://${cid}`
    const gatewayUrl = getIPFSGatewayUrl(cid)

    return {
      cid,
      ipfsUrl,
      gatewayUrl,
      fileName: file.name,
    }
  } catch (error) {
    console.error('Error uploading file to IPFS:', error)
    throw new Error(`Failed to upload file to IPFS: ${error.message}`)
  }
}

/**
 * Upload multiple files to IPFS
 * @param {File[]} files - Array of files to upload
 * @param {Object} options - Optional metadata and settings
 * @returns {Promise<Array<{cid: string, ipfsUrl: string, gatewayUrl: string, fileName: string}>>}
 */
export const uploadFilesToIPFS = async (files, options = {}) => {
  const client = initPinata()
  
  if (!client) {
    throw new Error('Pinata client not initialized. Please configure VITE_PINATA_JWT in your .env file.')
  }

  try {
    const uploadOptions = {
      name: options.folderName || `files-${Date.now()}`,
      keyvalues: options.keyvalues || {},
      ...options
    }

    // Pinata SDK v2 API structure - try different methods
    let result
    if (client.pinata?.upload?.fileArray) {
      result = await client.pinata.upload.fileArray(files, uploadOptions)
    } else if (client.upload?.fileArray) {
      result = await client.upload.fileArray(files, uploadOptions)
    } else if (client.public?.upload?.fileArray) {
      result = await client.public.upload.fileArray(files, uploadOptions)
    } else {
      result = await client.uploadFileArray(files, uploadOptions)
    }
    
    // Pinata returns a single response with all files
    // The CID is for the directory containing all files
    const cid = result.cid || result.IpfsHash || result.data?.IpfsHash
    if (!cid) {
      console.error('Pinata upload result:', result)
      throw new Error('No CID returned from Pinata upload')
    }
    
    // For file arrays, we get individual file info
    const fileResults = files.map((file, index) => {
      const itemCid = result.items?.[index]?.cid || result.items?.[index]?.IpfsHash || cid
      return {
        cid: itemCid,
        ipfsUrl: `ipfs://${itemCid}`,
        gatewayUrl: getIPFSGatewayUrl(itemCid),
        fileName: file.name,
      }
    })

    return fileResults
  } catch (error) {
    console.error('Error uploading files to IPFS:', error)
    throw new Error(`Failed to upload files to IPFS: ${error.message}`)
  }
}

/**
 * Upload JSON metadata to IPFS
 * @param {Object} metadata - The JSON object to upload
 * @param {Object} options - Optional metadata and settings
 * @returns {Promise<{cid: string, ipfsUrl: string, gatewayUrl: string}>}
 */
export const uploadMetadataToIPFS = async (metadata, options = {}) => {
  const client = initPinata()
  
  if (!client) {
    throw new Error('Pinata client not initialized. Please configure VITE_PINATA_JWT in your .env file.')
  }

  try {
    const uploadOptions = {
      name: options.name || 'metadata.json',
      keyvalues: options.keyvalues || {},
      ...options
    }

    // Pinata SDK v2 uses client.pinata.upload.json() or client.upload.json()
    // Try different API structures for compatibility
    let result
    try {
      if (client.pinata?.upload?.json) {
        result = await client.pinata.upload.json(metadata, uploadOptions)
      } else if (client.upload?.json) {
        result = await client.upload.json(metadata, uploadOptions)
      } else if (client.public?.upload?.json) {
        result = await client.public.upload.json(metadata, uploadOptions)
      } else {
        // Fallback: Use Pinata REST API directly
        const pinataJwt = import.meta.env.VITE_PINATA_JWT
        const formData = new FormData()
        const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        formData.append('file', blob, uploadOptions.name || 'metadata.json')
        
        if (uploadOptions.keyvalues) {
          Object.entries(uploadOptions.keyvalues).forEach(([key, value]) => {
            formData.append(`pinataMetadata[keyvalues][${key}]`, value)
          })
        }
        
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pinataJwt}`
          },
          body: formData
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.details || `HTTP ${response.status}: ${response.statusText}`)
        }
        
        result = await response.json()
      }
    } catch (apiError) {
      console.error('Pinata API error:', apiError)
      throw apiError
    }
    
    const cid = result.cid || result.IpfsHash || result.data?.IpfsHash
    if (!cid) {
      console.error('Pinata upload result:', result)
      throw new Error('No CID returned from Pinata upload. Check Pinata SDK version and API structure.')
    }
    
    const ipfsUrl = `ipfs://${cid}`
    const gatewayUrl = getIPFSGatewayUrl(cid)

    return {
      cid,
      ipfsUrl,
      gatewayUrl,
    }
  } catch (error) {
    console.error('Error uploading metadata to IPFS:', error)
    console.error('Client structure:', client)
    throw new Error(`Failed to upload metadata to IPFS: ${error.message}`)
  }
}

/**
 * Get IPFS gateway URL from CID
 * @param {string} cid - IPFS Content Identifier
 * @param {string} gateway - Optional custom gateway (defaults to Pinata or public gateway)
 * @returns {string} Gateway URL
 */
export const getIPFSGatewayUrl = (cid, gateway = null) => {
  if (!cid) return null

  // Remove ipfs:// prefix if present
  const cleanCid = cid.replace(/^ipfs:\/\//, '')

  // Use custom gateway if provided
  if (gateway) {
    return `${gateway.replace(/\/$/, '')}/ipfs/${cleanCid}`
  }

  // Use Pinata gateway if configured
  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY
  if (pinataGateway) {
    const gatewayUrl = pinataGateway.startsWith('http') 
      ? pinataGateway 
      : `https://${pinataGateway}`
    return `${gatewayUrl.replace(/\/$/, '')}/ipfs/${cleanCid}`
  }

  // Fallback to public gateways
  const publicGateways = [
    'https://gateway.pinata.cloud',
    'https://ipfs.io',
    'https://cloudflare-ipfs.com',
    'https://dweb.link',
  ]

  return `${publicGateways[0]}/ipfs/${cleanCid}`
}

/**
 * Verify IPFS CID is accessible
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<boolean>}
 */
export const verifyIPFSCID = async (cid) => {
  if (!cid) return false

  try {
    const gatewayUrl = getIPFSGatewayUrl(cid)
    const response = await fetch(gatewayUrl, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    console.warn(`IPFS CID ${cid} may not be accessible:`, error)
    return false
  }
}

/**
 * Upload property images and metadata to IPFS
 * @param {File[]} imageFiles - Property image files
 * @param {Object} propertyMetadata - Property metadata (title, description, etc.)
 * @param {string} propertyId - Property ID for organization
 * @returns {Promise<{images: Array, metadataCid: string, metadataUrl: string}>}
 */
export const uploadPropertyToIPFS = async (imageFiles, propertyMetadata, propertyId = null) => {
  try {
    const folderName = propertyId ? `property-${propertyId}` : `property-${Date.now()}`

    // Upload images individually to get individual CIDs
    const imageResults = await Promise.all(
      imageFiles.map((file, index) => 
        uploadFileToIPFS(file, {
          name: `${folderName}/${file.name || `image-${index}`}`,
          keyvalues: {
            propertyId: propertyId || 'new',
            type: 'property-image',
            index: index.toString()
          }
        })
      )
    )

    // Create metadata with image CIDs
    const metadata = {
      ...propertyMetadata,
      images: imageResults.map(img => ({
        cid: img.cid,
        ipfsUrl: img.ipfsUrl,
        gatewayUrl: img.gatewayUrl,
        fileName: img.fileName,
      })),
      uploadedAt: new Date().toISOString(),
    }

    // Upload metadata
    const metadataResult = await uploadMetadataToIPFS(metadata, {
      name: `${folderName}/metadata.json`,
      keyvalues: {
        propertyId: propertyId || 'new',
        type: 'property-metadata'
      }
    })

    return {
      images: imageResults,
      metadataCid: metadataResult.cid,
      metadataUrl: metadataResult.gatewayUrl,
      metadataIpfsUrl: metadataResult.ipfsUrl,
    }
  } catch (error) {
    console.error('Error uploading property to IPFS:', error)
    throw error
  }
}
