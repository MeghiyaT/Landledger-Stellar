import { ethers } from 'ethers'

// Sepolia Testnet Chain ID (decimal)
export const SEPOLIA_CHAIN_ID_DECIMAL = 11155111
export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7' // 11155111 in hex

/**
 * Check if MetaMask is installed
 * @returns {boolean}
 */
export const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
}

/**
 * Check if the current network is Sepolia testnet
 * @returns {Promise<boolean>}
 */
export const isSepoliaNetwork = async () => {
  if (!isMetaMaskInstalled()) {
    return false
  }

  try {
    const chainId = await window.ethereum.request({
      method: 'eth_chainId',
    })
    
    // Convert hex chain ID to decimal and compare
    const chainIdDecimal = parseInt(chainId, 16)
    return chainIdDecimal === SEPOLIA_CHAIN_ID_DECIMAL
  } catch (error) {
    console.error('Error checking network:', error)
    return false
  }
}

/**
 * Switch to Sepolia testnet
 * @returns {Promise<void>}
 */
export const switchToSepolia = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    })
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: 'Sepolia Test Network',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        })
      } catch (addError) {
        throw new Error('Failed to add Sepolia network to MetaMask')
      }
    } else {
      throw switchError
    }
  }
}

/**
 * Get ETH balance for an address
 * @param {string} address - Ethereum address
 * @returns {Promise<string>} Balance in ETH (as string)
 */
export const getBalance = async (address) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const balance = await provider.getBalance(address)
    // Convert from wei to ETH
    return ethers.formatEther(balance)
  } catch (error) {
    console.error('Error getting balance:', error)
    throw error
  }
}

/**
 * Send a transaction (ETH transfer)
 * @param {string} toAddress - Recipient address
 * @param {string|number} amountInEth - Amount in ETH
 * @returns {Promise<ethers.TransactionResponse>}
 */
export const sendTransaction = async (toAddress, amountInEth) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amountInEth.toString()),
    })
    
    return tx
  } catch (error) {
    console.error('Error sending transaction:', error)
    throw error
  }
}

/**
 * Wait for a transaction to be mined
 * @param {string} txHash - Transaction hash
 * @returns {Promise<ethers.TransactionReceipt>}
 */
export const waitForTransaction = async (txHash) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const receipt = await provider.waitForTransaction(txHash)
    return receipt
  } catch (error) {
    console.error('Error waiting for transaction:', error)
    throw error
  }
}

/**
 * Get transaction receipt
 * @param {string} txHash - Transaction hash
 * @returns {Promise<ethers.TransactionReceipt | null>}
 */
export const getTransactionReceipt = async (txHash) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const receipt = await provider.getTransactionReceipt(txHash)
    return receipt
  } catch (error) {
    console.error('Error getting transaction receipt:', error)
    throw error
  }
}

/**
 * Format ETH amount for display
 * @param {string|bigint} amountInWei - Amount in wei
 * @returns {string} Formatted amount in ETH
 */
export const formatEth = (amountInWei) => {
  try {
    return ethers.formatEther(amountInWei)
  } catch (error) {
    console.error('Error formatting ETH:', error)
    return '0'
  }
}

/**
 * Get a signer instance for sending transactions
 * @returns {Promise<ethers.JsonRpcSigner>}
 */
export const getSigner = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    return signer
  } catch (error) {
    console.error('Error getting signer:', error)
    throw error
  }
}

/**
 * Get a contract instance with signer (for write operations)
 * @param {string} contractAddress - Contract address
 * @param {Array|string} abi - Contract ABI
 * @returns {Promise<ethers.Contract>}
 */
export const getContract = async (contractAddress, abi) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const signer = await getSigner()
    const contract = new ethers.Contract(contractAddress, abi, signer)
    return contract
  } catch (error) {
    console.error('Error getting contract:', error)
    throw error
  }
}

/**
 * Get a read-only contract instance (for read operations)
 * @param {string} contractAddress - Contract address
 * @param {Array|string} abi - Contract ABI
 * @returns {Promise<ethers.Contract>}
 */
export const getContractReadOnly = async (contractAddress, abi) => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(contractAddress, abi, provider)
    return contract
  } catch (error) {
    console.error('Error getting read-only contract:', error)
    throw error
  }
}

