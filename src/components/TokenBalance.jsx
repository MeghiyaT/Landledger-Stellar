import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { getPropertyTokenBalance } from '../services/contracts'
import useWallet from '../hooks/useWallet'
import Skeleton from './ui/Skeleton'
import TokenConversionInfo from './TokenConversionInfo'

const TokenBalance = ({ className = '' }) => {
  const { walletAddress, isSepolia } = useWallet()
  const [balance, setBalance] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadBalance = async () => {
      if (!walletAddress || !isSepolia) {
        setBalance(null)
        return
      }

      setIsLoading(true)
      try {
        const tokenBalance = await getPropertyTokenBalance(walletAddress)
        setBalance(tokenBalance)
      } catch (error) {
        console.error('Error loading token balance:', error)
        setBalance(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadBalance()
  }, [walletAddress, isSepolia])

  if (!walletAddress || !isSepolia) {
    return null
  }

  if (isLoading) {
    return <Skeleton width="w-24" height="h-6" className={className} />
  }

  if (balance === null) {
    return null
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">XLM:</span>
        <span className="text-sm font-semibold text-primary">
          {parseFloat(balance).toLocaleString('en-US', {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <TokenConversionInfo variant="compact" />
    </div>
  )
}

TokenBalance.propTypes = {
  className: PropTypes.string,
}

export default TokenBalance
