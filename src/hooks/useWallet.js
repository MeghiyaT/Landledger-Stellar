import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { getUserProfile, updateUserProfile } from '../services/user'

// Freighter API
import {
  isConnected,
  isAllowed,
  setAllowed,
  getPublicKey,
  getNetwork
} from '@stellar/freighter-api'
// Stellar SDK for network parsing (optional, but good for validation)
import * as StellarSdk from '@stellar/stellar-sdk'

const useWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [isSepolia, setIsSepolia] = useState(false) // Keeping this state name to avoid breaking UI components relying on it, though it means 'isStellarTestnet'
  const [balance, setBalance] = useState(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const { user } = useUser()

  // Check if Freighter is installed
  const isMetaMaskInstalled = () => {
    // We kept the function name to avoid breaking the UI hooks calling it
    // but underneath we check if Freighter is connected
    return typeof window !== 'undefined' && window.freighter !== undefined;
  }

  // Check network and update state
  const checkNetwork = useCallback(async () => {
    if (!isMetaMaskInstalled() || !walletAddress) {
      setIsSepolia(false)
      return
    }

    try {
      if (await isAllowed()) {
         const network = await getNetwork()
         // Freighter returns "TESTNET", "PUBLIC", or "FUTURENET"
         const isOnStellarTestnet = network === "TESTNET"
         setIsSepolia(isOnStellarTestnet)
         
         if (!isOnStellarTestnet) {
           setError('Please switch to Stellar testnet to use this application.')
         } else {
           setError(null)
         }
      }
    } catch (err) {
      console.error('Error checking network:', err)
      setIsSepolia(false)
    }
  }, [walletAddress])

  // Load wallet balance from Stellar API
  const loadBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null)
      return
    }

    const onTestnet = await getNetwork().catch(() => "TESTNET") === "TESTNET"
    if (!onTestnet) {
      setBalance(null)
      return
    }

    setIsLoadingBalance(true)
    try {
      const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
      const account = await server.loadAccount(walletAddress)
      const nativeBalance = account.balances.find((b) => b.asset_type === 'native')
      setBalance(nativeBalance ? nativeBalance.balance : '0.0000000')
    } catch (err) {
      console.error('Error loading balance:', err)
      setBalance('0.0000000') // Standard default if unfunded on Stellar
    } finally {
      setIsLoadingBalance(false)
    }
  }, [walletAddress])

  // Load wallet address from Supabase profile on mount
  useEffect(() => {
    const loadWalletAddress = async () => {
      if (user?.id) {
        try {
          const { data, error } = await getUserProfile(user.id)
          if (!error && data?.wallet_address) {
            setWalletAddress(data.wallet_address)
          } else {
            setWalletAddress(null)
          }
        } catch (err) {
          console.error('Error loading wallet address:', err)
          setWalletAddress(null)
        }
      } else {
        setWalletAddress(null)
      }
    }
    loadWalletAddress()

    const handleWalletDisconnected = () => {
      setWalletAddress(null)
      setError(null)
    }

    const handleWalletConnected = async () => {
      await loadWalletAddress()
    }

    window.addEventListener('walletDisconnected', handleWalletDisconnected)
    window.addEventListener('walletConnected', handleWalletConnected)

    return () => {
      window.removeEventListener('walletDisconnected', handleWalletDisconnected)
      window.removeEventListener('walletConnected', handleWalletConnected)
    }
  }, [user])

  // Connect wallet
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('Freighter is not installed. Please install Freighter to connect your wallet.')
      return null
    }

    setIsConnecting(true)
    setError(null)

    try {
      // For Freighter, we use setAllowed to prompt user
      await setAllowed()
      
      const publicKey = await getPublicKey()

      if (publicKey) {
        setWalletAddress(publicKey)
        
        await checkNetwork()

        // Save wallet address to Supabase profile
        if (user?.id) {
          try {
            await updateUserProfile(user.id, {
              wallet_address: publicKey,
            })
            window.dispatchEvent(new CustomEvent('walletConnected'))
          } catch (profileError) {
            console.error('Error updating profile with wallet address:', profileError)
          }
        }

        await loadBalance()
        return publicKey
      }
    } catch (err) {
      console.error('Error connecting wallet:', err)
      setError(err.message || 'Failed to connect wallet. Please try again.')
      return null
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    setWalletAddress(null)
    setError(null)

    if (user?.id) {
      try {
        await updateUserProfile(user.id, {
          wallet_address: null,
        })
        window.dispatchEvent(new CustomEvent('walletDisconnected'))
      } catch (profileError) {
        console.error('Error removing wallet address from profile:', profileError)
      }
    } else {
      window.dispatchEvent(new CustomEvent('walletDisconnected'))
    }
  }, [user])

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 5)}...${address.slice(-4)}`
  }

  useEffect(() => {
    if (walletAddress) {
      checkNetwork()
      loadBalance()
    } else {
      setIsSepolia(false)
      setBalance(null)
    }
  }, [walletAddress, checkNetwork, loadBalance])

  // Switch network abstraction (Freighter doesn't allow programatic network switching right now)
  const switchNetwork = async () => {
    setError('Please manually switch your Freighter wallet to the TESTNET network.')
  }

  return {
    walletAddress,
    isConnecting,
    error,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    isSepolia,
    balance,
    isLoadingBalance,
    connectWallet,
    disconnectWallet,
    formatAddress,
    switchNetwork,
    checkNetwork,
    loadBalance,
  }
}

export default useWallet
