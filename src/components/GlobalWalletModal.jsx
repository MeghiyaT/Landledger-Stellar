import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'

const GlobalWalletModal = () => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleShowAlert = () => setIsOpen(true)
    window.addEventListener('showWalletNetworkAlert', handleShowAlert)
    return () => window.removeEventListener('showWalletNetworkAlert', handleShowAlert)
  }, [])

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Switch Network"
    >
      <div className="py-4 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">Switch to Testnet</h3>
        <p className="text-gray-600 mb-6">
          Please open your Freighter wallet extension and manually switch the network to <strong>TESTNET</strong> to continue using LandLedger.
        </p>
        <Button variant="primary" className="w-full" onClick={() => setIsOpen(false)}>
          Got it
        </Button>
      </div>
    </Modal>
  )
}

export default GlobalWalletModal
