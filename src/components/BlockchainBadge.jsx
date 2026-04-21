import PropTypes from 'prop-types'
import Badge from './ui/Badge'

const BlockchainBadge = ({ property, className = '' }) => {
  if (!property?.blockchain_property_id && !property?.blockchain_tx_hash) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="success" className="flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Stellar Verified
      </Badge>
      {property.blockchain_tx_hash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${property.blockchain_tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 underline"
          title="View on StellarExpert"
        >
          Verify
        </a>
      )}
    </div>
  )
}

BlockchainBadge.propTypes = {
  property: PropTypes.shape({
    blockchain_property_id: PropTypes.string,
    blockchain_tx_hash: PropTypes.string,
  }),
  className: PropTypes.string,
}

export default BlockchainBadge
