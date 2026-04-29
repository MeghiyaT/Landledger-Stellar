import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import useAdmin from '../../hooks/useAdmin'
import useWallet from '../../hooks/useWallet'
import Button from '../ui/Button'
import Container from './Container'
import NetworkStatus from '../NetworkStatus'
import TokenBalance from '../TokenBalance'
import NotificationCenter from '../NotificationCenter'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { isAdmin } = useAdmin()
  const {
    walletAddress,
    isConnecting,
    error: walletError,
    isFreighterInstalled,
    connectWallet,
    disconnectWallet,
    formatAddress,
  } = useWallet()

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/login' })
  }

  return (
    <header className="bg-white border-b border-gray-400 sticky top-0 z-40">
      <Container>
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center -ml-16">
            <span className="text-2xl font-bold text-primary">LandLedger</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6">
            <Link
              to="/properties"
              className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
            >
              Explore
            </Link>
            <Link
              to="/sell-property"
              className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
            >
              Sell
            </Link>
            <Link
              to="/registration"
              className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
            >
              Register
            </Link>
            {isSignedIn && (
              <Link
                to="/dashboard"
                className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
              >
                Dashboard
              </Link>
            )}
            {isSignedIn && isAdmin && (
              <Link
                to="/admin"
                className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
              >
                Admin
              </Link>
            )}
            <Link
              to="/about"
              className="text-sm lg:text-base text-gray-700 hover:text-primary transition-colors duration-200"
            >
              About
            </Link>
            {/* Separator */}
            {isSignedIn && <div className="h-6 w-px bg-gray-300"></div>}
            
            {/* Wallet Section */}
            {isSignedIn && (
              walletAddress ? (
                <div className="flex items-center gap-3">
                  {/* Network Status */}
                  <div className="flex-shrink-0">
                    <NetworkStatus />
                  </div>
                  {/* Token Balance */}
                  <div className="flex-shrink-0">
                    <TokenBalance />
                  </div>
                  {/* Wallet Address and Disconnect */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-gray-600 font-mono whitespace-nowrap">
                      {formatAddress(walletAddress)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnectWallet}
                      className="text-xs whitespace-nowrap"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connectWallet}
                  disabled={isConnecting || !isFreighterInstalled}
                  isLoading={isConnecting}
                >
                      {isFreighterInstalled ? 'Connect Wallet' : 'Install Freighter'}
                </Button>
              )
            )}
            
            {/* Separator */}
            <div className="h-6 w-px bg-gray-300"></div>
            
            {/* Notification Center */}
            {isSignedIn && (
              <div className="flex-shrink-0">
                <NotificationCenter />
              </div>
            )}

            {/* User Section */}
            {isSignedIn ? (
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="text-gray-700 hover:text-red-600 transition-colors duration-200 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                >
                  Register
                </Button>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-400">
            <nav className="flex flex-col space-y-4">
              <Link
                to="/properties"
                className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Explore
              </Link>
              <Link
                to="/sell-property"
                className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Sell
              </Link>
              <Link
                to="/registration"
                className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Register
              </Link>
              <Link
                to="/about"
                className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              {/* Wallet Connect Button (Mobile) */}
              {isSignedIn && (
                <div className="py-2 border-b border-gray-200">
                  {walletAddress ? (
                    <div className="flex flex-col space-y-2">
                      <span className="text-sm text-gray-600 font-mono">
                        {formatAddress(walletAddress)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          disconnectWallet()
                          setIsMenuOpen(false)
                        }}
                      >
                        Disconnect Wallet
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        connectWallet()
                        setIsMenuOpen(false)
                      }}
                      disabled={isConnecting || !isFreighterInstalled}
                      isLoading={isConnecting}
                      className="w-full"
                    >
                          {isFreighterInstalled ? 'Connect Wallet' : 'Install Freighter'}
                    </Button>
                  )}
                  {walletError && (
                    <p className="text-xs text-red-600 mt-1">{walletError}</p>
                  )}
                </div>
              )}
              {isSignedIn ? (
                <>
                  <div className="py-2 border-b border-gray-100 px-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Notifications</span>
                      <NotificationCenter />
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="text-base text-gray-700 hover:text-primary transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleSignOut()
                      setIsMenuOpen(false)
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col space-y-2 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigate('/login')
                      setIsMenuOpen(false)
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      navigate('/register')
                      setIsMenuOpen(false)
                    }}
                  >
                    Register
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </Container>
    </header>
  )
}

export default Header
