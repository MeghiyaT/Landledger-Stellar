import { getContract } from '../lib/web3'
import { ethers } from 'ethers'

// Contract ABIs (these will be generated after compilation)
// For now, we'll use minimal ABIs for the main functions

// PropertyToken ABI
const PROPERTY_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function burn(uint256 amount)',
]

// PropertyRegistry ABI
const PROPERTY_REGISTRY_ABI = [
  'function registerProperty(string memory title, string memory location, uint256 price) returns (uint256)',
  'function updateProperty(uint256 propertyId, string memory title, uint256 price)',
  'function transferOwnership(uint256 propertyId, address newOwner, string memory transferType)',
  'function listForSale(uint256 propertyId, uint256 price)',
  'function removeFromSale(uint256 propertyId)',
  'function getProperty(uint256 propertyId) view returns (uint256, address, string memory, string memory, uint256, bool, bool, uint256)',
  'function getPropertiesByOwner(address owner) view returns (uint256[])',
  'function getOwnershipHistory(uint256 propertyId) view returns (tuple(address, address, uint256, string)[])',
  'function propertyCounter() view returns (uint256)',
  'event PropertyRegistered(uint256 indexed propertyId, address indexed owner, string title, string location, uint256 price)',
  'event OwnershipTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner, string transferType)',
]

// Escrow ABI
const ESCROW_ABI = [
  'function createEscrowETH(uint256 propertyId, address seller, uint256 deadline) payable returns (uint256)',
  'function createEscrowToken(uint256 propertyId, address seller, uint256 amount, uint256 deadline) returns (uint256)',
  'function completeEscrow(uint256 transactionId)',
  'function cancelEscrow(uint256 transactionId)',
  'function getTransaction(uint256 transactionId) view returns (uint256, uint256, address, address, uint256, bool, uint256, bool, bool)',
  'function transactionCounter() view returns (uint256)',
  'event EscrowCreated(uint256 indexed transactionId, uint256 indexed propertyId, address indexed buyer, address seller, uint256 amount, bool isTokenPayment)',
  'event EscrowCompleted(uint256 indexed transactionId, address indexed buyer, address indexed seller, uint256 amount)',
]

// PropertyOffers ABI
const PROPERTY_OFFERS_ABI = [
  'function createOffer(uint256 propertyId, uint256 amount, string memory message, uint256 duration) returns (uint256)',
  'function acceptOffer(uint256 offerId)',
  'function rejectOffer(uint256 offerId)',
  'function withdrawOffer(uint256 offerId)',
  'function getOffer(uint256 offerId) view returns (uint256, uint256, address, address, uint256, string memory, uint256, bool, bool, bool, uint256)',
  'function getOffersByProperty(uint256 propertyId) view returns (uint256[])',
  'function getOffersByBuyer(address buyer) view returns (uint256[])',
  'event OfferCreated(uint256 indexed offerId, uint256 indexed propertyId, address indexed buyer, address seller, uint256 amount, uint256 deadline)',
  'event OfferAccepted(uint256 indexed offerId, uint256 indexed propertyId, address indexed buyer, address seller)',
]

// Get contract addresses from environment or deployment file
let cachedAddresses = null

export const getContractAddresses = async () => {
  if (cachedAddresses) {
    return cachedAddresses
  }

  // Try to load from deployment file
  try {
    const response = await fetch('/deployment-addresses.json')
    if (response.ok) {
      const data = await response.json()
      cachedAddresses = data.contracts
      return cachedAddresses
    }
  } catch (error) {
    console.log('Could not load deployment-addresses.json, using env variables')
  }

  // Fallback to environment variables
  cachedAddresses = {
    PropertyToken: import.meta.env.VITE_PROPERTY_TOKEN_ADDRESS,
    PropertyRegistry: import.meta.env.VITE_PROPERTY_REGISTRY_ADDRESS,
    Escrow: import.meta.env.VITE_ESCROW_ADDRESS,
    PropertyOffers: import.meta.env.VITE_PROPERTY_OFFERS_ADDRESS,
    PropertyNFT: import.meta.env.VITE_PROPERTY_NFT_ADDRESS,
  }
  return cachedAddresses
}

// PropertyToken Service
export const getPropertyTokenContract = async () => {
  const addresses = await getContractAddresses()
  if (!addresses.PropertyToken) {
    throw new Error('PropertyToken address not configured')
  }
  return await getContract(addresses.PropertyToken, PROPERTY_TOKEN_ABI)
}

export const getPropertyTokenBalance = async (address) => {
  try {
    const contract = await getPropertyTokenContract()
    const balance = await contract.balanceOf(address)
    // Convert from wei to tokens (assuming 18 decimals)
    const { formatUnits } = await import('ethers')
    return formatUnits(balance, 18)
  } catch (error) {
    console.error('Error getting token balance:', error)
    throw error
  }
}

export const transferPropertyTokens = async (to, amount) => {
  const contract = await getPropertyTokenContract()
  const tx = await contract.transfer(to, amount)
  return tx
}

