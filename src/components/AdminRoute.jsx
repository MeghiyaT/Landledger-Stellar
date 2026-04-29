import { useAuth, useUser } from '@clerk/clerk-react'
import { Navigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isAdmin } from '../utils/admin'

const AdminRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [userIsAdmin, setUserIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isLoaded && isSignedIn && user?.id) {
        const adminStatus = await isAdmin(user.id)
        setUserIsAdmin(adminStatus)
        setCheckingAdmin(false)
      } else if (isLoaded && !isSignedIn) {
        setCheckingAdmin(false)
      }
    }

    checkAdminStatus()
  }, [isLoaded, isSignedIn, user?.id])

  if (!isLoaded || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />
  }

  if (!userIsAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Page Not Found</h1>
          <p className="text-gray-700 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  return children
}

export default AdminRoute







