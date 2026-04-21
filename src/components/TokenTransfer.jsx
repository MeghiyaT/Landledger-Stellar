import { useEffect, useState } from 'react'
import { transferPropertyTokens } from '../services/contracts'
import { ethers } from 'ethers'
import useWallet from '../hooks/useWallet'
import { getPropertyTokenBalance } from '../services/contracts'
import Input from './ui/Input'
import Button from './ui/Button'
import { useToast } from '../hooks/useToast'

const TokenTransfer = ({ className = '' }) => {
  const { walletAddress, isSepolia } = useWallet()
  const { success, error } = useToast()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [balance, setBalance] = useState(null)

  // Load balance when component mounts or wallet changes
  useEffect(() => {
    const loadBalance = async () => {
      if (walletAddress && isSepolia) {
        try {
          const tokenBalance = await getPropertyTokenBalance(walletAddress)
          setBalance(tokenBalance)
        } catch (err) {
          console.error('Error loading balance:', err)
        }
      }
    }
    loadBalance()
  }, [walletAddress, isSepolia])

  const validateAddress = (address) => {
    if (!address) return 'Recipient address is required'
    if (!ethers.isAddress(address)) return 'Invalid Ethereum address'
    if (address.toLowerCase() === walletAddress?.toLowerCase()) {
      return 'Cannot transfer to your own address'
    }
    return null
  }

  const validateAmount = (amountValue) => {
    if (!amountValue) return 'Amount is required'
    const numAmount = parseFloat(amountValue)
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Amount must be a positive number'
    }
    if (balance !== null && numAmount > parseFloat(balance)) {
      return `Insufficient balance. You have ${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 4 })} PROP tokens`
    }
    return null
  }

  const handleTransfer = async () => {
    const addressError = validateAddress(recipientAddress)
    const amountError = validateAmount(amount)

    if (addressError) {
      error(addressError)
      return
    }

    if (amountError) {
      error(amountError)
      return
    }

    setIsTransferring(true)

    try {
      // Convert token amount to wei (18 decimals)
      const amountInWei = ethers.parseEther(amount.toString())

      // Execute transfer
      const tx = await transferPropertyTokens(recipientAddress, amountInWei)

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      if (receipt.status === 1) {
        success(
          `Successfully transferred ${parseFloat(amount).toLocaleString('en-US', { maximumFractionDigits: 4 })} PROP tokens to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`
        )
        // Reset form
        setRecipientAddress('')
        setAmount('')
        // Reload balance
        if (walletAddress) {
          const newBalance = await getPropertyTokenBalance(walletAddress)
          setBalance(newBalance)
        }
      } else {
        error('Transaction failed')
      }
    } catch (err) {
      console.error('Transfer error:', err)
      if (err.reason) {
        error(`Transfer failed: ${err.reason}`)
      } else if (err.message) {
        error(`Transfer failed: ${err.message}`)
      } else {
        error('Transfer failed. Please try again.')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  if (!walletAddress || !isSepolia) {
    return null
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer PROP Tokens</h3>
      <div className="space-y-4">
        <Input
          label="Recipient Address"
          type="text"
          placeholder="0x..."
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          helperText="Enter the Ethereum wallet address to receive tokens"
        />

        <Input
          label="Amount (PROP Tokens)"
          type="number"
          step="0.0001"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText={
            balance !== null
              ? `Your balance: ${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 4 })} PROP`
              : 'Enter the amount of tokens to transfer'
          }
        />

        <Button
          variant="primary"
          onClick={handleTransfer}
          isLoading={isTransferring}
          disabled={!recipientAddress || !amount || isTransferring}
          className="w-full"
        >
          Transfer Tokens
        </Button>

        <p className="text-xs text-gray-600">
          ⚠️ Make sure you're on Sepolia testnet. This will execute a blockchain transaction that requires gas fees.
        </p>
      </div>
    </div>
  )
}

export default TokenTransfer

