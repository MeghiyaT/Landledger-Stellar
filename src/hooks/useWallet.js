import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { getUserProfile, updateUserProfile } from '../services/user'

// Freighter API
import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetwork
} from '@stellar/freighter-api'
import * as StellarSdk from '@stellar/stellar-sdk'

const useWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [isTestnet, setIsTestnet] = useState(false) 
  const [balance, setBalance] = useState(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const { user } = useUser()

  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false)

  // Check if Freighter is installed asynchronously on mount
  useEffect(() => {
    const checkFreighter = async () => {
      try {
        const result = await isConnected()
        setIsFreighterInstalled(result.isConnected)
      } catch (err) {
        console.error('Error checking Freighter installation:', err)
        setIsFreighterInstalled(false)
      }
    }
    checkFreighter()
    
    // Polling as a fallback because sometimes the extension injects after React mount
    const interval = setInterval(checkFreighter, 1000)
    return () => clearInterval(interval)
  }, [])

  // Check network and update state
  const checkNetwork = useCallback(async () => {
    if (!isFreighterInstalled || !walletAddress) {
      setIsTestnet(false)
      return
    }

    try {
      if ((await isAllowed()).isAllowed) {
         const { network } = await getNetwork()
         // Freighter returns "TESTNET", "PUBLIC", or "FUTURENET"
         const isOnStellarTestnet = network === "TESTNET"
         setIsTestnet(isOnStellarTestnet)
         
         if (!isOnStellarTestnet) {
           setError('Please switch to Stellar testnet to use this application.')
         } else {
           setError(null)
         }
      }
    } catch (err) {
      console.error('Error checking network:', err)
      setIsTestnet(false)
    }
  }, [walletAddress, isFreighterInstalled])

  // Load wallet balance from Stellar API
  const loadBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null)
      return
    }

    let onTestnet = false
    try {
      const { network } = await getNetwork()
      onTestnet = network === "TESTNET"
    } catch (e) {
      onTestnet = true
    }
    
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
    if (!isFreighterInstalled) {
      setError('Freighter is not installed. Please install Freighter to connect your wallet.')
      return null
    }

    setIsConnecting(true)
    setError(null)

    try {
      await setAllowed()
      const { address } = await getAddress()

      if (address) {
        setWalletAddress(address)
        await checkNetwork()

        if (user?.id) {
          try {
            await updateUserProfile(user.id, { wallet_address: address })
            window.dispatchEvent(new CustomEvent('walletConnected'))
          } catch (profileError) {
            console.error('Error updating profile with wallet address:', profileError)
          }
        }

        await loadBalance()
        return address
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
        await updateUserProfile(user.id, { wallet_address: null })
        window.dispatchEvent(new CustomEvent('walletDisconnected'))
      } catch (profileError) {
        console.error('Error removing wallet address from profile:', profileError)
      }
    } else {
      window.dispatchEvent(new CustomEvent('walletDisconnected'))
    }
  }, [user])

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 5)}...${address.slice(-4)}`
  }

  useEffect(() => {
    if (walletAddress) {
      checkNetwork()
      loadBalance()
    } else {
      setIsTestnet(false)
      setBalance(null)
    }
  }, [walletAddress, checkNetwork, loadBalance])

  const switchNetwork = async () => {
    window.dispatchEvent(new CustomEvent('showWalletNetworkAlert'))
    setError('Please manually switch your Freighter wallet to the TESTNET network.')
  }

  return {
    walletAddress,
    isConnecting,
    error,
    isFreighterInstalled,
    isTestnet,
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

