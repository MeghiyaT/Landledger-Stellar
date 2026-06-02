import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Properties from './pages/Properties'
import PropertyDetails from './pages/PropertyDetails'
import Registration from './pages/Registration'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import SellProperty from './pages/SellProperty'
import VerifyCertificate from './pages/VerifyCertificate'
import VerifyCertificatePDF from './pages/VerifyCertificatePDF'
import About from './pages/About'
import NotFound from './pages/NotFound'
import AdminRoute from './components/AdminRoute'
import GlobalWalletModal from './components/GlobalWalletModal'
import { setClerkTokenGetter } from './lib/supabase'

// Get Clerk publishable key from environment variables
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const SupabaseClerkTokenBridge = ({ children }) => {
  const { getToken } = useAuth()

  useEffect(() => {
    // Pass the getToken function itself, not the result of calling it
    setClerkTokenGetter(getToken)
    return () => setClerkTokenGetter(null)
  }, [getToken])

  return <>{children}</>
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
          <p className="text-gray-700">
            Please add VITE_CLERK_PUBLISHABLE_KEY to your .env file
          </p>
        </div>
      </div>
    )
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        variables: { colorPrimary: '#2563eb' }
      }}
    >
      <SupabaseClerkTokenBridge>
        <Router>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyDetails />} />
                <Route
                  path="/registration"
                  element={
                    <ProtectedRoute>
                      <Registration />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login/*" element={<Login />} />
                <Route path="/register/*" element={<Register />} />
                <Route
                  path="/sell-property"
                  element={
                    <ProtectedRoute>
                      <SellProperty />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route path="/about" element={<About />} />
                <Route path="/verify/:registrationId" element={<VerifyCertificate />} />
                <Route path="/verify-certificate" element={<VerifyCertificatePDF />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
        <GlobalWalletModal />
      </SupabaseClerkTokenBridge>
    </ClerkProvider>
  )
}

export default App

