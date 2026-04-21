import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { getRegistrations, deleteRegistration, generateRegistrationCertificate } from '../services/registrations'
import { getSavedProperties, getUserProfile, updateUserProfile, uploadProfileDocument } from '../services/user'
import { getUserProperties, getPurchasedProperties, getSoldProperties, deleteProperty, updateProperty } from '../services/properties'
import { getInquiriesByUserId, updateInquiryStatus, getInquiryReplies, createInquiryReply } from '../services/inquiries'
import { getTransactions } from '../services/transactions'
import { getOffersBySellerId, getOffersByBuyerId, updateOfferStatus, acceptOfferAndCreateTransaction } from '../services/offers'
import { updateTransactionStatus } from '../services/transactions'
import { createEscrowTransaction } from '../services/escrow'
import { downloadRegistrationCertificate } from '../utils/pdfGenerator'
import useWallet from '../hooks/useWallet'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import Skeleton from '../components/ui/Skeleton'
import Toast from '../components/ui/Toast'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'
import { useToast } from '../hooks/useToast'
import Modal from '../components/ui/Modal'
import { PROPERTY_PLACEHOLDER, getSafeImageUrl } from '../utils/placeholders'
import TokenBalance from '../components/TokenBalance'
import BlockchainBadge from '../components/BlockchainBadge'
import TokenConversionInfo from '../components/TokenConversionInfo'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, isLoaded } = useUser()
  const { toasts, success, error, removeToast } = useToast()
  
  // Load active tab from localStorage, default to 3 (Profile)
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('dashboardActiveTab')
    return savedTab !== null ? parseInt(savedTab, 10) : 3 // Default to Profile (index 3)
  })
  const [isLoading, setIsLoading] = useState(true)
  const [savedProperties, setSavedProperties] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [myProperties, setMyProperties] = useState([])
  const [purchasedProperties, setPurchasedProperties] = useState([])
  const [soldProperties, setSoldProperties] = useState([])
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null, title: null, status: null })
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState('all')
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all')
  const [inquiries, setInquiries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [_userProfile, setUserProfile] = useState(null)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [inquiriesModalOpen, setInquiriesModalOpen] = useState(false)
  const [selectedInquiry, setSelectedInquiry] = useState(null)
  const [inquiryReplies, setInquiryReplies] = useState([])
  const [replyMessage, setReplyMessage] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [offers, setOffers] = useState([])
  const [myOffers, setMyOffers] = useState([])
  const { walletAddress } = useWallet()
  const [uploadingAadhar, setUploadingAadhar] = useState(false)
  const [uploadingPan, setUploadingPan] = useState(false)
  const [profileDocuments, setProfileDocuments] = useState({ aadharCard: null, panCard: null })

  const loadData = async () => {
    if (!user?.id) return
    
    setIsLoading(true)
    try {
      const [savedPropsResult, registrationsResult, propertiesResult, purchasedPropsResult, soldPropsResult, inquiriesResult, transactionsResult, profileResult, offersResult, myOffersResult] = await Promise.all([
        getSavedProperties(user.id),
        getRegistrations(user.id, { status: 'all' }), // Load all initially, filter is handled by useEffect
        getUserProperties(user.id),
        getPurchasedProperties(user.id),
        getSoldProperties(user.id),
        getInquiriesByUserId(user.id),
        getTransactions(user.id, { limit: 50 }),
        getUserProfile(user.id),
        getOffersBySellerId(user.id), // Offers on my properties (as seller)
        getOffersByBuyerId(user.id), // My offers (as buyer)
      ])
      
      if (savedPropsResult.data) {
        const allSavedProperties = savedPropsResult.data.map(item => item.properties).filter(Boolean)
        
        // Filter out purchased properties from saved properties
        const purchasedPropertyIds = new Set(
          purchasedPropsResult.data?.map(p => p.id) || []
        )
        
        const filteredSavedProperties = allSavedProperties.filter(
          property => !purchasedPropertyIds.has(property.id)
        )
        
        console.log('Filtered saved properties:', {
          total: allSavedProperties.length,
          purchased: purchasedPropertyIds.size,
          remaining: filteredSavedProperties.length
        })
        
        setSavedProperties(filteredSavedProperties)
      } else {
        setSavedProperties([])
      }
      
      if (registrationsResult.data) {
        setRegistrations(registrationsResult.data)
      } else {
        setRegistrations([])
      }
      
      if (propertiesResult.data) {
        console.log('Loaded properties:', propertiesResult.data)
        setMyProperties(propertiesResult.data)
      } else {
        console.log('No properties found, setting empty array')
        setMyProperties([])
      }

      if (purchasedPropsResult.data) {
        console.log('Loaded purchased properties:', purchasedPropsResult.data)
        console.log('Purchased properties count:', purchasedPropsResult.data.length)
        console.log('Purchased properties details:', purchasedPropsResult.data.map(p => ({
          id: p.id,
          title: p.title,
          sold_to: p.sold_to,
          user_id: p.user_id,
          sold_at: p.sold_at
        })))
        setPurchasedProperties(purchasedPropsResult.data)
      } else {
        console.log('No purchased properties found, setting empty array')
        console.log('Purchased properties error:', purchasedPropsResult.error)
        setPurchasedProperties([])
      }

      if (soldPropsResult.data) {
        console.log('Loaded sold properties:', soldPropsResult.data)
        console.log('Sold properties count:', soldPropsResult.data.length)
        setSoldProperties(soldPropsResult.data)
      } else {
        console.log('No sold properties found, setting empty array')
        setSoldProperties([])
      }

      if (inquiriesResult.data) {
        setInquiries(inquiriesResult.data)
      } else {
        setInquiries([])
      }

      if (transactionsResult.data) {
        console.log('Initial transactions loaded:', transactionsResult.data)
        console.log('Transaction count:', transactionsResult.data.length)
        console.log('User ID used for query:', user.id)
        console.log('Transaction user IDs:', transactionsResult.data.map(t => t.user_id))
        setTransactions(transactionsResult.data)
      } else {
        console.log('No transactions found or error:', transactionsResult.error)
        console.log('Error details:', {
          code: transactionsResult.error?.code,
          message: transactionsResult.error?.message,
          details: transactionsResult.error?.details,
          hint: transactionsResult.error?.hint
        })
        console.log('User ID used for query:', user.id)
        setTransactions([])
      }

      if (profileResult.data) {
        setUserProfile(profileResult.data)
        setProfileDocuments({
          aadharCard: profileResult.data.aadhar_card ? { url: profileResult.data.aadhar_card, name: 'Aadhar Card' } : null,
          panCard: profileResult.data.pan_card ? { url: profileResult.data.pan_card, name: 'PAN Card' } : null,
        })
      }

      if (offersResult.data) {
        setOffers(offersResult.data)
      } else {
        setOffers([])
      }

      if (myOffersResult.data) {
        setMyOffers(myOffersResult.data)
      } else {
        setMyOffers([])
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Reload registrations when filter changes
  useEffect(() => {
    if (user?.id && activeTab === 1) {
      const loadFilteredRegistrations = async () => {
        setIsLoading(true)
        try {
          const { data: registrationData, error: registrationError } = await getRegistrations(user.id, { 
            status: registrationStatusFilter !== 'all' ? registrationStatusFilter : undefined 
          })
          if (!registrationError && registrationData) {
            setRegistrations(registrationData)
          } else {
            setRegistrations([])
          }
        } catch (err) {
          console.error('Error loading filtered registrations:', err)
          setRegistrations([])
        } finally {
          setIsLoading(false)
        }
      }
      loadFilteredRegistrations()
    }
  }, [registrationStatusFilter, activeTab, user?.id])


  useEffect(() => {
    if (isLoaded && user?.id) {
      loadData()
    }
  }, [isLoaded, user?.id])

  const handleDelete = async () => {
    if (!deleteModal.id || !deleteModal.type) return

    try {
      if (deleteModal.type === 'registration') {
        const { error: deleteError } = await deleteRegistration(deleteModal.id, user.id)
        if (deleteError) {
          error(deleteModal.status === 'approved' || deleteModal.status === 'rejected'
            ? 'Failed to remove registration. Please try again.'
            : 'Failed to cancel registration. Please try again.')
          setDeleteModal({ open: false, type: null, id: null, title: null, status: null })
        } else {
          success(deleteModal.status === 'approved' || deleteModal.status === 'rejected'
            ? 'Registration removed successfully'
            : 'Registration cancelled successfully')
          setDeleteModal({ open: false, type: null, id: null, title: null, status: null })
          // Reload data to ensure UI matches server state
          await loadData()
        }
      } else if (deleteModal.type === 'property') {
        console.log('Deleting property:', deleteModal.id)
        const { error: deleteError, data: deleteData } = await deleteProperty(deleteModal.id)
        if (deleteError) {
          console.error('Delete error details:', deleteError)
          error(`Failed to remove property: ${deleteError.message || 'Please check console for details'}`)
          setDeleteModal({ open: false, type: null, id: null, title: null, status: null })
        } else {
          console.log('Delete successful, data:', deleteData)
          // Immediately remove from local state for instant feedback
          setMyProperties(prev => prev.filter(p => p.id !== deleteModal.id))
          success('Property removed successfully')
          setDeleteModal({ open: false, type: null, id: null, title: null, status: null })
          // Reload data from server to ensure consistency
          setTimeout(async () => {
            await loadData()
          }, 500)
        }
      }
    } catch (err) {
      console.error('Delete error:', err)
      error('An error occurred. Please try again.')
      setDeleteModal({ open: false, type: null, id: null, title: null, status: null })
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { variant: 'warning', label: 'Pending' },
      in_review: { variant: 'primary', label: 'In Review' },
      approved: { variant: 'success', label: 'Approved' },
      rejected: { variant: 'error', label: 'Rejected' },
    }
    const statusInfo = statusMap[status] || statusMap.pending
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const getPropertyStatusBadge = (property) => {
    // Check if property is removed
    if (property.removed_at || (property.status === 'paused' && property.removed_by)) {
      return <Badge variant="error">Removed by Admin</Badge>
    }
    
    const statusMap = {
      active: { variant: 'success', label: 'Active' },
      paused: { variant: 'warning', label: 'Paused' },
      sold: { variant: 'primary', label: 'Sold' },
      rented: { variant: 'secondary', label: 'Rented' },
    }
    const status = property.status || 'active'
    const statusInfo = statusMap[status] || statusMap.active
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }
  
  const isPropertyRemoved = (property) => {
    return property.removed_at || (property.status === 'paused' && property.removed_by)
  }

  const handleDownloadCertificate = async (registration) => {
    try {
      if (registration.status !== 'approved') {
        error('Only approved registrations can download certificates')
        return
      }

      const { data, error: certError } = await generateRegistrationCertificate(registration.id, user.id)
      if (certError || !data) {
        error('Failed to generate certificate')
        return
      }

      await downloadRegistrationCertificate(data)
      success('Certificate downloaded successfully')
    } catch (err) {
      console.error('Error downloading certificate:', err)
      error('Failed to download certificate')
    }
  }

  const handleUpdatePropertyStatus = async (propertyId, newStatus) => {
    try {
      const { error: updateError } = await updateProperty(propertyId, { status: newStatus })
      if (updateError) {
        error('Failed to update property status')
        return
      }
      success(`Property marked as ${newStatus}`)
      await loadData()
    } catch (err) {
      console.error('Error updating property status:', err)
      error('An error occurred')
    }
  }

  const loadInquiryReplies = async (inquiryId) => {
    try {
      const { data: repliesData, error: repliesError } = await getInquiryReplies(inquiryId)
      if (!repliesError && repliesData) {
        setInquiryReplies(repliesData)
      } else {
        setInquiryReplies([])
      }
    } catch (err) {
      console.error('Error loading replies:', err)
      setInquiryReplies([])
    }
  }

  const handleSendReply = async (inquiryId) => {
    if (!replyMessage.trim()) {
      error('Please enter a message')
      return
    }

    if (!user?.id) {
      error('You must be logged in to send a reply')
      return
    }

    setIsSendingReply(true)
    try {
      const { error: replyError } = await createInquiryReply({
        inquiry_id: inquiryId,
        sender_id: user.id,
        sender_type: 'owner',
        message: replyMessage.trim()
      })

      if (replyError) {
        console.error('Reply error details:', replyError)
        let errorMessage = 'Failed to send reply. Please try again.'
        
        if (replyError.code === '42501' || replyError.message?.includes('row-level security') || replyError.message?.includes('RLS') || replyError.message?.includes('policy')) {
          errorMessage = 'Permission denied. Please run fix-inquiry-replies-rls.sql in Supabase SQL Editor to disable RLS for replies.'
        } else if (replyError.message) {
          errorMessage = `Failed to send reply: ${replyError.message}`
          if (replyError.code) {
            errorMessage += ` (Error code: ${replyError.code})`
          }
        }
        
        error(errorMessage)
        return
      }

      success('Reply sent successfully!')
      setReplyMessage('')
      // Reload replies immediately
      await loadInquiryReplies(inquiryId)
      // Reload inquiries to update status
      await loadData()
      // Note: Auto-refresh will continue polling, so new messages will appear automatically
    } catch (err) {
      console.error('Error sending reply:', err)
      error('An error occurred while sending the reply')
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleViewInquiry = async (inquiry) => {
    if (selectedInquiry?.id === inquiry.id) {
      // If already viewing this inquiry, hide it
      setSelectedInquiry(null)
      setInquiryReplies([])
    } else {
      // Show this inquiry
      setSelectedInquiry(inquiry)
      await loadInquiryReplies(inquiry.id)
    }
  }

  // Auto-refresh replies when viewing an inquiry
  useEffect(() => {
    if (!selectedInquiry?.id) return

    // Load replies immediately
    const refreshReplies = () => {
      loadInquiryReplies(selectedInquiry.id)
    }
    
    refreshReplies()

    // Set up polling to refresh replies every 3 seconds
    const interval = setInterval(refreshReplies, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInquiry?.id])

  const handleUpdateInquiryStatus = async (inquiryId, newStatus) => {
    try {
      const { error: updateError } = await updateInquiryStatus(inquiryId, newStatus)
      if (updateError) {
        error('Failed to update inquiry status')
        return
      }
      success('Inquiry status updated')
      await loadData()
    } catch (err) {
      console.error('Error updating inquiry status:', err)
      error('An error occurred')
    }
  }

  const handleOfferAction = async (offerId, action) => {
    try {
      // If accepting, create transaction
      if (action === 'accepted') {
        const { data, error: acceptError } = await acceptOfferAndCreateTransaction(offerId, user.id)
        if (acceptError) {
          console.error('Offer acceptance error:', acceptError)
          // Check if it's a transaction creation error
          if (acceptError.transactionErrors) {
            error(`Offer accepted but transaction creation failed. Please check console for details or run fix-transactions-rls.sql`)
            console.error('Transaction creation errors:', acceptError.transactionErrors)
          } else {
            error(`Failed to accept offer: ${acceptError.message || 'Please try again'}`)
          }
          // Still reload data to show updated offer status
          await loadData()
          return
        }
        // Check if transactions were actually created
        if (data?.buyerTransaction || data?.sellerTransaction) {
          success('Offer accepted! Transaction has been created. You can now proceed with the transaction.')
        } else {
          console.warn('Offer accepted but transactions may not have been created. Check console for errors.')
          error('Offer accepted but transaction creation may have failed. Please check console and run fix-transactions-rls.sql if needed.')
        }
        // Reload all data including transactions with a small delay to ensure DB has updated
        setTimeout(async () => {
          await loadData()
        }, 500)
      } else {
        // For reject/withdraw, use regular update
        const { error: updateError } = await updateOfferStatus(offerId, action, user.id)
        if (updateError) {
          error(`Failed to ${action} offer`)
          return
        }
        success(`Offer ${action} successfully`)
        await loadData()
      }
    } catch (err) {
      console.error('Error updating offer:', err)
      error('An error occurred')
    }
  }

  const handleCreateEscrowAndPay = async (transaction) => {
    if (!walletAddress) {
      error('Please connect your Freighter wallet to pay with XLM.')
      return
    }
    try {
      success('Initiating escrow transaction in Freighter...')
      
      const response = await createEscrowTransaction(
        transaction.property_id,
        transaction.metadata?.seller_id,
        transaction.metadata?.buyer_id || user.id,
        transaction.amount,
        30,
        transaction.id
      )
      
      if (response.error) {
        error(`Failed to lock funds: ${response.error.message}`)
        return
      }
      
      success('Funds successfully locked in escrow!')
      await loadData()
    } catch (err) {
      console.error('Error creating escrow:', err)
      error('An error occurred during payment.')
    }
  }

  const handleTransactionStatusUpdate = async (transactionId, newStatus) => {
    if (!user?.id) {
      error('You must be logged in to update transaction status')
      return
    }

    // Special handling for completing transactions with escrow
    if (newStatus === 'completed') {
      // Get transaction details first to check if it has escrow
      const transaction = transactions.find(t => t.id === transactionId)
      if (transaction?.metadata?.escrow_transaction_id || transaction?.currency === 'XLM') {
        // Show confirmation for token transfer
        const confirmMessage = transaction.currency === 'XLM' 
          ? `This will transfer ${parseFloat(transaction.amount).toLocaleString('en-IN', { maximumFractionDigits: 4 })} XLM tokens from the buyer to your account. Continue?`
          : 'This will complete the escrow and transfer funds. Continue?'
        
        if (!window.confirm(confirmMessage)) {
          return
        }
      }
    }

    try {
      const { error: updateError } = await updateTransactionStatus(transactionId, newStatus, user.id)
      if (updateError) {
        error(`Failed to update transaction status: ${updateError.message || 'Please try again'}`)
        return
      }
      
      // Show success message with token transfer info
      if (newStatus === 'completed') {
        const transaction = transactions.find(t => t.id === transactionId)
        if (transaction?.currency === 'XLM' && transaction?.metadata?.escrow_transaction_id) {
          success(`Transaction completed! ${parseFloat(transaction.amount).toLocaleString('en-IN', { maximumFractionDigits: 4 })} XLM tokens have been transferred to your account.`)
        } else {
          success('Transaction completed! Property ownership has been transferred.')
        }
        
        // Force reload purchased and sold properties after a short delay to ensure DB has updated
        setTimeout(async () => {
          if (user?.id) {
            try {
              const purchasedResult = await getPurchasedProperties(user.id)
              const soldResult = await getSoldProperties(user.id)
              
              if (purchasedResult.data) {
                console.log('Reloaded purchased properties after completion:', purchasedResult.data)
                setPurchasedProperties(purchasedResult.data)
              }
              if (soldResult.data) {
                console.log('Reloaded sold properties after completion:', soldResult.data)
                setSoldProperties(soldResult.data)
              }
            } catch (err) {
              console.error('Error reloading properties:', err)
            }
          }
        }, 500)
      } else {
        success(`Transaction status updated to ${newStatus.replace('_', ' ')}`)
      }
      
      // Reload all data to reflect ownership changes
      await loadData()
    } catch (err) {
      console.error('Error updating transaction status:', err)
      error('An error occurred')
    }
  }

  const tabs = [
    {
      label: 'Saved Properties',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                  <Skeleton width="w-1/3" height="h-8" />
                </Card>
              ))}
            </div>
          ) : savedProperties.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="py-8">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved properties yet</h3>
                <p className="text-gray-600 mb-6">Start exploring properties to save your favorites</p>
                <Button variant="primary" onClick={() => navigate('/properties')}>
                  Browse Properties
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedProperties.map((property) => (
                <Card key={property.id} hover padding="md">
                  <div className="aspect-video bg-gray-200 rounded mb-4 overflow-hidden">
                    <img
                      src={getSafeImageUrl(property.images?.[0])}
                      alt={property.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = PROPERTY_PLACEHOLDER
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold">{property.title}</h3>
                    <BlockchainBadge property={property} />
                  </div>
                  <p className="text-gray-700 mb-4">{property.location}</p>
                  <p className="text-2xl font-semibold text-primary mb-4">
                    ₹{property.price?.toLocaleString()}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    View Details
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Registrations',
      content: (
        <div>
          {!isLoading && (
            <div className="mb-4">
              <Select
                label="Filter by Status"
                value={registrationStatusFilter}
                onChange={(e) => setRegistrationStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'in_review', label: 'In Review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                className="max-w-xs"
              />
            </div>
          )}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" />
                </Card>
              ))}
            </div>
          ) : registrations.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="py-8">
                {registrationStatusFilter !== 'all' ? (
                  <>
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No {registrationStatusFilter} registrations found</h3>
                    <p className="text-gray-600 mb-6">Try adjusting your filter or check other statuses</p>
                    <Button
                      variant="outline"
                      onClick={() => setRegistrationStatusFilter('all')}
                    >
                      Show All Registrations
                    </Button>
                  </>
                ) : (
                  <>
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No registrations yet</h3>
                    <p className="text-gray-600 mb-6">Register your first property to get started</p>
                    <Button
                      variant="primary"
                      onClick={() => navigate('/registration')}
                    >
                      Register Your First Property
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {registrations.map((registration) => (
                <Card key={registration.id} padding="md">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-2">
                        {registration.property_address}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-700">
                        <span>
                          Submitted: {new Date(registration.submitted_date).toLocaleDateString()}
                        </span>
                        {registration.estimated_completion_date && (
                          <span>
                            Estimated: {new Date(registration.estimated_completion_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(registration.status)}
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Type:</strong> {registration.property_type}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Size:</strong> {registration.property_size ? `${registration.property_size} sq ft` : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Owner:</strong> {registration.owner_name}
                    </p>
                    {registration.property_description && (
                      <p className="text-sm text-gray-700">
                        <strong>Description:</strong> {registration.property_description}
                      </p>
                    )}
                  </div>

                  {/* Documents Section */}
                  {(registration.documents && registration.documents.length > 0) || registration.extract_712 ? (
                    <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm font-semibold mb-2 text-gray-900">Documents:</p>
                      <div className="space-y-2">
                        {registration.extract_712 && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={registration.extract_712}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex-1"
                            >
                              7/12 Extract
                            </a>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        )}
                        {registration.documents && registration.documents.length > 0 && (
                          <div className="space-y-1">
                            {registration.documents.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <a
                                  href={doc}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline flex-1"
                                >
                                  Document {idx + 1}
                                </a>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {registration.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/registration?edit=${registration.id}`)}
                        className="flex-1"
                      >
                        Edit Registration
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteModal({
                          open: true,
                          type: 'registration',
                          id: registration.id,
                          title: registration.property_address,
                          status: registration.status
                        })}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {registration.status === 'rejected' && registration.review_notes && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-800">{registration.review_notes}</p>
                    </div>
                  )}
                  {registration.status === 'approved' && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleDownloadCertificate(registration)}
                        className="flex-1"
                      >
                        <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Certificate (PDF)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteModal({
                          open: true,
                          type: 'registration',
                          id: registration.id,
                          title: registration.property_address,
                          status: registration.status
                        })}
                        className="flex-1"
                      >
                        <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </Button>
                    </div>
                  )}
                  {registration.status === 'rejected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteModal({
                        open: true,
                        type: 'registration',
                        id: registration.id,
                        title: registration.property_address,
                        status: registration.status
                      })}
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Registration
                    </Button>
                  )}
                  {registration.estimated_review_days && registration.status === 'pending' && (
                    <p className="text-sm text-gray-600 mt-2">
                      ⏱️ Typically reviewed within {registration.estimated_review_days} business days
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'My Listings',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                  <Skeleton width="w-1/3" height="h-8" />
                </Card>
              ))}
            </div>
          ) : myProperties.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="py-8">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No listings yet</h3>
                <p className="text-gray-600 mb-6">List your first property and start connecting with buyers</p>
                <Button variant="primary" onClick={() => navigate('/sell-property')}>
                  List Your First Property
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myProperties.map((property) => {
                const propertyInquiries = inquiries.filter(i => i.property_id === property.id)
                const unreadCount = propertyInquiries.filter(i => i.status === 'new').length
                const propertyStatus = property.status || 'active'
                const isRemoved = isPropertyRemoved(property)

                return (
                  <Card key={property.id} padding="md" className={isRemoved ? 'border-2 border-red-300 bg-red-50' : ''}>
                    {/* Removed Banner - Show at top if removed */}
                    {isRemoved && (
                      <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-800 mb-1">Property Removed by Administrator</p>
                            {property.removal_reason && (
                              <p className="text-xs text-red-700 mb-1"><strong>Reason:</strong> {property.removal_reason}</p>
                            )}
                            {property.removed_at && (
                              <p className="text-xs text-red-600">
                                Removed on: {new Date(property.removed_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="aspect-video bg-gray-200 rounded mb-4 overflow-hidden relative">
                      <img
                        src={getSafeImageUrl(property.images?.[0])}
                        alt={property.title}
                        className={`w-full h-full object-cover ${isRemoved ? 'opacity-50' : ''}`}
                        onError={(e) => {
                          e.target.src = PROPERTY_PLACEHOLDER
                        }}
                      />
                      {isRemoved && (
                        <div className="absolute inset-0 bg-red-900 bg-opacity-30 flex items-center justify-center">
                          <div className="bg-red-600 text-white px-4 py-2 rounded font-semibold">
                            REMOVED
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        {getPropertyStatusBadge(property)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={property.listing_type === 'for_rent' ? 'secondary' : 'primary'}>
                        {property.listing_type === 'for_rent' ? 'For Rent' : 'For Sale'}
                      </Badge>
                      <Badge variant="primary">{property.type}</Badge>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{property.title}</h3>
                    <p className="text-gray-700 mb-2">{property.location}</p>
                    <p className="text-2xl font-semibold text-primary mb-4">
                      ₹{property.price?.toLocaleString()}
                      {property.listing_type === 'for_rent' && <span className="text-sm text-gray-700">/month</span>}
                    </p>
                    
                    {/* Analytics */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 pb-4 border-b">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{property.view_count || 0} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span>{propertyInquiries.length} inquiries</span>
                        {unreadCount > 0 && (
                          <Badge variant="error" className="ml-1">{unreadCount}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {isRemoved ? (
                          <Button
                            variant="outline"
                            className="flex-1"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                            disabled
                          >
                            View (Removed)
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                          >
                            View
                          </Button>
                        )}
                        {!isRemoved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProperty(property)
                              setInquiriesModalOpen(true)
                            }}
                          >
                            Messages {unreadCount > 0 && `(${unreadCount})`}
                          </Button>
                        )}
                      </div>
                      {!isRemoved && (
                        <div className="flex gap-2">
                          {propertyStatus === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUpdatePropertyStatus(property.id, 'paused')}
                          >
                            Pause
                          </Button>
                        ) : propertyStatus === 'paused' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUpdatePropertyStatus(property.id, 'active')}
                          >
                            Activate
                          </Button>
                        ) : null}
                        {property.listing_type === 'for_sale' && propertyStatus !== 'sold' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUpdatePropertyStatus(property.id, 'sold')}
                          >
                            Mark as Sold
                          </Button>
                        )}
                        {property.listing_type === 'for_rent' && propertyStatus !== 'rented' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUpdatePropertyStatus(property.id, 'rented')}
                          >
                            Mark as Rented
                          </Button>
                        )}
                        </div>
                      )}
                      {!isRemoved && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/sell-property?edit=${property.id}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setDeleteModal({
                              open: true,
                              type: 'property',
                              id: property.id,
                              title: property.title
                            })}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'My Offers',
      content: (
        <div>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-32" />
                </Card>
              ))}
            </div>
          ) : myOffers.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-700 mb-4">You haven't made any offers yet</p>
              <Button variant="primary" onClick={() => navigate('/properties')}>
                Browse Properties
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {myOffers.map((offer) => (
                <Card key={offer.id} padding="md" className="border-l-4 border-l-primary">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{offer.properties?.title || 'Property'}</h3>
                      <p className="text-sm text-gray-600 mb-2">{offer.properties?.location}</p>
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Your Offer</p>
                          <p className="text-lg font-semibold text-primary">
                            ₹{offer.offer_amount?.toLocaleString()}
                            {offer.offer_type === 'rental' && '/month'}
                          </p>
                        </div>
                        {offer.properties?.price && (
                          <div>
                            <p className="text-xs text-gray-500">Listed Price</p>
                            <p className="text-lg font-semibold text-gray-700">
                              ₹{offer.properties.price.toLocaleString()}
                              {offer.properties.listing_type === 'for_rent' && '/month'}
                            </p>
                          </div>
                        )}
                      </div>
                      {offer.message && (
                        <p className="text-sm text-gray-700 mb-2">{offer.message}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Submitted: {new Date(offer.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={
                        offer.status === 'accepted' ? 'success' :
                        offer.status === 'rejected' ? 'error' :
                        offer.status === 'withdrawn' ? 'secondary' :
                        'warning'
                      }>
                        {offer.status}
                      </Badge>
                      {(offer.blockchain_offer_id || offer.blockchain_tx_hash) && (
                        <Badge variant="success" className="flex items-center gap-1 text-xs">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Blockchain Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  {offer.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOfferAction(offer.id, 'withdrawn')}
                    >
                      Withdraw Offer
                    </Button>
                  )}
                  {offer.status === 'accepted' && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800 font-medium">Offer Accepted!</p>
                      <p className="text-xs text-green-700 mt-1">Transaction created! Check your Transaction History tab to manage the transaction.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            // Switch to transactions tab and reload data
                            const transactionTabIndex = tabs.findIndex(t => t.label === 'Transactions')
                            if (transactionTabIndex === -1) {
                              console.error('Transactions tab not found')
                              error('Transactions tab not found. Please refresh the page.')
                              return
                            }

                            // Reset filter to 'all' to show all transactions
                            setTransactionStatusFilter('all')
                            
                            // Reload transactions immediately
                            if (user?.id) {
                              setIsLoading(true)
                              try {
                                console.log('Loading transactions for user:', user.id)
                                const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                                
                                if (transactionError) {
                                  console.error('Error loading transactions:', transactionError)
                                  console.error('Error details:', {
                                    code: transactionError.code,
                                    message: transactionError.message,
                                    details: transactionError.details,
                                    hint: transactionError.hint
                                  })
                                  
                                  // Show user-friendly error message
                                  if (transactionError.code === '42501' || transactionError.message?.includes('row-level security')) {
                                    error('Permission denied. Please run fix-transactions-rls.sql in Supabase SQL Editor.')
                                  } else {
                                    error(`Failed to load transactions: ${transactionError.message || 'Unknown error'}`)
                                  }
                                  setTransactions([])
                                } else if (transactionData) {
                                  console.log('Loaded transactions after offer acceptance:', transactionData)
                                  console.log('Transaction count:', transactionData.length)
                                  setTransactions(transactionData)
                                  
                                  if (transactionData.length === 0) {
                                    error('No transactions found. If you just accepted an offer, transactions may not have been created. Check console for errors or run backfill-transactions-for-accepted-offers-bypass-rls.sql')
                                  }
                                } else {
                                  console.warn('No transaction data returned')
                                  setTransactions([])
                                  error('No transactions found. Please check if transactions were created.')
                                }
                              } catch (err) {
                                console.error('Unexpected error loading transactions:', err)
                                error(`An unexpected error occurred: ${err.message || 'Please try again'}`)
                                setTransactions([])
                              } finally {
                                setIsLoading(false)
                              }
                            } else {
                              error('User not found. Please log in again.')
                              return
                            }
                            
                            // Also reload all data
                            try {
                              await loadData()
                            } catch (loadError) {
                              console.error('Error in loadData:', loadError)
                              // Don't show error here as we already loaded transactions above
                            }
                            
                            // Switch to transactions tab
                            setActiveTab(transactionTabIndex)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          } catch (err) {
                            console.error('Error in View Transaction button:', err)
                            error(`Failed to view transactions: ${err.message || 'Please try again'}`)
                          }
                        }}
                      >
                        View Transaction
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Property Offers',
      content: (
        <div>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-32" />
                </Card>
              ))}
            </div>
          ) : offers.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-700 mb-4">No offers on your properties yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <Card key={offer.id} padding="md" className="border-l-4 border-l-primary">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{offer.properties?.title || 'Property'}</h3>
                      <p className="text-sm text-gray-600 mb-2">{offer.properties?.location}</p>
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Offer Amount</p>
                          <p className="text-lg font-semibold text-primary">
                            ₹{offer.offer_amount?.toLocaleString()}
                            {offer.offer_type === 'rental' && '/month'}
                          </p>
                        </div>
                        {offer.properties?.price && (
                          <div>
                            <p className="text-xs text-gray-500">Your Listed Price</p>
                            <p className="text-lg font-semibold text-gray-700">
                              ₹{offer.properties.price.toLocaleString()}
                              {offer.properties.listing_type === 'for_rent' && '/month'}
                            </p>
                          </div>
                        )}
                      </div>
                      {offer.message && (
                        <p className="text-sm text-gray-700 mb-2">{offer.message}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Received: {new Date(offer.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={
                        offer.status === 'accepted' ? 'success' :
                        offer.status === 'rejected' ? 'error' :
                        offer.status === 'withdrawn' ? 'secondary' :
                        'warning'
                      }>
                        {offer.status}
                      </Badge>
                      {(offer.blockchain_offer_id || offer.blockchain_tx_hash) && (
                        <Badge variant="success" className="flex items-center gap-1 text-xs">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Blockchain Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  {offer.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOfferAction(offer.id, 'accepted')}
                      >
                        Accept Offer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOfferAction(offer.id, 'rejected')}
                      >
                        Reject Offer
                      </Button>
                    </div>
                  )}
                  {offer.status === 'accepted' && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800 font-medium">Offer Accepted</p>
                      <p className="text-xs text-green-700 mt-1">Transaction created! Check your Transaction History tab to manage the transaction.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            // Switch to transactions tab and reload data
                            const transactionTabIndex = tabs.findIndex(t => t.label === 'Transactions')
                            if (transactionTabIndex === -1) {
                              console.error('Transactions tab not found')
                              error('Transactions tab not found. Please refresh the page.')
                              return
                            }

                            // Reset filter to 'all' to show all transactions
                            setTransactionStatusFilter('all')
                            
                            // Reload transactions immediately
                            if (user?.id) {
                              setIsLoading(true)
                              try {
                                console.log('Loading transactions for user:', user.id)
                                const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                                
                                if (transactionError) {
                                  console.error('Error loading transactions:', transactionError)
                                  console.error('Error details:', {
                                    code: transactionError.code,
                                    message: transactionError.message,
                                    details: transactionError.details,
                                    hint: transactionError.hint
                                  })
                                  
                                  // Show user-friendly error message
                                  if (transactionError.code === '42501' || transactionError.message?.includes('row-level security')) {
                                    error('Permission denied. Please run fix-transactions-rls.sql in Supabase SQL Editor.')
                                  } else {
                                    error(`Failed to load transactions: ${transactionError.message || 'Unknown error'}`)
                                  }
                                  setTransactions([])
                                } else if (transactionData) {
                                  console.log('Loaded transactions after offer acceptance:', transactionData)
                                  console.log('Transaction count:', transactionData.length)
                                  setTransactions(transactionData)
                                  
                                  if (transactionData.length === 0) {
                                    error('No transactions found. If you just accepted an offer, transactions may not have been created. Check console for errors or run backfill-transactions-for-accepted-offers-bypass-rls.sql')
                                  }
                                } else {
                                  console.warn('No transaction data returned')
                                  setTransactions([])
                                  error('No transactions found. Please check if transactions were created.')
                                }
                              } catch (err) {
                                console.error('Unexpected error loading transactions:', err)
                                error(`An unexpected error occurred: ${err.message || 'Please try again'}`)
                                setTransactions([])
                              } finally {
                                setIsLoading(false)
                              }
                            } else {
                              error('User not found. Please log in again.')
                              return
                            }
                            
                            // Also reload all data
                            try {
                              await loadData()
                            } catch (loadError) {
                              console.error('Error in loadData:', loadError)
                              // Don't show error here as we already loaded transactions above
                            }
                            
                            // Switch to transactions tab
                            setActiveTab(transactionTabIndex)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          } catch (err) {
                            console.error('Error in View Transaction button:', err)
                            error(`Failed to view transactions: ${err.message || 'Please try again'}`)
                          }
                        }}
                      >
                        View Transaction
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'My Properties',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                  <Skeleton width="w-1/3" height="h-8" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Listed Properties Section */}
              {myProperties.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Listed Properties ({myProperties.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {myProperties.map((property) => (
                      <Card key={property.id} padding="md">
                        <div className="aspect-video bg-gray-200 rounded mb-4 overflow-hidden relative">
                          <img
                            src={getSafeImageUrl(property.images?.[0])}
                            alt={property.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = PROPERTY_PLACEHOLDER
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <Badge variant="primary">Listed</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="primary">{property.type}</Badge>
                          <BlockchainBadge property={property} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          <Link 
                            to={`/properties/${property.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {property.title}
                          </Link>
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">{property.location}</p>
                        <p className="text-xl font-bold text-primary mb-4">
                          ₹{parseFloat(property.price).toLocaleString('en-IN')}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                            className="flex-1"
                          >
                            View Details
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Registered Properties Section */}
              {registrations.filter(r => r.status === 'approved').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Registered Properties ({registrations.filter(r => r.status === 'approved').length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {registrations.filter(r => r.status === 'approved').map((registration) => (
                      <Card key={registration.id} padding="md">
                        <div className="p-4 bg-gray-50 rounded mb-4">
                          <Badge variant="success" className="mb-2">Registered</Badge>
                          <h3 className="text-lg font-semibold mb-2">{registration.property_address}</h3>
                          <p className="text-sm text-gray-600 mb-2">Type: {registration.property_type}</p>
                          {registration.property_size && (
                            <p className="text-sm text-gray-600 mb-2">Size: {registration.property_size} sqft</p>
                          )}
                          <p className="text-xs text-gray-500">Registered: {new Date(registration.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/sell-property')}
                            className="flex-1"
                          >
                            List This Property
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteModal({
                              open: true,
                              type: 'registration',
                              id: registration.id,
                              title: registration.property_address,
                              status: registration.status
                            })}
                            className="flex-1"
                          >
                            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchased Properties Section */}
              {purchasedProperties.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchased Properties ({purchasedProperties.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {purchasedProperties.map((property) => (
                      <Card key={property.id} padding="md">
                        <div className="aspect-video bg-gray-200 rounded mb-4 overflow-hidden relative">
                          <img
                            src={getSafeImageUrl(property.images?.[0])}
                            alt={property.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = PROPERTY_PLACEHOLDER
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <Badge variant="success">Purchased</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="primary">{property.type}</Badge>
                          {property.sold_at && (
                            <span className="text-xs text-gray-600">
                              Purchased: {new Date(property.sold_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          <Link 
                            to={`/properties/${property.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {property.title}
                          </Link>
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">{property.location}</p>
                        <p className="text-xl font-bold text-primary mb-4">
                          ₹{parseFloat(property.price).toLocaleString('en-IN')}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                            className="flex-1"
                          >
                            View Details
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/sell-property?edit=${property.id}`)}
                            className="flex-1"
                          >
                            Edit
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {myProperties.length === 0 && 
               registrations.filter(r => r.status === 'approved').length === 0 && 
               purchasedProperties.length === 0 && (
                <Card padding="lg" className="text-center">
                  <div className="py-8">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No properties yet</h3>
                    <p className="text-gray-600 mb-6">You don't have any listed, registered, or purchased properties yet.</p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="primary" onClick={() => navigate('/register')}>
                        Register Property
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/properties')}>
                        Browse Properties
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Properties Sold',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                  <Skeleton width="w-1/3" height="h-8" />
                </Card>
              ))}
            </div>
          ) : soldProperties.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="py-8">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No properties sold yet</h3>
                <p className="text-gray-600 mb-6">Properties you sell will appear here</p>
                <Button variant="primary" onClick={() => navigate('/sell-property')}>
                  List a Property
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {soldProperties.map((property) => (
                <Card key={property.id} padding="md">
                  <div className="aspect-video bg-gray-200 rounded mb-4 overflow-hidden relative">
                    <img
                      src={getSafeImageUrl(property.images?.[0])}
                      alt={property.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = PROPERTY_PLACEHOLDER
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="success">Sold</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="primary">{property.type}</Badge>
                    {property.sold_at && (
                      <span className="text-xs text-gray-600">
                        Sold: {new Date(property.sold_at).toLocaleDateString()}
                      </span>
                    )}
                    <BlockchainBadge property={property} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{property.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{property.location}</p>
                  <p className="text-xl font-bold text-primary mb-4">
                    ₹{parseFloat(property.price).toLocaleString('en-IN')}
                  </p>
                  {property.ownership_history && Array.isArray(property.ownership_history) && property.ownership_history.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600 mb-1">Ownership History:</p>
                      <div className="text-xs text-gray-700">
                        {property.ownership_history.map((entry, idx) => (
                          <div key={idx} className="mb-1">
                            <span className="font-medium">{entry.owner_name}</span>
                            {entry.from_date && entry.to_date && (
                              <span className="text-gray-500">
                                {' '}({new Date(entry.from_date).toLocaleDateString()} - {new Date(entry.to_date).toLocaleDateString()})
                              </span>
                            )}
                            {entry.notes && (
                              <span className="text-gray-500 italic"> - {entry.notes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/properties/${property.id}`)}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Profile',
      content: (
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-xl font-semibold mb-6">Profile Information</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="profile-full-name" className="block text-sm font-medium text-gray-900 mb-2">
                  Full Name
                </label>
                <input
                  id="profile-full-name"
                  type="text"
                  defaultValue={user?.fullName || user?.firstName || ''}
                  className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  Email Address
                  {user?.emailAddresses?.[0]?.verification?.status === 'verified' && (
                    <Badge variant="success" className="text-xs">
                      <svg className="w-3 h-3 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </Badge>
                  )}
                </label>
                <input
                  id="profile-email"
                  type="email"
                  defaultValue={user?.primaryEmailAddress?.emailAddress || ''}
                  className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
              </div>
              
              {/* Wallet Address */}
              <div>
                <label htmlFor="profile-wallet" className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  Connected Wallet Address
                  {walletAddress && (
                    <Badge variant="primary" className="text-xs">
                      <svg className="w-3 h-3 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Connected
                    </Badge>
                  )}
                </label>
                {walletAddress ? (
                  <div className="flex items-center gap-2">
                    <input
                      id="profile-wallet"
                      type="text"
                      value={`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                      className="flex-1 px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      disabled
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(walletAddress)}
                    >
                      Copy
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No wallet connected. Connect your wallet from the navigation bar.</p>
                )}
              </div>

              {/* Token Balance */}
              {walletAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    XLM Token Balance
                  </label>
                  <TokenBalance className="p-3 bg-gray-50 border border-gray-300 rounded" />
                  <p className="text-xs text-gray-600 mt-2 mb-3">
                    Your XLM token balance on Stellar testnet
                  </p>
                  <TokenConversionInfo variant="badge" />
                </div>
              )}
            </div>
          </Card>

          {/* Documents Section */}
          <Card padding="md">
            <h3 className="text-xl font-semibold mb-2">Identity Documents</h3>
            <p className="text-sm text-gray-600 mb-6">
              Upload your Aadhar Card and PAN Card to your profile. These documents will be automatically used when registering land properties, making the registration process faster.
            </p>
            
            <div className="space-y-6">
              {/* Aadhar Card */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <label htmlFor="profile-aadhar-card" className="block text-sm font-medium text-gray-900 mb-2">
                  Aadhar Card
                </label>
                <p className="text-sm text-gray-700 mb-3">
                  Upload a clear copy of your Aadhar Card (front side). This will be used to auto-fill your land registration forms.
                </p>
                {profileDocuments.aadharCard ? (
                  <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{profileDocuments.aadharCard.name}</p>
                        <p className="text-xs text-gray-600">Uploaded</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(profileDocuments.aadharCard.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!user?.id) return
                          try {
                            const { error: updateError } = await updateUserProfile(user.id, { aadhar_card: null })
                            if (updateError) {
                              error('Failed to remove Aadhar Card')
                            } else {
                              setProfileDocuments(prev => ({ ...prev, aadharCard: null }))
                              success('Aadhar Card removed successfully')
                              // Reload profile
                              const { data } = await getUserProfile(user.id)
                              if (data) setUserProfile(data)
                            }
                          } catch (err) {
                            error('Failed to remove Aadhar Card')
                          }
                        }}
                      >
                        Remove
                      </Button>
                      <label htmlFor="profile-aadhar-card-update" className="cursor-pointer">
                        <Button variant="primary" size="sm" as="span">
                          Update
                        </Button>
                        <input
                          id="profile-aadhar-card-update"
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const file = e.target.files[0]
                            if (!file || !user?.id) return
                            setUploadingAadhar(true)
                            try {
                              const { data: uploadData, error: uploadError } = await uploadProfileDocument(file, user.id, 'aadhar')
                              if (uploadError) {
                                error('Failed to upload Aadhar Card: ' + (uploadError.message || 'Please try again'))
                              } else {
                                const { error: updateError } = await updateUserProfile(user.id, { aadhar_card: uploadData.url })
                                if (updateError) {
                                  error('Failed to save Aadhar Card')
                                } else {
                                  setProfileDocuments(prev => ({ ...prev, aadharCard: { url: uploadData.url, name: 'Aadhar Card' } }))
                                  success('Aadhar Card uploaded successfully')
                                  // Reload profile
                                  const { data } = await getUserProfile(user.id)
                                  if (data) setUserProfile(data)
                                }
                              }
                            } catch (err) {
                              error('Failed to upload Aadhar Card')
                            } finally {
                              setUploadingAadhar(false)
                              e.target.value = '' // Reset input
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      id="profile-aadhar-card"
                      type="file"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file || !user?.id) return
                        setUploadingAadhar(true)
                        try {
                          const { data: uploadData, error: uploadError } = await uploadProfileDocument(file, user.id, 'aadhar')
                          if (uploadError) {
                            error('Failed to upload Aadhar Card: ' + (uploadError.message || 'Please try again'))
                          } else {
                            const { error: updateError } = await updateUserProfile(user.id, { aadhar_card: uploadData.url })
                            if (updateError) {
                              error('Failed to save Aadhar Card')
                            } else {
                              setProfileDocuments(prev => ({ ...prev, aadharCard: { url: uploadData.url, name: 'Aadhar Card' } }))
                              success('Aadhar Card uploaded successfully')
                              // Reload profile
                              const { data } = await getUserProfile(user.id)
                              if (data) setUserProfile(data)
                            }
                          }
                        } catch (err) {
                          error('Failed to upload Aadhar Card')
                        } finally {
                          setUploadingAadhar(false)
                          e.target.value = '' // Reset input
                        }
                      }}
                      disabled={uploadingAadhar}
                      className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    {uploadingAadhar && (
                      <p className="mt-2 text-sm text-gray-600">Uploading Aadhar Card...</p>
                    )}
                    <p className="mt-2 text-xs text-gray-600">
                      <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* PAN Card */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <label htmlFor="profile-pan-card" className="block text-sm font-medium text-gray-900 mb-2">
                  PAN Card
                </label>
                <p className="text-sm text-gray-700 mb-3">
                  Upload a clear copy of your PAN Card. This will be used to auto-fill your land registration forms.
                </p>
                {profileDocuments.panCard ? (
                  <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{profileDocuments.panCard.name}</p>
                        <p className="text-xs text-gray-600">Uploaded</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(profileDocuments.panCard.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!user?.id) return
                          try {
                            const { error: updateError } = await updateUserProfile(user.id, { pan_card: null })
                            if (updateError) {
                              error('Failed to remove PAN Card')
                            } else {
                              setProfileDocuments(prev => ({ ...prev, panCard: null }))
                              success('PAN Card removed successfully')
                              // Reload profile
                              const { data } = await getUserProfile(user.id)
                              if (data) setUserProfile(data)
                            }
                          } catch (err) {
                            error('Failed to remove PAN Card')
                          }
                        }}
                      >
                        Remove
                      </Button>
                      <label htmlFor="profile-pan-card-update" className="cursor-pointer">
                        <Button variant="primary" size="sm" as="span">
                          Update
                        </Button>
                        <input
                          id="profile-pan-card-update"
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const file = e.target.files[0]
                            if (!file || !user?.id) return
                            setUploadingPan(true)
                            try {
                              const { data: uploadData, error: uploadError } = await uploadProfileDocument(file, user.id, 'pan')
                              if (uploadError) {
                                error('Failed to upload PAN Card: ' + (uploadError.message || 'Please try again'))
                              } else {
                                const { error: updateError } = await updateUserProfile(user.id, { pan_card: uploadData.url })
                                if (updateError) {
                                  error('Failed to save PAN Card')
                                } else {
                                  setProfileDocuments(prev => ({ ...prev, panCard: { url: uploadData.url, name: 'PAN Card' } }))
                                  success('PAN Card uploaded successfully')
                                  // Reload profile
                                  const { data } = await getUserProfile(user.id)
                                  if (data) setUserProfile(data)
                                }
                              }
                            } catch (err) {
                              error('Failed to upload PAN Card')
                            } finally {
                              setUploadingPan(false)
                              e.target.value = '' // Reset input
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      id="profile-pan-card"
                      type="file"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file || !user?.id) return
                        setUploadingPan(true)
                        try {
                          const { data: uploadData, error: uploadError } = await uploadProfileDocument(file, user.id, 'pan')
                          if (uploadError) {
                            error('Failed to upload PAN Card: ' + (uploadError.message || 'Please try again'))
                          } else {
                            const { error: updateError } = await updateUserProfile(user.id, { pan_card: uploadData.url })
                            if (updateError) {
                              error('Failed to save PAN Card')
                            } else {
                              setProfileDocuments(prev => ({ ...prev, panCard: { url: uploadData.url, name: 'PAN Card' } }))
                              success('PAN Card uploaded successfully')
                              // Reload profile
                              const { data } = await getUserProfile(user.id)
                              if (data) setUserProfile(data)
                            }
                          }
                        } catch (err) {
                          error('Failed to upload PAN Card')
                        } finally {
                          setUploadingPan(false)
                          e.target.value = '' // Reset input
                        }
                      }}
                      disabled={uploadingPan}
                      className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    {uploadingPan && (
                      <p className="mt-2 text-sm text-gray-600">Uploading PAN Card...</p>
                    )}
                    <p className="mt-2 text-xs text-gray-600">
                      <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

        </div>
      ),
    },
    {
      label: 'Transactions',
      content: (
        <div>
          {/* Transaction History */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Transaction History</h3>
              <Select
                label=""
                value={transactionStatusFilter || 'all'}
                onChange={async (e) => {
                  const newFilter = e.target.value
                  setTransactionStatusFilter(newFilter)
                  // Reload transactions immediately when filter changes
                  if (user?.id) {
                    setIsLoading(true)
                    try {
                      const { data: transactionData, error: transactionError } = await getTransactions(user.id, { 
                        status: newFilter !== 'all' ? newFilter : undefined,
                        limit: 50
                      })
                      if (!transactionError && transactionData) {
                        console.log('Loaded transactions:', transactionData)
                        setTransactions(transactionData)
                      } else {
                        console.error('Error loading transactions:', transactionError)
                        setTransactions([])
                      }
                    } catch (err) {
                      console.error('Error loading filtered transactions:', err)
                      setTransactions([])
                    } finally {
                      setIsLoading(false)
                    }
                  }
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'failed', label: 'Failed' },
                ]}
                className="w-48"
              />
            </div>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} padding="md">
                    <Skeleton height="h-32" />
                  </Card>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <Card padding="lg" className="text-center">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-600 mb-4">Your transaction history will appear here once you complete a property transaction.</p>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm mb-4">
                  <p className="font-semibold text-blue-900 mb-1">💡 Blockchain Transactions</p>
                  <p className="text-blue-800 mb-2">
                    Your transaction history includes:
                  </p>
                  <ul className="list-disc list-inside text-blue-700 space-y-1">
                    <li>Database transactions (offers, purchases, sales)</li>
                    <li>Blockchain transactions (if wallet connected)</li>
                    <li>Token payments with XLM tokens</li>
                    <li>XLM payments for property purchases</li>
                    <li>Ownership transfers on blockchain</li>
                    <li>Escrow transactions (created/completed)</li>
                  </ul>
                  {!walletAddress && (
                    <p className="text-blue-800 mt-2 font-medium">
                      💡 Connect your wallet to see blockchain transactions
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  If you just accepted an offer, transactions should appear automatically. 
                  If they don't, check the browser console for errors or run fix-transactions-rls.sql in Supabase.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                        onClick={async () => {
                          if (user?.id) {
                            setIsLoading(true)
                            try {
                              const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                              if (!transactionError && transactionData) {
                                console.log('Refreshed transactions:', transactionData)
                                setTransactions(transactionData)
                                if (transactionData.length === 0) {
                                  error('No transactions found. Check console for transaction creation errors.')
                                }
                              } else {
                                console.error('Error refreshing transactions:', transactionError)
                                error(`Failed to load transactions: ${transactionError?.message || 'Unknown error'}`)
                                setTransactions([])
                              }
                            } catch (err) {
                              console.error('Error refreshing transactions:', err)
                              error('An error occurred while refreshing transactions')
                              setTransactions([])
                            } finally {
                              setIsLoading(false)
                            }
                          }
                        }}
                >
                  Refresh Transactions
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <Card key={transaction.id} padding="md" className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg capitalize">
                            {transaction.transaction_type.replace('_', ' ')}
                          </h4>
                          <Badge 
                            variant={
                              transaction.status === 'completed' ? 'success' : 
                              transaction.status === 'in_progress' ? 'primary' :
                              transaction.status === 'pending' ? 'warning' : 
                              'error'
                            }
                          >
                            {transaction.status.replace('_', ' ')}
                          </Badge>
                          {transaction.metadata?.is_blockchain_only && (
                            <Badge variant="success" className="text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Blockchain Verified
                            </Badge>
                          )}
                          {transaction.blockchain_tx_hash && !transaction.metadata?.is_blockchain_only && (
                            <Badge variant="success" className="text-xs flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Blockchain Verified
                            </Badge>
                          )}
                        </div>
                        {transaction.description && (
                          <p className="text-sm text-gray-600 mb-2">{transaction.description}</p>
                        )}
                        {transaction.metadata?.property_title && (
                          <p className="text-xs text-gray-500 mb-1">
                            Property: {transaction.metadata.property_title}
                          </p>
                        )}
                        {transaction.metadata?.property_location && (
                          <p className="text-xs text-gray-500 mb-2">
                            Location: {transaction.metadata.property_location}
                          </p>
                        )}
                        {transaction.metadata?.blockchain_property_id && (
                          <p className="text-xs text-gray-500 mb-1">
                            Blockchain Property ID: {transaction.metadata.blockchain_property_id}
                          </p>
                        )}
                        {transaction.metadata?.event_type && (
                          <p className="text-xs text-blue-600 mb-1">
                            Event: {transaction.metadata.event_type}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {!transaction.metadata?.is_blockchain_only && transaction.status === 'pending' && (
                          <div className="mt-3 flex gap-2">
                            {(() => {
                              let isBuyer = transaction.transaction_type === 'purchase';
                              let isSeller = transaction.transaction_type === 'sale';
                              if (transaction.transaction_type === 'rental') {
                                isSeller = transaction.metadata?.seller_id === user?.id || myProperties.some(p => p.id === transaction.property_id);
                                isBuyer = !isSeller;
                              }
                              
                              if (isBuyer) {
                                return (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleCreateEscrowAndPay(transaction)}
                                  >
                                    Pay with XLM
                                  </Button>
                                );
                              } else {
                                return (
                                  <p className="text-xs text-gray-500 italic py-2">
                                    Awaiting buyer payment
                                  </p>
                                );
                              }
                            })()}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTransactionStatusUpdate(transaction.id, 'failed')}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                        {!transaction.metadata?.is_blockchain_only && transaction.status === 'in_progress' && (
                          <div className="mt-3 flex gap-2">
                            {/* Only show "Mark as Completed" button for sellers */}
                            {/* Sellers have transaction_type 'sale' (for purchases) */}
                            {/* For rentals, check metadata.seller_id or property ownership */}
                            {(() => {
                              // Check if user is seller
                              let isSeller = false
                              
                              if (transaction.transaction_type === 'sale') {
                                // 'sale' means seller
                                isSeller = true
                              } else if (transaction.transaction_type === 'purchase') {
                                // 'purchase' means buyer
                                isSeller = false
                              } else if (transaction.transaction_type === 'rental') {
                                // For rentals, check metadata first, then property ownership
                                if (transaction.metadata?.seller_id) {
                                  isSeller = transaction.metadata.seller_id === user?.id
                                } else if (transaction.property_id) {
                                  // Fallback: check if property is in user's properties (they own it)
                                  isSeller = myProperties.some(p => p.id === transaction.property_id)
                                }
                              }
                              
                              return isSeller ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleTransactionStatusUpdate(transaction.id, 'completed')}
                                >
                                  Mark as Completed
                                </Button>
                              ) : (
                                <p className="text-xs text-gray-500 italic py-2">
                                  Only the seller can mark this transaction as completed
                                </p>
                              )
                            })()}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTransactionStatusUpdate(transaction.id, 'failed')}
                            >
                              Mark as Failed
                            </Button>
                          </div>
                        )}
                        {transaction.metadata?.is_blockchain_only && (
                          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-xs text-blue-800">
                              This is a blockchain transaction. Status cannot be manually updated.
                            </p>
                          </div>
                        )}
                        {!transaction.blockchain_tx_hash && 
                         !transaction.metadata?.is_blockchain_only && 
                         (transaction.currency === 'XLM') && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-xs text-yellow-800 mb-2">
                              This transaction should have a blockchain record. If you completed this transaction on-chain, it may not be linked yet.
                            </p>
                            {walletAddress && (
                              <p className="text-xs text-yellow-700">
                                Wallet: {walletAddress.substring(0, 10)}...{walletAddress.substring(walletAddress.length - 8)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="mb-2">
                          <p className="font-semibold text-2xl text-primary mb-1">
                            {transaction.currency === 'XLM' ? (
                              <>
                                {transaction.amount ? parseFloat(transaction.amount).toLocaleString('en-IN', { maximumFractionDigits: 4 }) : 'N/A'} XLM
                                {transaction.amount && (
                                  <span className="text-xs text-gray-500 block mt-1 font-normal">
                                    (≈ ₹{parseFloat(transaction.amount * 100).toLocaleString('en-IN')})
                                  </span>
                                )}
                              </>
                            ) : transaction.currency === 'XLM' ? (
                              <>
                                {transaction.amount ? parseFloat(transaction.amount).toLocaleString('en-IN', { maximumFractionDigits: 6 }) : 'N/A'} XLM
                              </>
                            ) : transaction.currency === 'BLOCKCHAIN' ? (
                              <>
                                <span className="text-sm">Blockchain Transaction</span>
                              </>
                            ) : (
                              <>
                                {transaction.currency} {transaction.amount ? parseFloat(transaction.amount).toLocaleString('en-IN') : 'N/A'}
                              </>
                            )}
                          </p>
                          {transaction.currency === 'XLM' && (
                            <Badge variant="primary" className="text-xs mt-1">
                              Token Payment
                            </Badge>
                          )}
                          {transaction.currency === 'XLM' && (
                            <Badge variant="primary" className="text-xs mt-1">
                              XLM Payment
                            </Badge>
                          )}
                        </div>
                        {/* Always show blockchain verification section */}
                        <div className="space-y-2 mt-2 p-3 bg-gray-50 border border-gray-200 rounded">
                          {transaction.blockchain_tx_hash ? (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-700">Blockchain Verification</p>
                                <Badge variant="success" className="text-xs">
                                  ✓ Verified
                                </Badge>
                              </div>
                              <div className="space-y-1">
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 min-w-[80px]">Tx Hash:</span>
                                <a
                                  href={`https://stellar.expert/explorer/testnet/tx/${transaction.blockchain_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline break-all flex-1"
                                >
                                  {transaction.blockchain_tx_hash}
                                </a>
                              </div>
                              {transaction.metadata?.block_number && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Ledger:</span>
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/ledger/${transaction.metadata.block_number}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                  >
                                    {transaction.metadata.block_number}
                                  </a>
                                </div>
                              )}
                              {transaction.metadata?.escrow_transaction_id && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Escrow ID:</span>
                                  <span className="text-xs text-gray-700 font-mono">
                                    {transaction.metadata.escrow_transaction_id}
                                  </span>
                                </div>
                              )}
                              {transaction.metadata?.blockchain_property_id && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Property ID:</span>
                                  <span className="text-xs text-gray-700 font-mono">
                                    {transaction.metadata.blockchain_property_id}
                                  </span>
                                </div>
                              )}
                              {transaction.metadata?.event_type && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Event:</span>
                                  <Badge variant="primary" className="text-xs">
                                    {transaction.metadata.event_type}
                                  </Badge>
                                </div>
                              )}
                              {transaction.metadata?.previous_owner && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">From:</span>
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/account/${transaction.metadata.previous_owner}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                                  >
                                    {transaction.metadata.previous_owner.substring(0, 10)}...
                                  </a>
                                </div>
                              )}
                              {transaction.metadata?.new_owner && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">To:</span>
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/account/${transaction.metadata.new_owner}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                                  >
                                    {transaction.metadata.new_owner.substring(0, 10)}...
                                  </a>
                                </div>
                              )}
                              {transaction.metadata?.buyer && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Buyer:</span>
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/account/${transaction.metadata.buyer}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                                  >
                                    {transaction.metadata.buyer.substring(0, 10)}...
                                  </a>
                                </div>
                              )}
                              {transaction.metadata?.seller && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 min-w-[80px]">Seller:</span>
                                  <a
                                    href={`https://stellar.expert/explorer/testnet/account/${transaction.metadata.seller}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                                  >
                                    {transaction.metadata.seller.substring(0, 10)}...
                                  </a>
                                </div>
                              )}
                              <div className="pt-2 border-t border-gray-200 mt-2">
                                <a
                                  href={`https://stellar.expert/explorer/testnet/tx/${transaction.blockchain_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline font-medium inline-flex items-center gap-1"
                                >
                                  View Full Details on StellarExpert →
                                </a>
                              </div>
                              {transaction.status === 'completed' && transaction.currency === 'XLM' && (
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                  <p className="text-xs text-green-600 font-medium">
                                    ✓ Tokens transferred & Ownership on blockchain
                                  </p>
                                </div>
                              )}
                              {transaction.status === 'in_progress' && transaction.currency === 'XLM' && (
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                  <p className="text-xs text-yellow-600 font-medium">
                                    ⏳ Tokens locked in escrow
                                  </p>
                                </div>
                              )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-700">Blockchain Verification</p>
                                <Badge variant="warning" className="text-xs">
                                  Not Linked
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs text-gray-600">
                                  This transaction does not have a blockchain transaction hash linked. 
                                  {walletAddress ? (
                                    <> Blockchain transactions from your wallet ({walletAddress.substring(0, 10)}...) are shown separately if available.</>
                                  ) : (
                                    <> Connect your wallet to see related blockchain transactions.</>
                                  )}
                                </p>
                                {transaction.property_id && (
                                  <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Property ID: {transaction.property_id}</p>
                                    <p className="text-xs text-gray-600">
                                      {walletAddress ? (
                                        <>Blockchain transactions from your wallet are shown in your transaction list above.</>
                                      ) : (
                                        <>Connect your wallet to see related blockchain transactions for this property.</>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ]

  // Reload transactions when filter changes
  useEffect(() => {
    if (user?.id && transactionStatusFilter) {
      const loadFilteredTransactions = async () => {
        setIsLoading(true)
        try {
          const { data: transactionData, error: transactionError } = await getTransactions(user.id, { 
            status: transactionStatusFilter !== 'all' ? transactionStatusFilter : undefined,
            limit: 50
          })
          if (!transactionError && transactionData) {
            setTransactions(transactionData)
          } else {
            setTransactions([])
          }
        } catch (err) {
          console.error('Error loading filtered transactions:', err)
          setTransactions([])
        } finally {
          setIsLoading(false)
        }
      }
      loadFilteredTransactions()
    }
  }, [transactionStatusFilter, user?.id])

  return (
    <Section>
      <Container>
        {/* Toast Notifications */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={toast.duration}
          />
        ))}

        <div className="mb-8">
          <h1 className="mb-4">Dashboard</h1>
          <p className="text-body-large text-gray-700">
            Manage your properties, registrations, and account settings
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 pb-12">
          {/* Sidebar Menu */}
          <div className="w-full md:w-full lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-24 bg-white/80 backdrop-blur-md rounded-xl border border-gray-200 p-3 shadow-sm">
              <style dangerouslySetInnerHTML={{__html: `\n                .hide-scrollbar::-webkit-scrollbar {\n                  display: none;\n                }\n              `}} />
              <div className="flex md:flex-row lg:flex-col gap-2 overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {tabs.map((tab, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveTab(index)
                      localStorage.setItem('dashboardActiveTab', index.toString())
                    }}
                    className={`
                      w-auto lg:w-full text-left px-4 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap
                      ${activeTab === index 
                        ? 'bg-primary text-white shadow-md shadow-primary/20' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
                <div className="p-6 md:p-8">
                   <h2 className="text-2xl font-bold text-gray-900 mb-8 border-b pb-4">
                     {tabs[activeTab].label}
                   </h2>
                   {tabs[activeTab].content}
                </div>
             </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, type: null, id: null, title: null, status: null })}
          title={deleteModal.type === 'registration' 
            ? (deleteModal.status === 'approved' || deleteModal.status === 'rejected' ? 'Remove Registration' : 'Cancel Registration')
            : 'Remove Property'}
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to {deleteModal.type === 'registration' 
                ? (deleteModal.status === 'approved' || deleteModal.status === 'rejected' ? 'remove' : 'cancel')
                : 'remove'} this {deleteModal.type === 'registration' ? 'registration' : 'property'}?
            </p>
            {deleteModal.title && (
              <p className="font-semibold text-gray-900">{deleteModal.title}</p>
            )}
            <p className="text-sm text-gray-600">
              {deleteModal.type === 'registration' 
                ? 'This action cannot be undone. You will need to submit a new registration if needed.'
                : 'This property will be permanently removed from listings.'}
            </p>
            <div className="flex gap-4">
              <Button
                variant="primary"
                onClick={handleDelete}
                className="flex-1"
              >
                {deleteModal.type === 'registration' 
                  ? (deleteModal.status === 'approved' || deleteModal.status === 'rejected' ? 'Remove Registration' : 'Cancel Registration')
                  : 'Remove Property'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeleteModal({ open: false, type: null, id: null, title: null, status: null })}
              >
                Keep
              </Button>
            </div>
          </div>
        </Modal>

        {/* Inquiries Modal */}
        <Modal
          isOpen={inquiriesModalOpen}
          onClose={() => {
            setInquiriesModalOpen(false)
            setSelectedProperty(null)
            setSelectedInquiry(null)
            setInquiryReplies([])
            setReplyMessage('')
          }}
          title={selectedProperty ? `Inquiries for ${selectedProperty.title}` : 'Inquiries'}
          size="lg"
        >
          {selectedProperty && (
            <div>
              {(() => {
                const propertyInquiries = inquiries.filter(i => i.property_id === selectedProperty.id)
                return propertyInquiries.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No inquiries yet for this property</p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {propertyInquiries.map((inquiry) => (
                      <Card key={inquiry.id} padding="md" className="border-l-4 border-l-primary">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold">{inquiry.buyer_name}</p>
                            <p className="text-sm text-gray-600">{inquiry.buyer_email}</p>
                            {inquiry.buyer_phone && (
                              <a 
                                href={`tel:${inquiry.buyer_phone}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {inquiry.buyer_phone}
                              </a>
                            )}
                          </div>
                          <Badge variant={
                            inquiry.status === 'new' ? 'warning' :
                            inquiry.status === 'read' ? 'primary' :
                            inquiry.status === 'replied' ? 'success' : 'error'
                          }>
                            {inquiry.status}
                          </Badge>
                        </div>
                        {inquiry.message && (
                          <p className="text-gray-700 mb-3 whitespace-pre-wrap">{inquiry.message}</p>
                        )}
                        {inquiry.appointment_date && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm font-semibold text-blue-900 mb-1">📅 Scheduled Viewing</p>
                            <p className="text-sm text-blue-800">
                              {new Date(inquiry.appointment_date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                              {inquiry.appointment_time && ` at ${inquiry.appointment_time}`}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mb-3">
                          {new Date(inquiry.created_at).toLocaleString()}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewInquiry(inquiry)}
                          >
                            {selectedInquiry?.id === inquiry.id ? 'Hide Messages' : 'View Messages'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateInquiryStatus(inquiry.id, 'read')}
                            disabled={inquiry.status === 'read' || inquiry.status === 'replied'}
                          >
                            Mark as Read
                          </Button>
                          {inquiry.buyer_phone && (
                            <a href={`tel:${inquiry.buyer_phone}`}>
                              <Button
                                variant="outline"
                                size="sm"
                              >
                                📞 Call
                              </Button>
                            </a>
                          )}
                          <a
                            href={`mailto:${inquiry.buyer_email}?subject=Re: Inquiry about ${selectedProperty.title}`}
                            className="flex-1 min-w-[120px]"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              Reply via Email
                            </Button>
                          </a>
                        </div>
                        
                        {/* Replies Section */}
                        {selectedInquiry?.id === inquiry.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-semibold mb-3">Conversation</h4>
                            
                            {/* Existing Replies */}
                            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                              {inquiryReplies.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No messages yet. Start the conversation!</p>
                              ) : (
                                inquiryReplies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className={`p-3 rounded-lg ${
                                      reply.sender_type === 'owner'
                                        ? 'bg-blue-50 border border-blue-200 ml-4'
                                        : 'bg-gray-50 border border-gray-200 mr-4'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold">
                                        {reply.sender_type === 'owner' ? 'You (Owner)' : inquiry.buyer_name}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(reply.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Reply Form */}
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Type your reply..."
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                rows={3}
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSendReply(inquiry.id)}
                                disabled={isSendingReply || !replyMessage.trim()}
                                className="w-full"
                              >
                                {isSendingReply ? 'Sending...' : 'Send Reply'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </Modal>
      </Container>
    </Section>
  )
}

export default Dashboard

