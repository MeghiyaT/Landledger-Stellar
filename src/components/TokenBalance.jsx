import PropTypes from 'prop-types'
import useWallet from '../hooks/useWallet'
import Skeleton from './ui/Skeleton'
import TokenConversionInfo from './TokenConversionInfo'

const TokenBalance = ({ className = '' }) => {
  const { walletAddress, isTestnet, balance, isLoadingBalance } = useWallet()

  if (!walletAddress || !isTestnet) {
    return null
  }

  if (isLoadingBalance) {
    return <Skeleton width="w-24" height="h-6" className={className} />
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">XLM:</span>
        <span className="text-sm font-semibold text-primary">
          {balance ? parseFloat(balance).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          }) : '0.00'}
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
