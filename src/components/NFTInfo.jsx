import { useState, useEffect } from 'react'

const NFTInfo = ({ property }) => {
  const [ipfsMetadata, setIpfsMetadata] = useState(null)
  const [ipfsLoading, setIpfsLoading] = useState(false)

  const hasNFT = property?.nft_token_id && property?.nft_contract_address
  const hasIPFS = property?.nft_token_uri?.startsWith('ipfs://') || property?.ipfs_metadata_cid

  // Resolve the best IPFS CID we have
  const ipfsCid = property?.ipfs_metadata_cid ||
    property?.nft_token_uri?.replace(/^ipfs:\/\//, '') || null

  const gatewayUrl = ipfsCid
    ? `https://gateway.pinata.cloud/ipfs/${ipfsCid}`
    : null

  const stellarExpertTx = (hash) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`
  const stellarExpertContract = (addr) =>
    `https://stellar.expert/explorer/testnet/contract/${addr}`

  // Fetch IPFS metadata JSON for preview
  useEffect(() => {
    if (!gatewayUrl) return
    setIpfsLoading(true)
    fetch(gatewayUrl)
      .then(r => r.ok ? r.json() : null)
      .then(data => setIpfsMetadata(data))
      .catch(() => setIpfsMetadata(null))
      .finally(() => setIpfsLoading(false))
  }, [gatewayUrl])

  if (!hasNFT && !hasIPFS) return null

  return (
    <div style={{ margin: '24px 0' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Blockchain Verification</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: hasNFT && hasIPFS ? '1fr 1fr' : '1fr', gap: '16px' }}>

        {/* NFT Card */}
        {hasNFT && (
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
            borderRadius: '16px', padding: '20px', color: 'white', position: 'relative', overflow: 'hidden'
          }}>
            {/* Background decoration */}
            <div style={{
              position: 'absolute', top: '-20px', right: '-20px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-30px', left: '-10px',
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)'
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎫</span>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>Property NFT</span>
              </div>
              <span style={{
                background: 'rgba(167,139,250,0.3)', border: '1px solid rgba(167,139,250,0.5)',
                padding: '2px 10px', borderRadius: '100px', fontSize: '11px',
                fontWeight: '700', letterSpacing: '0.05em', color: '#c4b5fd'
              }}>SEP-50</span>
            </div>

            {/* Token ID big display */}
            <div style={{
              background: 'rgba(255,255,255,0.08)', borderRadius: '12px',
              padding: '12px 16px', marginBottom: '12px'
            }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Token ID</p>
              <p style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                #{property.nft_token_id}
              </p>
            </div>

            {/* Contract */}
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Contract</p>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', margin: 0, wordBreak: 'break-all' }}>
                {property.nft_contract_address.slice(0, 16)}...{property.nft_contract_address.slice(-8)}
              </p>
            </div>

            {/* Mint TX */}
            {property.nft_mint_tx_hash && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mint Transaction</p>
                <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                  {property.nft_mint_tx_hash.slice(0, 20)}...
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={stellarExpertContract(property.nft_contract_address)}
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white', padding: '7px 14px', borderRadius: '8px',
                  fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                StellarExpert
              </a>
              {property.nft_mint_tx_hash && (
                <a
                  href={stellarExpertTx(property.nft_mint_tx_hash)}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.8)', padding: '7px 14px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  View Mint Tx ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* IPFS Card */}
        {hasIPFS && (
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            borderRadius: '16px', padding: '20px', color: 'white', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', top: '-20px', right: '-20px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)'
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>IPFS Metadata</span>
              </div>
              <span style={{
                background: 'rgba(52,211,153,0.3)', border: '1px solid rgba(52,211,153,0.5)',
                padding: '2px 10px', borderRadius: '100px', fontSize: '11px',
                fontWeight: '700', color: '#6ee7b7'
              }}>PINNED</span>
            </div>

            {/* Metadata preview */}
            {ipfsLoading ? (
              <div style={{
                background: 'rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '12px 16px', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <div style={{
                  width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Loading metadata...</span>
              </div>
            ) : ipfsMetadata ? (
              <div style={{
                background: 'rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '12px 16px', marginBottom: '12px'
              }}>
                {ipfsMetadata.title && (
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stored Title</p>
                    <p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{ipfsMetadata.title}</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  {ipfsMetadata.type && (
                    <div>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 2px', textTransform: 'uppercase' }}>Type</p>
                      <p style={{ fontSize: '12px', margin: 0, fontWeight: '600' }}>{ipfsMetadata.type}</p>
                    </div>
                  )}
                  {ipfsMetadata.sqft && (
                    <div>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 2px', textTransform: 'uppercase' }}>Size</p>
                      <p style={{ fontSize: '12px', margin: 0, fontWeight: '600' }}>{ipfsMetadata.sqft} sqft</p>
                    </div>
                  )}
                  {ipfsMetadata.blockchainTxHash && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 2px', textTransform: 'uppercase' }}>Embedded Tx Hash</p>
                      <p style={{ fontSize: '10px', fontFamily: 'monospace', margin: 0, color: 'rgba(255,255,255,0.7)' }}>
                        {ipfsMetadata.blockchainTxHash.slice(0, 24)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '12px 16px', marginBottom: '12px'
              }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Metadata stored on IPFS</p>
              </div>
            )}

            {/* CID */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Content ID (CID)</p>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', margin: 0, wordBreak: 'break-all' }}>
                {ipfsCid?.slice(0, 20)}...{ipfsCid?.slice(-8)}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {gatewayUrl && (
                <a
                  href={gatewayUrl}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', padding: '7px 14px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  View on IPFS
                </a>
              )}
              {ipfsCid && (
                <button
                  onClick={() => navigator.clipboard.writeText(ipfsCid)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.8)', padding: '7px 14px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  title="Copy CID to clipboard"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                  Copy CID
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default NFTInfo
