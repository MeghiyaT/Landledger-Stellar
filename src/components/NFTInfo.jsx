
import Card from './ui/Card'
import Badge from './ui/Badge'
import Button from './ui/Button'

const NFTInfo = ({ property }) => {
  // Check if property has NFT
  if (!property?.nft_token_id && !property?.nft_contract_address) {
    return null
  }

  const getStellarExpertUrl = (address, type = 'account') => {
    const baseUrl = 'https://stellar.expert/explorer/testnet'
    if (type === 'address' || type === 'token') type = 'account'
    return `${baseUrl}/${type}/${address}`
  }

  const getIPFSGatewayUrl = (ipfsHash) => {
    if (!ipfsHash) return null
    const cleanHash = ipfsHash.replace(/^ipfs:\/\//, '')
    return `https://gateway.pinata.cloud/ipfs/${cleanHash}`
  }

  return (
    <Card padding="md" className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-xl font-semibold">NFT Certificate</h3>
        <Badge variant="success">ERC-721</Badge>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        This property has been minted as an NFT (Non-Fungible Token) on the blockchain. 
        The NFT serves as a digital certificate of ownership.
      </p>

      <div className="space-y-4">
        {/* Token ID */}
        {property.nft_token_id && (
          <div className="p-3 bg-gray-50 rounded border">
            <p className="text-xs text-gray-600 mb-1">Token ID</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono font-semibold">{property.nft_token_id}</p>
              {property.nft_contract_address && (
                <a
                  href={getStellarExpertUrl(property.nft_contract_address, 'token')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  View on StellarExpert →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Contract Address */}
        {property.nft_contract_address && (
          <div className="p-3 bg-gray-50 rounded border">
            <p className="text-xs text-gray-600 mb-1">NFT Contract Address</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono break-all">{property.nft_contract_address}</p>
              <a
                href={getStellarExpertUrl(property.nft_contract_address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex-shrink-0"
              >
                View →
              </a>
            </div>
          </div>
        )}

        {/* Token URI (IPFS) */}
        {property.nft_token_uri && (
          <div className="p-3 bg-gray-50 rounded border">
            <p className="text-xs text-gray-600 mb-1">Metadata (IPFS)</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono break-all text-gray-800">
                {property.nft_token_uri.length > 50 
                  ? `${property.nft_token_uri.substring(0, 50)}...` 
                  : property.nft_token_uri}
              </p>
              {property.nft_token_uri.startsWith('ipfs://') && (
                <a
                  href={getIPFSGatewayUrl(property.nft_token_uri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex-shrink-0"
                >
                  View IPFS →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Mint Transaction */}
        {property.nft_mint_tx_hash && (
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="text-xs text-gray-600 mb-1">Mint Transaction</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono break-all text-gray-800">
                {property.nft_mint_tx_hash.substring(0, 20)}...
              </p>
              <a
                href={getStellarExpertUrl(property.nft_mint_tx_hash, 'tx')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex-shrink-0"
              >
                View →
              </a>
            </div>
          </div>
        )}

        {/* Transfer Transaction (if transferred) */}
        {property.nft_transfer_tx_hash && (
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-gray-600 mb-1">Transfer Transaction</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono break-all text-gray-800">
                {property.nft_transfer_tx_hash.substring(0, 20)}...
              </p>
              <a
                href={getStellarExpertUrl(property.nft_transfer_tx_hash, 'tx')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex-shrink-0"
              >
                View →
              </a>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          {property.nft_contract_address && property.nft_token_id && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.open(getStellarExpertUrl(property.nft_contract_address, 'token'), '_blank')
              }}
            >
              View NFT on StellarExpert
            </Button>
          )}
          {property.nft_token_uri && property.nft_token_uri.startsWith('ipfs://') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.open(getIPFSGatewayUrl(property.nft_token_uri), '_blank')
              }}
            >
              View Metadata on IPFS
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default NFTInfo

