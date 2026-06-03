import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { getPropertyOwnershipHistory } from '../services/contracts'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'

const BlockchainOwnershipHistory = ({ property, className = '' }) => {
  const [ownershipHistory, setOwnershipHistory] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadOwnershipHistory = async () => {
      // We now query by property UUID, not blockchain_property_id
      if (!property?.id) {
        setOwnershipHistory(null)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const history = await getPropertyOwnershipHistory(property.id)

        // The service already returns formatted data
        const formattedHistory = history.map((entry) => ({
          id: entry.id,
          previousOwner: entry.previousOwner,
          newOwner: entry.newOwner,
          timestamp: new Date(entry.timestamp),
          transferType: entry.transferType,
          blockchainTxHash: entry.blockchainTxHash,
          nftTransferTxHash: entry.nftTransferTxHash,
        }))

        setOwnershipHistory(formattedHistory)
      } catch (err) {
        console.error('Error loading ownership history:', err)
        setError('Failed to load ownership history')
      } finally {
        setIsLoading(false)
      }
    }

    loadOwnershipHistory()
  }, [property?.id])

  // Show the component if the property exists (don't require blockchain_property_id)
  if (!property?.id) {
    return null
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton height="h-20" className="mb-2" />
        <Skeleton height="h-20" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 ${className}`}>
        {error}
      </div>
    )
  }

  if (!ownershipHistory || ownershipHistory.length === 0) {
    return (
      <div className={`p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 ${className}`}>
        No ownership transfers recorded on blockchain yet
      </div>
    )
  }

  const truncateAddress = (addr) => {
    if (!addr || addr.length < 10) return addr || '—'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Blockchain Ownership History
      </h4>
      <div className="space-y-3">
        {ownershipHistory.map((entry) => (
          <div key={entry.id} className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="primary" className="text-xs">
                {entry.transferType}
              </Badge>
              <span className="text-xs text-gray-600">
                {entry.timestamp.toLocaleString()}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-600">From: </span>
                <span className="font-mono text-xs text-gray-800">
                  {truncateAddress(entry.previousOwner)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">To: </span>
                <span className="font-mono text-xs text-gray-800">
                  {truncateAddress(entry.newOwner)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {entry.blockchainTxHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${entry.blockchainTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Escrow Tx ↗
                </a>
              )}
              {entry.nftTransferTxHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${entry.nftTransferTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  NFT Deed Tx ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        This ownership history is permanently recorded on the Stellar Testnet and cannot be altered.
      </p>
    </div>
  )
}

BlockchainOwnershipHistory.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.string,
    blockchain_property_id: PropTypes.string,
  }),
  className: PropTypes.string,
}

export default BlockchainOwnershipHistory
