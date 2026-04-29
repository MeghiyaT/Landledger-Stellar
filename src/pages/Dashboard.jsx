import React, { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { getRegistrations, deleteRegistration, generateRegistrationCertificate } from '../services/registrations'
import { getSavedProperties, getUserProfile, updateUserProfile, uploadProfileDocument, getWalletAddresses } from '../services/user'
import { getUserProperties, getPurchasedProperties, getSoldProperties, deleteProperty, updateProperty } from '../services/properties'
import { VerifyPDFContent } from './VerifyCertificatePDF'
import { getInquiriesByUserId, getSentInquiries, updateInquiryStatus, getInquiryReplies, createInquiryReply, deleteInquiry } from '../services/inquiries'
import { getTransactions, updateTransactionStatus } from '../services/transactions'
import { getOffersBySellerId, getOffersByBuyerId, updateOfferStatus, acceptOfferAndCreateTransaction } from '../services/offers'
import { createEscrowTransaction } from '../services/escrow'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, deleteOldNotifications } from '../services/notifications'
import { downloadRegistrationCertificate } from '../utils/pdfGenerator'
import { registerPropertyOnChain, approveEscrowForProperty, approvePropertyNFTTransfer } from '../services/contracts'
import { updateRegistrationBlockchainData } from '../services/registrations'
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
import { fiatToTokens } from '../utils/tokenConversion'

const Dashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', cancelText: 'Cancel', confirmVariant: 'primary' })
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState('all')
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all')
  const [inquiries, setInquiries] = useState([])
  const [sentInquiries, setSentInquiries] = useState([])
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
  const [notifications, setNotifications] = useState([])
  const { walletAddress } = useWallet()
  const [uploadingAadhar, setUploadingAadhar] = useState(false)
  const [uploadingPan, setUploadingPan] = useState(false)
  const [profileDocuments, setProfileDocuments] = useState({ aadharCard: null, panCard: null })
  const [anchoringModal, setAnchoringModal] = useState({ open: false, registration: null, step: 'idle', error: null, txHash: null })
  const [processingTxId, setProcessingTxId] = useState(null)

  const handleAnchoring = async () => {
    if (!anchoringModal.registration || !walletAddress) return;

    const reg = anchoringModal.registration;
    setAnchoringModal(prev => ({ ...prev, step: 'preparing', error: null }));

    try {
      // Step 1: Preparing
      await new Promise(resolve => setTimeout(resolve, 800));
      setAnchoringModal(prev => ({ ...prev, step: 'signing' }));

      // Step 2: Signing & Anchoring
      const result = await registerPropertyOnChain(reg.property_address, 'Verified Asset', 0);

      if (result.txHash) {
        setAnchoringModal(prev => ({ ...prev, step: 'verifying', txHash: result.txHash }));

        // Step 3: Database Sync (non-fatal — blockchain tx is already committed)
        try {
          const { error: dbError } = await updateRegistrationBlockchainData(reg.id, result.propertyId, result.txHash);
          if (dbError) {
            console.warn('DB sync warning (columns may be missing):', dbError.message);
            // If columns are missing, log the hash so it's not lost
            console.log('📦 Blockchain TX Hash (save this):', result.txHash);
          }
        } catch (dbErr) {
          console.warn('DB sync error (non-fatal):', dbErr.message);
        }

        setAnchoringModal(prev => ({ ...prev, step: 'success' }));
        success('Asset anchored on Stellar!');
        await loadData();
      }
    } catch (err) {
      console.error('Anchoring error:', err);
      setAnchoringModal(prev => ({ ...prev, step: 'error', error: err.message || 'Blockchain synchronization failed. Please ensure your Freighter wallet is on Testnet.' }));
      error('Anchoring failed');
    }
  };

  const loadData = async (showSpinner = true) => {
    if (!user?.id) return

    if (showSpinner) setIsLoading(true)
    try {
      const [savedPropsResult, registrationsResult, propertiesResult, purchasedPropsResult, soldPropsResult, inquiriesResult, sentInquiriesResult, transactionsResult, profileResult, offersResult, myOffersResult, notificationsResult] = await Promise.all([
        getSavedProperties(user.id),
        getRegistrations(user.id, { status: 'all' }), // Load all initially, filter is handled by useEffect
        getUserProperties(user.id),
        getPurchasedProperties(user.id),
        getSoldProperties(user.id),
        getInquiriesByUserId(user.id), // Received inquiries
        getSentInquiries(user.id), // Sent inquiries
        getTransactions(user.id, {
          limit: 50,
          status: transactionStatusFilter !== 'all' ? transactionStatusFilter : undefined,
        }),
        getUserProfile(user.id),
        getOffersBySellerId(user.id), // Offers on my properties (as seller)
        getOffersByBuyerId(user.id), // My offers (as buyer)
        getNotifications(user.id), // User notifications
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

      if (sentInquiriesResult?.data) {
        setSentInquiries(sentInquiriesResult.data)
      } else {
        setSentInquiries([])
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

      if (notificationsResult.data) {
        setNotifications(notificationsResult.data)
        // Auto-clean notifications older than 15 days
        deleteOldNotifications(user.id, 15).catch(() => {})
      } else {
        setNotifications([])
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      if (showSpinner) setIsLoading(false)
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
      loadData(true)
      
      // Background poll every 30 seconds to keep messages/notifications fresh
      const interval = setInterval(() => {
        loadData(false)
      }, 30000)
      
      return () => clearInterval(interval)
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
      under_contract: { variant: 'warning', label: 'Under Contract' },
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

  const handleSendReply = async (inquiryId, senderType = 'owner') => {
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
        sender_type: senderType,
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

  const handleDeleteInquiry = async (inquiryId, type) => {
    setConfirmModal({
      open: true,
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message? This action cannot be undone.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const { error: delError } = await deleteInquiry(inquiryId)
        if (delError) {
          error('Failed to delete message: ' + delError.message)
        } else {
          success('Message deleted')
          if (selectedInquiry?.id === inquiryId) {
            setSelectedInquiry(null)
          }
          if (type === 'received') {
            setInquiries(prev => prev.filter(i => i.id !== inquiryId))
          } else {
            setSentInquiries(prev => prev.filter(i => i.id !== inquiryId))
          }
        }
        setConfirmModal({ ...confirmModal, open: false })
      }
    })
  }

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

        // Pre-authorize the Escrow contract and buyer wallet to complete the on-chain deed transfer.
        if (walletAddress && data?.offer?.property_id) {
          try {
            const { supabase } = await import('../lib/supabase')
            const { data: propData } = await supabase
              .from('properties')
              .select('blockchain_property_id, nft_token_id')
              .eq('id', data.offer.property_id)
              .single()

            const { data: wallets, error: walletError } = await getWalletAddresses([data.offer.buyer_id])
            if (walletError) {
              throw walletError
            }

            const buyerWallet = wallets?.[data.offer.buyer_id] || null
            const needsEscrowApproval = !!propData?.blockchain_property_id
            const needsNftApproval = !!propData?.nft_token_id && !!buyerWallet

            let escrowApprovalTxHash = null
            let nftApprovalTxHash = null

            if (needsEscrowApproval) {
              success('Please sign one more transaction in Freighter to authorize the escrow for on-chain transfer...')
              const escrowApproval = await approveEscrowForProperty(propData.blockchain_property_id)
              escrowApprovalTxHash = escrowApproval?.hash || null
            }

            if (propData?.nft_token_id && !buyerWallet) {
              throw new Error('The buyer must connect a wallet before the NFT deed approval can be signed.')
            }

            if (needsNftApproval) {
              success('Please sign one more transaction in Freighter to authorize the NFT deed transfer...')
              const nftApproval = await approvePropertyNFTTransfer(propData.nft_token_id, buyerWallet)
              nftApprovalTxHash = nftApproval?.hash || null
            }

            const buyerTxMetadata = {
              ...(data.buyerTransaction?.metadata || {}),
              escrow_ready: true,
              escrow_approval_tx_hash: escrowApprovalTxHash,
              nft_approval_tx_hash: nftApprovalTxHash,
            }

            const sellerTxMetadata = {
              ...(data.sellerTransaction?.metadata || {}),
              escrow_ready: true,
              escrow_approval_tx_hash: escrowApprovalTxHash,
              nft_approval_tx_hash: nftApprovalTxHash,
            }

            if (data.buyerTransaction?.id) {
              await supabase
                .from('transactions')
                .update({ metadata: buyerTxMetadata, updated_at: new Date().toISOString() })
                .eq('id', data.buyerTransaction.id)
            }

            if (data.sellerTransaction?.id) {
              await supabase
                .from('transactions')
                .update({ metadata: sellerTxMetadata, updated_at: new Date().toISOString() })
                .eq('id', data.sellerTransaction.id)
            }
          } catch (approveErr) {
            console.error('Could not complete the required on-chain approvals:', approveErr)
            error(`Offer accepted, but escrow is blocked until the seller signs the required approvals: ${approveErr.message || 'Approval failed.'}`)
          }
        }
        // Reload all data including transactions with a small delay to ensure DB has updated
        setTimeout(async () => {
          await loadData()
        }, 500)
      } else {
        const confirmMessage = `Are you sure you want to ${action} this offer?`
        setConfirmModal({
          open: true,
          title: 'Confirm Action',
          message: confirmMessage,
          confirmText: 'Proceed',
          cancelText: 'Cancel',
          onConfirm: async () => {
            const { error: updateError } = await updateOfferStatus(offerId, action, user.id)
            if (updateError) {
              error(`Failed to ${action} offer`)
            } else {
              success(`Offer ${action} successfully`)
              await loadData()
            }
            setConfirmModal({ ...confirmModal, open: false })
          }
        })
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
    if (transaction?.metadata?.escrow_ready === false) {
      error('The seller still needs to finish the required on-chain approvals before you can create escrow.')
      return
    }
    setProcessingTxId(transaction.id)
    try {
      success('Initiating escrow transaction in Freighter...')

      const isINR = transaction.currency === 'INR' || !transaction.currency;
      const amountInXlm = isINR ? fiatToTokens(transaction.amount, 'INR') : transaction.amount;

      const response = await createEscrowTransaction(
        transaction.property_id,
        transaction.metadata?.seller_id,
        transaction.metadata?.buyer_id || user.id,
        amountInXlm,
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
    } finally {
      setProcessingTxId(null)
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

        setConfirmModal({
          open: true,
          title: 'Confirm Completion',
          message: confirmMessage,
          confirmText: 'Continue',
          cancelText: 'Cancel',
          onConfirm: async () => {
            await performTransactionUpdate(transactionId, newStatus)
            setConfirmModal({ ...confirmModal, open: false })
          }
        })
        return
      }
    }

    await performTransactionUpdate(transactionId, newStatus)
  }

  const performTransactionUpdate = async (transactionId, newStatus) => {
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

  const handleAuthorizeNftRepair = async (transaction) => {
    const tokenId = transaction?.properties?.nft_token_id
    const buyerWallet = transaction?.metadata?.buyer_wallet

    if (!tokenId || !buyerWallet) {
      error('Missing NFT token or buyer wallet details for repair.')
      return
    }

    try {
      success('Please sign in Freighter to authorize the missing NFT deed transfer...')
      await approvePropertyNFTTransfer(tokenId, buyerWallet)
      success('NFT deed transfer approved. The buyer can now finalize the deed transfer.')
      await loadData()
    } catch (err) {
      console.error('Error authorizing NFT repair transfer:', err)
      error(err.message || 'Failed to authorize NFT deed transfer.')
    }
  }

  const handleFinalizeNftRepair = async (transaction) => {
    if (!transaction?.id) return
    await performTransactionUpdate(transaction.id, 'completed')
  }

  const visibleApprovedRegistrations = registrations
    .filter((registration) => registration.status === 'approved')
    .filter((registration) => {
      const linkedProperty =
        myProperties.find((p) => p.registration_id === registration.id) ||
        purchasedProperties.find((p) => p.registration_id === registration.id) ||
        soldProperties.find((p) => p.registration_id === registration.id)

      return !(linkedProperty?.sold_at && linkedProperty?.user_id !== user?.id)
    })

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
                      <Badge variant="primary">For Sale</Badge>
                      <Badge variant="primary">{property.type}</Badge>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{property.title}</h3>
                    <p className="text-gray-700 mb-2">{property.location}</p>
                    <p className="text-2xl font-semibold text-primary mb-4">
                      ₹{property.price?.toLocaleString()}
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
                          {propertyStatus !== 'sold' && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleUpdatePropertyStatus(property.id, 'sold')}
                            >
                              Mark as Sold
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
                <React.Fragment key={offer.id}>
                  <div className="card-pro p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          offer.status === 'accepted' ? 'success' :
                            offer.status === 'rejected' ? 'error' :
                              offer.status === 'withdrawn' ? 'secondary' :
                                'warning'
                        }>
                          {offer.status}
                        </Badge>
                        {(offer.blockchain_offer_id || offer.blockchain_tx_hash) && (
                          <div className="flex items-center text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Blockchain Verified
                          </div>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{offer.properties?.title || 'Property'}</h3>
                      <p className="text-sm text-gray-500 mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {offer.properties?.location}
                      </p>

                      <div className="flex items-center gap-8 mb-4 border-t border-gray-100 pt-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Your Offer</p>
                          <p className="text-2xl font-black text-primary">
                            ₹{offer.offer_amount?.toLocaleString()}

                          </p>
                        </div>
                        {offer.properties?.price && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Market Price</p>
                            <p className="text-lg font-bold text-gray-700">
                              ₹{offer.properties.price.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {offer.message && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 mb-4">
                          <p className="text-sm text-gray-600 italic">"{offer.message}"</p>
                        </div>
                      )}

                      <p className="text-[10px] text-gray-400 font-medium">
                        SENT ON {new Date(offer.created_at).toLocaleDateString().toUpperCase()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[180px]">
                      {offer.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="md"
                          className="w-full shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                          onClick={() => handleOfferAction(offer.id, 'withdrawn')}
                        >
                          Withdraw Offer
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => navigate(`/properties/${offer.property_id}`)}
                      >
                        View Property
                      </Button>
                    </div>
                  </div>

                  {offer.status === 'accepted' && (
                    <div className="status-banner-success mt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-white rounded-full">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold">Offer Accepted!</p>
                          <p className="text-xs opacity-90">Transaction established. Manage the next steps in your Transaction History.</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 bg-white border-green-200 text-green-700 hover:bg-green-50"
                        onClick={async () => {
                          try {
                            const transactionTabIndex = tabs.findIndex(t => t.label === 'Transactions')
                            if (transactionTabIndex === -1) {
                              error('Transactions tab not found. Please refresh the page.')
                              return
                            }
                            setTransactionStatusFilter('all')
                            if (user?.id) {
                              setIsLoading(true)
                              try {
                                const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                                if (transactionError) {
                                  error(`Failed to load transactions: ${transactionError.message || 'Unknown error'}`)
                                  setTransactions([])
                                } else if (transactionData) {
                                  setTransactions(transactionData)
                                }
                              } catch (err) {
                                error(`An unexpected error occurred: ${err.message || 'Please try again'}`)
                                setTransactions([])
                              } finally {
                                setIsLoading(false)
                              }
                            }
                            await loadData()
                            setActiveTab(transactionTabIndex)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          } catch (err) {
                            error(`Failed to view transactions: ${err.message || 'Please try again'}`)
                          }
                        }}
                      >
                        View Transaction
                      </Button>
                    </div>
                  )}
                </React.Fragment>
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
                <React.Fragment key={offer.id}>
                  <div className="card-pro p-6 bg-white">
                    <div className="flex items-start justify-between gap-6 mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={
                            offer.status === 'accepted' ? 'success' :
                              offer.status === 'rejected' ? 'error' :
                                offer.status === 'withdrawn' ? 'secondary' :
                                  'warning'
                          }>
                            {offer.status}
                          </Badge>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{offer.properties?.title || 'Property'}</h3>
                        <p className="text-sm text-gray-500 mb-4">{offer.properties?.location}</p>

                        <div className="flex items-center gap-8 border-t border-gray-100 pt-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Incoming Offer</p>
                            <p className="text-2xl font-black text-primary">
                              ₹{offer.offer_amount?.toLocaleString()}
                            </p>
                          </div>
                          {offer.properties?.price && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Your Listing</p>
                              <p className="text-lg font-bold text-gray-700">
                                ₹{offer.properties.price.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest">Received</p>
                        <p className="text-sm font-semibold text-gray-900">{new Date(offer.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {offer.message && (
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 mb-6 italic text-sm text-gray-700">
                        "{offer.message}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex gap-2">
                        {offer.status === 'pending' ? (
                          <>
                            <Button
                              variant="primary"
                              size="md"
                              className="shadow-md shadow-primary/20"
                              onClick={() => handleOfferAction(offer.id, 'accepted')}
                            >
                              Accept Offer
                            </Button>
                            <Button
                              variant="outline"
                              size="md"
                              onClick={() => handleOfferAction(offer.id, 'rejected')}
                            >
                              Decline
                            </Button>
                          </>
                        ) : offer.status === 'accepted' ? (
                          <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Deal Established
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/properties/${offer.property_id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>

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
                            const transactionTabIndex = tabs.findIndex(t => t.label === 'Transactions')
                            if (transactionTabIndex === -1) {
                              error('Transactions tab not found. Please refresh the page.')
                              return
                            }
                            setTransactionStatusFilter('all')
                            if (user?.id) {
                              setIsLoading(true)
                              try {
                                const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                                if (transactionError) {
                                  error(`Failed to load transactions: ${transactionError.message || 'Unknown error'}`)
                                  setTransactions([])
                                } else if (transactionData) {
                                  setTransactions(transactionData)
                                }
                              } catch (err) {
                                error(`An unexpected error occurred: ${err.message || 'Please try again'}`)
                                setTransactions([])
                              } finally {
                                setIsLoading(false)
                              }
                            }
                            await loadData()
                            setActiveTab(transactionTabIndex)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          } catch (err) {
                            error(`Failed to view transactions: ${err.message || 'Please try again'}`)
                          }
                        }}
                      >
                        View Transaction
                      </Button>
                    </div>
                  )}
                </React.Fragment>
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
                      <div key={property.id} className="card-pro overflow-hidden bg-white group flex flex-col">
                        <div className="aspect-[16/9] overflow-hidden relative">
                          <img
                            src={getSafeImageUrl(property.images?.[0])}
                            alt={property.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.target.src = PROPERTY_PLACEHOLDER
                            }}
                          />
                          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                            <Badge variant="primary" className="shadow-lg backdrop-blur-sm bg-primary/90">Market Active</Badge>
                            <BlockchainBadge property={property} />
                          </div>
                        </div>

                        <div className="p-5 flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{property.type}</span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1 leading-tight line-clamp-1">
                            <Link to={`/properties/${property.id}`} className="hover:text-primary transition-colors">
                              {property.title}
                            </Link>
                          </h3>
                          <p className="text-sm text-gray-500 mb-4 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {property.location}
                          </p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-primary">₹{parseFloat(property.price).toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 mt-auto flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                            className="flex-1 shadow-md shadow-primary/10"
                          >
                            Manage Listing
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/properties/${property.id}`)}
                            className="aspect-square p-0 w-9 flex items-center justify-center"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registered Properties Section — exclude already-sold properties */}
              {visibleApprovedRegistrations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Registered Properties ({visibleApprovedRegistrations.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {visibleApprovedRegistrations.map((registration) => {
                      const linkedProperty =
                        myProperties.find((p) => p.registration_id === registration.id) ||
                        purchasedProperties.find((p) => p.registration_id === registration.id) ||
                        soldProperties.find((p) => p.registration_id === registration.id)

                      const isSold = !!linkedProperty?.sold_at

                      return (
                      <div key={registration.id} className="card-pro overflow-hidden bg-white group">
                        <div className="p-6 border-b border-gray-100">
                          <div className="flex items-center justify-between mb-4">
                            {isSold
                              ? <Badge variant="warning" className="uppercase tracking-widest text-[9px] px-2 py-0.5">Ownership Transferred</Badge>
                              : <Badge variant="success" className="uppercase tracking-widest text-[9px] px-2 py-0.5">Verified Record</Badge>
                            }
                            <span className="text-[10px] text-gray-300 font-mono group-hover:text-primary transition-colors">#{registration.id.slice(0, 8)}</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight line-clamp-1" title={registration.property_description || 'Registered Property'}>
                            {registration.property_description || 'Registered Property'}
                          </h3>
                          <p className="text-xs text-gray-500 mb-4 line-clamp-2" title={registration.property_address}>
                            {registration.property_address}
                          </p>
                          <div className="flex items-center text-sm text-gray-500 mb-4">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold mr-2">{registration.property_type.toUpperCase()}</span>
                            {registration.property_size && (
                              <span className="text-xs border-l pl-2 border-gray-200">{registration.property_size} SQFT</span>
                            )}
                          </div>

                          {registration.blockchain_tx_hash ? (
                            <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100/50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <span className="text-[10px] font-bold text-blue-700 tracking-tighter">LEDGER ANCHORED</span>
                              </div>
                              <a
                                href={`https://stellar.expert/explorer/testnet/tx/${registration.blockchain_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-black text-blue-500 hover:text-blue-700 underline flex items-center"
                              >
                                VIEW PROOF
                              </a>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full text-[10px] h-9 tracking-widest font-black uppercase shadow-lg shadow-secondary/10"
                              onClick={() => {
                                if (!walletAddress) {
                                  error('Freighter wallet required for blockchain anchoring.');
                                  return;
                                }
                                setAnchoringModal({
                                  open: true,
                                  registration: registration,
                                  step: 'confirm',
                                  error: null,
                                  txHash: null
                                });
                              }}
                            >
                              Mint Title Deed
                            </Button>
                          )}
                        </div>

                        <div className="bg-gray-50/50 p-4 flex items-center justify-between">
                          <div className="flex gap-3">
                            <button
                              onClick={() => navigate(`/verify/${registration.id}`)}
                              className="text-[10px] font-bold text-gray-500 hover:text-primary flex items-center gap-1 uppercase tracking-wider"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              Verify
                            </button>
                            {!isSold && (
                              <button
                                onClick={() => navigate('/sell-property')}
                                className="text-[10px] font-bold text-gray-500 hover:text-primary flex items-center gap-1 uppercase tracking-wider"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                List
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => setDeleteModal({ open: true, type: 'registration', id: registration.id, title: registration.property_address, status: registration.status })}
                            className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      )
                    })}
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
                visibleApprovedRegistrations.length === 0 &&
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
                  <div className="status-banner-info flex items-center justify-between border-l-primary bg-primary/5">
                    <TokenBalance className="text-xl font-bold text-primary" />
                    <TokenConversionInfo variant="badge" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    XLM token balance on Stellar Testnet network.
                  </p>
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
              <div className="status-banner-info border-l-primary bg-white shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Aadhar Identification</h4>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Government Verified ID</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Your primary identification document used to verify property ownership across legal jurisdictions.
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
              <div className="status-banner-info border-l-primary bg-white shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Tax Identification (PAN)</h4>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Financial Verification</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Required for financial compliance and large-scale property transactions on the LandLedger platform.
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
              <div className="card-pro p-12 text-center bg-gray-50/30">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Ledger Empty</h3>
                <p className="text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
                  Your property transaction history will appear here once you've initiated or completed an asset transfer.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button
                    variant="primary"
                    size="md"
                    className="shadow-md shadow-primary/10"
                    onClick={async () => {
                      if (user?.id) {
                        setIsLoading(true)
                        try {
                          const { data: transactionData, error: transactionError } = await getTransactions(user.id, { limit: 50 })
                          if (!transactionError && transactionData) {
                            setTransactions(transactionData)
                            if (transactionData.length === 0) {
                              error('No transactions found on the ledger.')
                            }
                          } else {
                            error(`Synchronization failed: ${transactionError?.message || 'Network error'}`)
                            setTransactions([])
                          }
                        } catch (err) {
                          error('A ledger synchronization error occurred.')
                          setTransactions([])
                        } finally {
                          setIsLoading(false)
                        }
                      }
                    }}
                  >
                    Refresh Ledger
                  </Button>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    Last Sync: {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => {
                  const isBuyer = transaction.transaction_type === 'purchase'
                  const isInProgress = transaction.status === 'in_progress'
                  const isPending = transaction.status === 'pending'
                  const isCompleted = transaction.status === 'completed'
                  const isBlockchainOnly = transaction.metadata?.is_blockchain_only
                  const txHash = transaction.blockchain_tx_hash
                  const deadline = transaction.metadata?.deadline
                  const isProcessing = processingTxId === transaction.id
                  const needsNftRepair =
                    isCompleted &&
                    transaction.transaction_type === 'purchase' &&
                    transaction.properties?.nft_token_id &&
                    !transaction.properties?.nft_transfer_tx_hash
                  const sellerNeedsNftApproval =
                    isCompleted &&
                    transaction.transaction_type === 'sale' &&
                    transaction.properties?.nft_token_id &&
                    !transaction.properties?.nft_transfer_tx_hash

                  const Spinner = () => (
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )

                  const statusColor = isCompleted ? 'bg-emerald-50 border-emerald-100' : isInProgress ? 'bg-blue-50 border-blue-100' : isPending ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'

                  return (
                    <div key={transaction.id} className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${statusColor}`}>
                      {/* ── Top bar: type · status · amount ── */}
                      <div className="flex items-center justify-between px-5 pt-5 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/80 px-2 py-0.5 rounded-full border border-gray-200">
                            {transaction.transaction_type === 'purchase' ? 'Sale' : 'Sale'}
                          </span>
                          <Badge
                            variant={isCompleted ? 'success' : isInProgress ? 'primary' : isPending ? 'warning' : 'error'}
                          >
                            {transaction.status.replace('_', ' ')}
                          </Badge>
                          {txHash && !isBlockchainOnly && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Blockchain Verified
                            </span>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <p className="text-2xl font-black text-gray-900 leading-none">
                            {transaction.currency === 'XLM'
                              ? `${parseFloat(transaction.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })} XLM`
                              : transaction.currency === 'BLOCKCHAIN'
                              ? <span className="text-base font-semibold text-gray-500">Blockchain Tx</span>
                              : `${transaction.currency} ${parseFloat(transaction.amount || 0).toLocaleString('en-IN')}`
                            }
                          </p>
                          {transaction.currency === 'XLM' && transaction.amount && (
                            <p className="text-xs text-gray-400 mt-0.5">≈ ₹{parseFloat(transaction.amount * 100).toLocaleString('en-IN')}</p>
                          )}
                        </div>
                      </div>

                      {/* ── Body: property + description ── */}
                      <div className="px-5 pb-4 space-y-2">
                        {(transaction.metadata?.property_title || transaction.metadata?.property_location) && (
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <div>
                              {transaction.metadata?.property_title && (
                                <p className="text-sm font-semibold text-gray-800 leading-tight">{transaction.metadata.property_title}</p>
                              )}
                              {transaction.metadata?.property_location && (
                                <p className="text-xs text-gray-500">{transaction.metadata.property_location}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {transaction.description && (
                          <p className="text-xs text-gray-500 leading-relaxed">{transaction.description}</p>
                        )}
                        <p className="text-[11px] text-gray-400">
                          {new Date(transaction.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Deadline pill */}
                        {deadline && isInProgress && (
                          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 w-fit">
                            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <p className="text-xs font-semibold text-orange-800">Escrow unlocks {new Date(deadline * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              <p className="text-[10px] text-orange-600">{new Date(deadline * 1000).toLocaleTimeString()} · Refund available after this time</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Blockchain proof row ── */}
                      <div className="mx-5 mb-4 rounded-xl overflow-hidden border border-gray-200 bg-white/70">
                        {txHash ? (
                          <div className="flex items-center gap-3 px-4 py-3">
                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tx Hash</p>
                              <a
                                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 font-mono truncate block"
                              >
                                {txHash.substring(0, 20)}…{txHash.slice(-8)}
                              </a>
                            </div>
                            {transaction.metadata?.escrow_transaction_id && (
                              <div className="flex-shrink-0 text-right">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Escrow ID</p>
                                <span className="text-xs text-gray-600 font-mono">{String(transaction.metadata.escrow_transaction_id).substring(0, 10)}…</span>
                              </div>
                            )}
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider whitespace-nowrap"
                            >
                              View Full Details on StellarExpert →
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-3">
                            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-gray-400">No blockchain record linked yet</p>
                          </div>
                        )}
                        {isCompleted && transaction.currency === 'XLM' && (
                          <div className="px-4 py-2 border-t border-gray-100 bg-emerald-50/50">
                            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Tokens transferred &amp; ownership recorded on Stellar
                            </p>
                          </div>
                        )}
                        {(needsNftRepair || sellerNeedsNftApproval) && (
                          <div className="px-4 py-2 border-t border-gray-100 bg-amber-50/60">
                            <p className="text-xs text-amber-800 font-semibold">
                              NFT deed transfer still needs repair for this completed sale.
                            </p>
                          </div>
                        )}
                        {isInProgress && transaction.currency === 'XLM' && txHash && (
                          <div className="px-4 py-2 border-t border-gray-100 bg-amber-50/50">
                            <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              XLM locked in escrow — awaiting completion
                            </p>
                          </div>
                        )}
                      </div>

                      {/* ── Action buttons ── */}
                      {!isBlockchainOnly && isPending && (
                        <div className="flex gap-2 px-5 pb-5">
                          {isBuyer ? (
                            <Button
                              variant="primary" size="sm"
                              onClick={() => handleCreateEscrowAndPay(transaction)}
                              disabled={isProcessing}
                              className="flex-1"
                            >
                              {isProcessing ? <span className="flex items-center gap-2 justify-center"><Spinner /> Processing…</span> : 'Pay with XLM'}
                            </Button>
                          ) : (
                            <p className="text-xs text-gray-400 italic flex-1 py-2">Awaiting buyer payment</p>
                          )}
                          <Button
                            variant="outline" size="sm"
                            onClick={() => handleTransactionStatusUpdate(transaction.id, 'failed')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? <Spinner /> : 'Cancel'}
                          </Button>
                        </div>
                      )}

                      {!isBlockchainOnly && isInProgress && (
                        <div className="flex gap-2 px-5 pb-5">
                          {isBuyer ? (
                            <>
                              <Button
                                variant="primary" size="sm"
                                onClick={() => handleTransactionStatusUpdate(transaction.id, 'completed')}
                                disabled={isProcessing}
                                className="flex-1"
                              >
                                {isProcessing ? <span className="flex items-center gap-2 justify-center"><Spinner /> Processing…</span> : 'Release Funds to Seller'}
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleTransactionStatusUpdate(transaction.id, 'failed')}
                                disabled={isProcessing}
                              >
                                {isProcessing ? <Spinner /> : 'Cancel & Refund'}
                              </Button>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400 italic flex-1 py-2">Awaiting buyer to release funds after property handover</p>
                          )}
                        </div>
                      )}

                      {sellerNeedsNftApproval && (
                        <div className="flex gap-2 px-5 pb-5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAuthorizeNftRepair(transaction)}
                            className="flex-1"
                          >
                            Authorize NFT Transfer
                          </Button>
                        </div>
                      )}

                      {needsNftRepair && (
                        <div className="flex gap-2 px-5 pb-5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleFinalizeNftRepair(transaction)}
                            className="flex-1"
                          >
                            Finalize Deed Transfer
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      label: 'Messages',
      content: (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Messages & Inquiries</h3>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} padding="md"><Skeleton height="h-32" /></Card>
              ))}
            </div>
          ) : inquiries.length === 0 && sentInquiries.length === 0 ? (
            <Card padding="lg" className="text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-gray-700">No messages yet. When you inquire about a property, or someone inquires about yours, it will appear here.</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Inbox (Received) */}
              {inquiries.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-4 text-gray-800">Inbox (Properties you own)</h4>
                  <div className="space-y-4">
                    {inquiries.map((inquiry) => (
                      <div key={inquiry.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-gray-900 text-lg">{inquiry.properties?.title || 'Unknown Property'}</h4>
                              <Badge variant={inquiry.status === 'new' ? 'warning' : 'success'} className="px-2.5 py-0.5 text-xs">
                                {inquiry.status}
                              </Badge>
                            </div>
                            <div className="flex items-center text-sm text-gray-500 gap-2">
                              <span className="font-medium text-gray-700">From: {inquiry.buyer_name}</span>
                              <span>•</span>
                              <span>{new Date(inquiry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() => handleViewInquiry(inquiry)}>
                              {selectedInquiry?.id === inquiry.id ? 'Close' : 'View Thread'}
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 px-3" onClick={() => handleDeleteInquiry(inquiry.id, 'received')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </Button>
                          </div>
                        </div>

                        {inquiry.message && <div className="bg-gray-50/50 rounded-xl p-4 text-gray-700 text-sm mb-2">{inquiry.message}</div>}

                        {/* Thread */}
                        {selectedInquiry?.id === inquiry.id && (
                          <div className="mt-6 pt-6 border-t border-gray-100">
                            <div className="space-y-4 mb-6 max-h-[350px] overflow-y-auto px-2">
                              {inquiryReplies.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-sm">No replies yet. Start the conversation.</div>
                              ) : (
                                inquiryReplies.map((reply) => (
                                  <div key={reply.id} className={`flex flex-col ${reply.sender_type === 'owner' ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-baseline gap-2 mb-1 px-1">
                                      <span className="text-xs font-semibold text-gray-700">{reply.sender_type === 'owner' ? 'You' : inquiry.buyer_name}</span>
                                      <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm ${reply.sender_type === 'owner' ? 'bg-primary text-white rounded-br-sm shadow-md shadow-primary/20' : 'bg-gray-100 text-gray-800 rounded-bl-sm border border-gray-200'}`}>
                                      <p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                              <Textarea placeholder="Type your reply..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={1} className="flex-1 border-0 focus:ring-0 resize-none bg-transparent pt-3 pb-2 px-3 min-h-[44px] max-h-[120px]" style={{ boxShadow: 'none' }} />
                              <Button onClick={() => handleSendReply(inquiry.id, 'owner')} disabled={isSendingReply || !replyMessage.trim()} className="rounded-xl h-11 px-5 font-medium mb-0.5" variant="primary">
                                {isSendingReply ? '...' : 'Send'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent */}
              {sentInquiries.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-4 text-gray-800">Sent Inquiries</h4>
                  <div className="space-y-4">
                    {sentInquiries.map((inquiry) => (
                      <div key={inquiry.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-gray-900 text-lg">{inquiry.properties?.title || 'Unknown Property'}</h4>
                              <Badge variant="secondary" className="px-2.5 py-0.5 text-xs bg-gray-100 text-gray-700">Sent</Badge>
                            </div>
                            <div className="flex items-center text-sm text-gray-500 gap-2">
                              <span>{new Date(inquiry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() => handleViewInquiry(inquiry)}>
                              {selectedInquiry?.id === inquiry.id ? 'Close' : 'View Thread'}
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 px-3" onClick={() => handleDeleteInquiry(inquiry.id, 'sent')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </Button>
                          </div>
                        </div>

                        {inquiry.message && <div className="bg-gray-50/50 rounded-xl p-4 text-gray-700 text-sm mb-2">{inquiry.message}</div>}

                        {/* Thread */}
                        {selectedInquiry?.id === inquiry.id && (
                          <div className="mt-6 pt-6 border-t border-gray-100">
                            <div className="space-y-4 mb-6 max-h-[350px] overflow-y-auto px-2">
                              {inquiryReplies.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-sm">No replies yet.</div>
                              ) : (
                                inquiryReplies.map((reply) => (
                                  <div key={reply.id} className={`flex flex-col ${reply.sender_type === 'buyer' ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-baseline gap-2 mb-1 px-1">
                                      <span className="text-xs font-semibold text-gray-700">{reply.sender_type === 'buyer' ? 'You' : 'Owner'}</span>
                                      <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm ${reply.sender_type === 'buyer' ? 'bg-primary text-white rounded-br-sm shadow-md shadow-primary/20' : 'bg-gray-100 text-gray-800 rounded-bl-sm border border-gray-200'}`}>
                                      <p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                              <Textarea placeholder="Type your reply..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={1} className="flex-1 border-0 focus:ring-0 resize-none bg-transparent pt-3 pb-2 px-3 min-h-[44px] max-h-[120px]" style={{ boxShadow: 'none' }} />
                              <Button onClick={() => handleSendReply(inquiry.id, 'buyer')} disabled={isSendingReply || !replyMessage.trim()} className="rounded-xl h-11 px-5 font-medium mb-0.5" variant="primary">
                                {isSendingReply ? '...' : 'Send'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Notifications',
      content: (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Notifications</h3>
            <div className="flex gap-2">
              {notifications.some(n => !n.read) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { error: markError } = await markAllNotificationsAsRead(user.id)
                    if (!markError) {
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                      success('All notifications marked as read')
                    }
                  }}
                >
                  Mark all as read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={async () => {
                    setConfirmModal({
                      open: true,
                      title: 'Delete All Notifications',
                      message: 'Are you sure you want to delete all your notifications? This cannot be undone.',
                      confirmText: 'Delete All',
                      confirmVariant: 'danger',
                      cancelText: 'Cancel',
                      onConfirm: async () => {
                        await Promise.all(
                          notifications.map(n => deleteNotification(n.id, user.id))
                        )
                        setNotifications([])
                        success('All notifications deleted')
                        setConfirmModal({ ...confirmModal, open: false })
                      }
                    })
                  }}
                >
                  Delete All
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-20" />
                </Card>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <Card padding="lg" className="text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-gray-700">No notifications yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  padding="md"
                  className={`transition-all ${!notification.read ? 'border-l-4 border-l-primary bg-blue-50/30' : 'opacity-80'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && <Badge variant="primary" className="text-[10px] px-1.5 py-0">New</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const { error: markError } = await markNotificationAsRead(notification.id, user.id)
                            if (!markError) {
                              setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
                            }
                          }}
                          className="text-xs h-7"
                        >
                          Mark read
                        </Button>
                      )}
                      <button
                        onClick={async () => {
                          const { error: delError } = await deleteNotification(notification.id, user.id)
                          if (!delError) {
                            setNotifications(prev => prev.filter(n => n.id !== notification.id))
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete notification"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {notification.link && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={async () => {
                        // Mark as read if unread
                        if (!notification.read) {
                          setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
                          markNotificationAsRead(notification.id, user.id).catch(err => {
                            console.error('Failed to mark notification as read:', err)
                          })
                        }

                        if (notification.link.startsWith('http')) {
                          window.open(notification.link, '_blank')
                        } else {
                          navigate(notification.link)
                        }
                      }}
                    >
                      View Details
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Verify Certificate',
      content: (
        <div>
          <p className="text-sm text-gray-500 mb-6">
            Upload any LandLedger-issued PDF certificate below to instantly verify its authenticity against our official registry and the Stellar blockchain.
          </p>
          <VerifyPDFContent />
        </div>
      ),
    },
  ]

  // Handle tab from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')

    if (tabParam) {
      const tabIndex = tabs.findIndex(t => t.label.toLowerCase() === tabParam.toLowerCase())
      if (tabIndex !== -1) {
        setActiveTab(tabIndex)
        localStorage.setItem('dashboardActiveTab', tabIndex.toString())
      }
    }
  }, [location.search, tabs.length])

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
              <style dangerouslySetInnerHTML={{ __html: `\n                .hide-scrollbar::-webkit-scrollbar {\n                  display: none;\n                }\n              ` }} />
              <div className="flex md:flex-row lg:flex-col gap-2 overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {tabs.map((tab, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveTab(index)
                      localStorage.setItem('dashboardActiveTab', index.toString())
                      
                      // Keep URL in sync so refreshing stays on the right tab
                      const params = new URLSearchParams(location.search)
                      params.set('tab', tab.label.toLowerCase())
                      navigate(`?${params.toString()}`, { replace: true })
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

        {/* Global Confirmation Modal */}
        <Modal
          isOpen={confirmModal.open}
          onClose={() => setConfirmModal({ ...confirmModal, open: false })}
          title={confirmModal.title}
        >
          <div className="py-4">
            <p className="text-gray-700 mb-6">{confirmModal.message}</p>
            <div className="flex gap-4">
              <Button
                variant={confirmModal.confirmVariant || 'primary'}
                className="flex-1"
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
              >
                {confirmModal.cancelText || 'Cancel'}
              </Button>
            </div>
          </div>
        </Modal>

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
                                    className={`p-3 rounded-lg ${reply.sender_type === 'owner'
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

        {/* Anchoring Progress Modal */}
        <Modal
          isOpen={anchoringModal.open}
          onClose={() => anchoringModal.step !== 'signing' && anchoringModal.step !== 'verifying' && setAnchoringModal({ ...anchoringModal, open: false })}
          title="Anchoring Property on Stellar"
          size="md"
        >
          <div className="py-4">
            {anchoringModal.step === 'confirm' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Create Immutable Title Deed</h3>
                <p className="text-gray-600 mb-6">
                  This will anchor your property registration on the Stellar blockchain, creating a permanent, verifiable cryptographic record of ownership.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setAnchoringModal({ ...anchoringModal, open: false })}>Cancel</Button>
                  <Button variant="primary" className="flex-1" onClick={handleAnchoring}>Proceed to Anchor</Button>
                </div>
              </div>
            )}

            {(['preparing', 'signing', 'verifying'].includes(anchoringModal.step)) && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
                <h3 className="text-lg font-bold mb-2 capitalize">{anchoringModal.step}...</h3>
                <p className="text-gray-500">
                  {anchoringModal.step === 'preparing' && 'Preparing transaction payload...'}
                  {anchoringModal.step === 'signing' && 'Awaiting signature from Freighter wallet...'}
                  {anchoringModal.step === 'verifying' && 'Broadcasting to Stellar network and verifying proof...'}
                </p>
              </div>
            )}

            {anchoringModal.step === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Anchoring Complete!</h3>
                <p className="text-gray-600 mb-6">Your property title deed has been successfully minted and anchored on the Stellar Ledger.</p>

                {anchoringModal.txHash && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Transaction Hash</p>
                    <p className="text-xs font-mono text-gray-600 break-all">{anchoringModal.txHash}</p>
                  </div>
                )}

                <Button variant="primary" className="w-full" onClick={() => setAnchoringModal({ ...anchoringModal, open: false })}>Done</Button>
              </div>
            )}

            {anchoringModal.step === 'error' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-900 mb-2">Anchoring Failed</h3>
                <p className="text-gray-600 mb-6">{anchoringModal.error}</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setAnchoringModal({ ...anchoringModal, open: false })}>Close</Button>
                  <Button variant="primary" className="flex-1" onClick={handleAnchoring}>Try Again</Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </Container>
    </Section>
  )
}

export default Dashboard