export const approvePropertyTokens = async (spender, amount) => {
  const contract = await getPropertyTokenContract()
  const tx = await contract.approve(spender, amount)
  return tx
}

// PropertyRegistry Service
export const getPropertyRegistryContract = async () => {
  const addresses = await getContractAddresses()
  if (!addresses.PropertyRegistry) {
    throw new Error('PropertyRegistry address not configured')
  }
  return await getContract(addresses.PropertyRegistry, PROPERTY_REGISTRY_ABI)
}

export const registerPropertyOnChain = async (title, location, price) => {
  const contract = await getPropertyRegistryContract()
  const tx = await contract.registerProperty(title, location, price)
  const receipt = await tx.wait()
  
  // Extract property ID from event
  try {
    const iface = new ethers.Interface(PROPERTY_REGISTRY_ABI)
    const event = receipt.logs.find(log => {
      try {
        const parsed = iface.parseLog(log)
        return parsed && parsed.name === 'PropertyRegistered'
      } catch {
        return false
      }
    })
    
    if (event) {
      const parsed = iface.parseLog(event)
      return {
        txHash: receipt.hash,
        propertyId: parsed.args.propertyId.toString(),
      }
    }
  } catch (error) {
    console.error('Error parsing event:', error)
  }
  
  return { txHash: receipt.hash }
}

export const getPropertyOnChain = async (propertyId) => {
  const contract = await getPropertyRegistryContract()
  const property = await contract.getProperty(propertyId)
  return {
    id: property[0].toString(),
    owner: property[1],
    title: property[2],
    location: property[3],
    price: property[4].toString(),
    isActive: property[5],
    isForSale: property[6],
    createdAt: property[7].toString(),
  }
}

export const listPropertyForSale = async (propertyId, price) => {
  const contract = await getPropertyRegistryContract()
  const tx = await contract.listForSale(propertyId, price)
  return tx
}

export const transferPropertyOwnership = async (propertyId, newOwner, transferType) => {
  const contract = await getPropertyRegistryContract()
  const tx = await contract.transferOwnership(propertyId, newOwner, transferType)
  return tx
}

export const getPropertyOwnershipHistory = async (propertyId) => {
  const contract = await getPropertyRegistryContract()
  const history = await contract.getOwnershipHistory(propertyId)
  return history
}

// Escrow Service
export const getEscrowContract = async () => {
  const addresses = await getContractAddresses()
  if (!addresses.Escrow) {
    throw new Error('Escrow address not configured')
  }
  return await getContract(addresses.Escrow, ESCROW_ABI)
}

export const createEscrowETH = async (propertyId, seller, deadline, amountInEth) => {
  const contract = await getEscrowContract()
  const tx = await contract.createEscrowETH(propertyId, seller, deadline, {
    value: ethers.parseEther(amountInEth.toString()),
  })
  return tx
}

export const createEscrowToken = async (propertyId, seller, amount, deadline) => {
  const contract = await getEscrowContract()
  const tx = await contract.createEscrowToken(propertyId, seller, amount, deadline)
  return tx
}

export const completeEscrow = async (transactionId) => {
  const contract = await getEscrowContract()
  const tx = await contract.completeEscrow(transactionId)
  return tx
}

export const cancelEscrow = async (transactionId) => {
  const contract = await getEscrowContract()
  const tx = await contract.cancelEscrow(transactionId)
  return tx
}

export const getEscrowTransaction = async (transactionId) => {
  const contract = await getEscrowContract()
  const txn = await contract.getTransaction(transactionId)
  return {
    id: txn[0].toString(),
    propertyId: txn[1].toString(),
    buyer: txn[2],
    seller: txn[3],
    amount: txn[4].toString(),
    isTokenPayment: txn[5],
    deadline: txn[6].toString(),
    isCompleted: txn[7],
    isCancelled: txn[8],
  }
}

// PropertyOffers Service
export const getPropertyOffersContract = async () => {
  const addresses = await getContractAddresses()
  if (!addresses.PropertyOffers) {
    throw new Error('PropertyOffers address not configured')
  }
  return await getContract(addresses.PropertyOffers, PROPERTY_OFFERS_ABI)
}

export const createOfferOnChain = async (propertyId, amount, message, duration) => {
  const contract = await getPropertyOffersContract()
  const tx = await contract.createOffer(propertyId, amount, message, duration)
  return tx
}

export const acceptOfferOnChain = async (offerId) => {
  const contract = await getPropertyOffersContract()
  const tx = await contract.acceptOffer(offerId)
  return tx
}

export const rejectOfferOnChain = async (offerId) => {
  const contract = await getPropertyOffersContract()
  const tx = await contract.rejectOffer(offerId)
  return tx
}

export const withdrawOfferOnChain = async (offerId) => {
  const contract = await getPropertyOffersContract()
  const tx = await contract.withdrawOffer(offerId)
  return tx
}

