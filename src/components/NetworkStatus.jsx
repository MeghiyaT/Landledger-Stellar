
import useWallet from '../hooks/useWallet'

const NetworkStatus = () => {
  const { isSepolia, isMetaMaskInstalled, walletAddress, switchNetwork } = useWallet()

  if (!isMetaMaskInstalled || !walletAddress) {
    return null
  }

  if (isSepolia) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg h-8">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-green-700 whitespace-nowrap">Stellar Testnet</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg h-8">
      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
      <span className="text-sm font-medium text-yellow-700 whitespace-nowrap">Wrong Network</span>
      <button
        onClick={switchNetwork}
        className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors whitespace-nowrap"
      >
        Switch to Stellar
      </button>
    </div>
  )
}

export default NetworkStatus

