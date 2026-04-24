import { useState } from 'react'
import { sendTransaction } from '../lib/web3'
import useWallet from '../hooks/useWallet'
import Input from './ui/Input'
import Button from './ui/Button'
import { useToast } from '../hooks/useToast'

/**
 * TokenTransfer component for sending native XLM tokens on Stellar Testnet
 */
const TokenTransfer = ({ className = '' }) => {
  const { walletAddress, isTestnet, balance, loadBalance } = useWallet()
  const { success, error } = useToast()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)

  const validateAddress = (address) => {
    if (!address) return 'Recipient address is required'
    // Basic Stellar address validation (starts with G, 56 characters)
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      return 'Invalid Stellar address'
    }
    if (address === walletAddress) {
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
      return `Insufficient balance. You have ${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 7 })} XLM`
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
      success('Initiating transfer in Freighter...')
      
      // Execute transfer using the web3 helper
      const hash = await sendTransaction(recipientAddress, amount)

      if (hash) {
        success(
          `Successfully transferred ${parseFloat(amount).toLocaleString('en-US', { maximumFractionDigits: 4 })} XLM to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`
        )
        // Reset form
        setRecipientAddress('')
        setAmount('')
        
        // Reload balance
        setTimeout(() => {
          loadBalance()
        }, 2000)
      } else {
        error('Transaction failed or was rejected')
      }
    } catch (err) {
      console.error('Transfer error:', err)
      error(`Transfer failed: ${err.message || 'Please try again'}`)
    } finally {
      setIsTransferring(false)
    }
  }

  if (!walletAddress || !isTestnet) {
    return null
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer XLM Tokens</h3>
      <div className="space-y-4">
        <Input
          label="Recipient Stellar Address"
          type="text"
          placeholder="G..."
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          helperText="Enter the Stellar public key to receive tokens"
        />

        <Input
          label="Amount (XLM)"
          type="number"
          step="0.0000001"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText={
            balance !== null
              ? `Your balance: ${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 7 })} XLM`
              : 'Enter the amount of XLM to transfer'
          }
        />

        <Button
          variant="primary"
          onClick={handleTransfer}
          isLoading={isTransferring}
          disabled={!recipientAddress || !amount || isTransferring}
          className="w-full"
        >
          Transfer XLM
        </Button>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            ℹ️ You are on Stellar Testnet. This will execute a real blockchain transaction. 
            XLM is the native currency of the Stellar network.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TokenTransfer