export const getOfferOnChain = async (offerId) => {
  const contract = await getPropertyOffersContract()
  const offer = await contract.getOffer(offerId)
  return {
    id: offer[0].toString(),
    propertyId: offer[1].toString(),
    buyer: offer[2],
    seller: offer[3],
    amount: offer[4].toString(),
    message: offer[5],
    deadline: offer[6].toString(),
    isAccepted: offer[7],
    isRejected: offer[8],
    isWithdrawn: offer[9],
    createdAt: offer[10].toString(),
  }
}

export const getOffersByPropertyOnChain = async (propertyId) => {
  const contract = await getPropertyOffersContract()
  const offerIds = await contract.getOffersByProperty(propertyId)
  return offerIds.map(id => id.toString())
}

// PropertyNFT ABI
const PROPERTY_NFT_ABI = [
  'function mintPropertyNFT(address to, uint256 propertyId, string memory tokenURI) returns (uint256)',
  'function transferPropertyNFT(uint256 propertyId, address to) returns (bool)',
  'function getTokenIdByProperty(uint256 propertyId) view returns (uint256)',
  'function getPropertyByTokenId(uint256 tokenId) view returns (uint256)',
  'function getPropertyNFTOwner(uint256 propertyId) view returns (address)',
  'function hasNFT(uint256 propertyId) view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event PropertyNFTMinted(uint256 indexed tokenId, uint256 indexed propertyId, address indexed owner, string tokenURI)',
  'event PropertyNFTTransferred(uint256 indexed tokenId, uint256 indexed propertyId, address indexed from, address indexed to)',
]

// PropertyNFT Service
export const getPropertyNFTContract = async () => {
  const addresses = await getContractAddresses()
  if (!addresses.PropertyNFT) {
    throw new Error('PropertyNFT address not configured')
  }
  return await getContract(addresses.PropertyNFT, PROPERTY_NFT_ABI)
}

export const mintPropertyNFT = async (toAddress, propertyId, tokenURI) => {
  try {
    const contract = await getPropertyNFTContract()
    const tx = await contract.mintPropertyNFT(toAddress, propertyId, tokenURI || '')
    const receipt = await tx.wait()
    
    // Extract token ID from event
    try {
      const iface = new ethers.Interface(PROPERTY_NFT_ABI)
      const event = receipt.logs.find(log => {
        try {
          const parsed = iface.parseLog(log)
          return parsed && parsed.name === 'PropertyNFTMinted'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = iface.parseLog(event)
        return {
          txHash: receipt.hash,
          tokenId: parsed.args.tokenId.toString(),
          propertyId: parsed.args.propertyId.toString(),
          owner: parsed.args.owner,
        }
      }
    } catch (error) {
      console.error('Error parsing NFT mint event:', error)
    }
    
    return { txHash: receipt.hash }
  } catch (error) {
    console.error('Error minting property NFT:', error)
    throw error
  }
}

export const transferPropertyNFT = async (propertyId, toAddress) => {
  try {
    const contract = await getPropertyNFTContract()
    const tx = await contract.transferPropertyNFT(propertyId, toAddress)
    const receipt = await tx.wait()
    
    // Extract transfer details from event
    try {
      const iface = new ethers.Interface(PROPERTY_NFT_ABI)
      const event = receipt.logs.find(log => {
        try {
          const parsed = iface.parseLog(log)
          return parsed && parsed.name === 'PropertyNFTTransferred'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = iface.parseLog(event)
        return {
          txHash: receipt.hash,
          tokenId: parsed.args.tokenId.toString(),
          propertyId: parsed.args.propertyId.toString(),
          from: parsed.args.from,
          to: parsed.args.to,
        }
      }
    } catch (error) {
      console.error('Error parsing NFT transfer event:', error)
    }
    
    return { txHash: receipt.hash }
  } catch (error) {
    console.error('Error transferring property NFT:', error)
    throw error
  }
}

export const getPropertyNFTTokenId = async (propertyId) => {
  try {
    const contract = await getPropertyNFTContract()
    const tokenId = await contract.getTokenIdByProperty(propertyId)
    return tokenId.toString()
  } catch (error) {
    console.error('Error getting NFT token ID:', error)
    throw error
  }
}

export const getPropertyNFTOwner = async (propertyId) => {
  try {
    const contract = await getPropertyNFTContract()
    const owner = await contract.getPropertyNFTOwner(propertyId)
    return owner
  } catch (error) {
    console.error('Error getting NFT owner:', error)
    throw error
  }
}

export const hasPropertyNFT = async (propertyId) => {
  try {
    const contract = await getPropertyNFTContract()
    const hasNFT = await contract.hasNFT(propertyId)
    return hasNFT
  } catch (error) {
    console.error('Error checking if property has NFT:', error)
    return false
  }
}

export const getNFTTokenURI = async (tokenId) => {
  try {
    const contract = await getPropertyNFTContract()
    const tokenURI = await contract.tokenURI(tokenId)
    return tokenURI
  } catch (error) {
    console.error('Error getting NFT token URI:', error)
    throw error
  }
}

