import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import {
  getAllRegistrations,
  approveRegistration,
  rejectRegistration,
  setRegistrationInReview,
  getRegistrationStats,
} from '../services/admin'
import { getAllProperties, adminRemoveProperty } from '../services/properties'
import { registerPropertyOnChain } from '../services/contracts'
import { updateRegistrationBlockchainData } from '../services/registrations'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import Skeleton from '../components/ui/Skeleton'
import Toast from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import Modal from '../components/ui/Modal'
import Textarea from '../components/ui/Textarea'
import { PROPERTY_PLACEHOLDER, getSafeImageUrl } from '../utils/placeholders'

const AdminDashboard = () => {
  const { user } = useUser()
  const { toasts, success, error, removeToast } = useToast()
  const [activeTab, setActiveTab] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [registrations, setRegistrations] = useState([])
  const [properties, setProperties] = useState([])
  const [stats, setStats] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null, // 'approve', 'reject', 'in_review'
    registration: null,
  })
  const [removalModal, setRemovalModal] = useState({
    open: false,
    property: null,
  })
  const [reviewNotes, setReviewNotes] = useState('')
  const [removalReason, setRemovalReason] = useState('')
  const [processingAction, setProcessingAction] = useState(false)
  const [processingRemoval, setProcessingRemoval] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {}
      const { data, error } = await getAllRegistrations(filters)
      
      if (error) throw error
      
      // Debug: Log registration statuses
      console.log('Loaded registrations with statuses:', 
        (data || []).map(r => ({
          id: r.id, 
          status: r.status,
          property_address: r.property_address || 'N/A',
          is_approved: r.status === 'approved'
        }))
      )
      
      setRegistrations(data || [])
    } catch (err) {
      console.error('Error loading registrations:', err)
      error('Failed to load registrations')
      setRegistrations([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadProperties = async () => {
    setIsLoading(true)
    try {
      const { data, error: propertiesError } = await getAllProperties({ includeRemoved: true })
      if (propertiesError) {
        console.error('Properties error:', propertiesError)
        error(`Failed to load properties: ${propertiesError.message || 'Please check console for details'}`)
        setProperties([])
      } else {
        console.log('Properties loaded:', data?.length || 0)
        setProperties(data || [])
      }
    } catch (err) {
      console.error('Error loading properties:', err)
      error('Failed to load properties. Please try again.')
      setProperties([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      console.log('📊 Loading registration statistics...')
      const { data, error: statsError } = await getRegistrationStats()
      if (statsError) {
        console.error('❌ Error loading stats:', statsError)
        setStats(null)
      } else {
        console.log('✅ Stats loaded:', data)
        setStats(data)
      }
    } catch (err) {
      console.error('❌ Exception loading stats:', err)
      setStats(null)
    }
  }

  // Load stats on initial mount
  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    if (activeTab === 0) {
      loadData()
      loadStats() // Reload stats when on registrations tab
    } else if (activeTab === 1) {
      loadProperties()
    }
  }, [statusFilter, activeTab])

  const handleAction = async () => {
    if (!actionModal.registration || !actionModal.type || !user?.id) {
      console.error('Missing required data for action:', { 
        hasRegistration: !!actionModal.registration,
        hasType: !!actionModal.type,
        hasUserId: !!user?.id
      });
      return;
    }

    console.log('Handling action:', actionModal.type, 'for registration:', actionModal.registration.id);
    setProcessingAction(true);

    try {
      let result;
      const registrationId = actionModal.registration.id;
      console.log('Registration ID:', registrationId, 'Action type:', actionModal.type);

      switch (actionModal.type) {
        case 'approve': {
          result = await approveRegistration(registrationId, user.id, reviewNotes || null);

          // Auto-mint title deed on Stellar as soon as registration is approved
          if (result && !result.error) {
            const reg = actionModal.registration;
            try {
              console.log('🔗 Auto-minting title deed for registration:', registrationId);
              const blockchainResult = await registerPropertyOnChain(
                reg.property_address || 'Verified Asset',
                reg.property_address || 'Unknown Location',
                0
              );
              if (blockchainResult.txHash) {
                await updateRegistrationBlockchainData(
                  registrationId,
                  blockchainResult.propertyId,
                  blockchainResult.txHash
                );
                console.log('✅ Title deed minted automatically. TX:', blockchainResult.txHash);
              }
            } catch (mintErr) {
              // Non-fatal: approval already succeeded, minting can be retried manually
              console.warn('⚠️ Auto-mint failed (approval still succeeded):', mintErr.message);
            }
          }
          break;
        }
        case 'reject':
          if (!reviewNotes.trim()) {
            error('Review notes are required when rejecting a registration');
            setProcessingAction(false);
            return;
          }
          result = await rejectRegistration(registrationId, user.id, reviewNotes);
          break;
        case 'in_review':
          result = await setRegistrationInReview(registrationId, user.id);
          break;
        case 'remove':
          console.log('Processing remove action for registration:', registrationId);
          if (!reviewNotes.trim()) {
            error('Please provide a reason for removing this registration');
            setProcessingAction(false);
            return;
          }
          // Set status to 'rejected' for removed registrations with a special prefix
          result = await rejectRegistration(registrationId, user.id, `[REMOVED] ${reviewNotes}`);
          break;
        default:
          return
      }

      if (result.error) {
        error(result.error.message || 'Failed to update registration status')
      } else {
        const actionLabels = {
          approve: 'approved',
          reject: 'rejected',
          in_review: 'set to in review',
          remove: 'removed',
        }
        success(`Registration ${actionLabels[actionModal.type]} successfully`)
        setActionModal({ open: false, type: null, registration: null })
        setReviewNotes('')
        await loadData()
        await loadStats() // Reload stats after status change
      }
    } catch (err) {
      console.error('Error updating registration:', err)
      error('An error occurred. Please try again.')
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRemoveProperty = async () => {
    if (!removalModal.property || !user?.id || !removalReason.trim()) {
      error('Please provide a reason for removing this property')
      return
    }

    setProcessingRemoval(true)

    try {
      const result = await adminRemoveProperty(
        removalModal.property.id,
        user.id,
        removalReason
      )

      if (result.error) {
        error(result.error.message || 'Failed to remove property')
      } else {
        success('Property removed successfully')
        setRemovalModal({ open: false, property: null })
        setRemovalReason('')
        await loadProperties()
      }
    } catch (err) {
      console.error('Error removing property:', err)
      error('An error occurred. Please try again.')
    } finally {
      setProcessingRemoval(false)
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
    if (property.removed_at) {
      return <Badge variant="error">Removed</Badge>
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const tabs = [
    {
      label: 'All Registrations',
      content: (
        <div>
          {/* Status Filter */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All ({stats?.total || 0})
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              Pending ({stats?.pending || 0})
            </Button>
            <Button
              variant={statusFilter === 'in_review' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('in_review')}
            >
              In Review ({stats?.in_review || 0})
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
            >
              Approved ({stats?.approved || 0})
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
            >
              Rejected ({stats?.rejected || 0})
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" />
                </Card>
              ))}
            </div>
          ) : registrations.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-700">
                {statusFilter === 'all'
                  ? 'No registrations found'
                  : `No ${statusFilter} registrations found`}
              </p>
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
                      <div className="flex items-center gap-4 text-sm text-gray-700 flex-wrap">
                        <span>
                          <strong>Submitted:</strong> {formatDate(registration.submitted_date)}
                        </span>
                        {registration.reviewed_at && (
                          <span>
                            <strong>Reviewed:</strong> {formatDate(registration.reviewed_at)}
                          </span>
                        )}
                        {registration.reviewed_by && (
                          <span>
                            <strong>Reviewed by:</strong> {registration.reviewed_by.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(registration.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-700">
                        <strong>Type:</strong> {registration.property_type}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Size:</strong>{' '}
                        {registration.property_size
                          ? `${registration.property_size} sq ft`
                          : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>State:</strong> {registration.property_state || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">
                        <strong>Owner:</strong> {registration.owner_name}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Email:</strong> {registration.owner_email}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Phone:</strong> {registration.owner_phone}
                      </p>
                    </div>
                  </div>

                  {registration.property_description && (
                    <p className="text-sm text-gray-700 mb-4">
                      <strong>Description:</strong> {registration.property_description}
                    </p>
                  )}

                  {/* Documents Section */}
                  <div className="mb-4">
                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm font-semibold mb-3 text-gray-900">Documents</p>
                      <div className="space-y-2">
                        {registration.extract_712 ? (
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
                        ) : (
                          <p className="text-sm text-gray-500">No 7/12 Extract uploaded</p>
                        )}
                        {registration.aadhar_card && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={registration.aadhar_card}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex-1"
                            >
                              Aadhar Card
                            </a>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        )}
                        {registration.pan_card && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={registration.pan_card}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex-1"
                            >
                              PAN Card
                            </a>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        )}
                        {registration.property_document && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={registration.property_document}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex-1"
                            >
                              Property Document
                            </a>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        )}
                        {registration.documents && Array.isArray(registration.documents) && registration.documents.length > 0 ? (
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
                        ) : (
                          <p className="text-sm text-gray-500">No additional documents uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {registration.review_notes && (
                    <div className="mb-4 p-3 bg-gray-100 rounded">
                      <p className="text-sm">
                        <strong>Review Notes:</strong> {registration.review_notes}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {registration.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'in_review',
                            registration,
                          })
                        }
                      >
                        Set In Review
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'approve',
                            registration,
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'reject',
                            registration,
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {registration.status === 'in_review' && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'approve',
                            registration,
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'reject',
                            registration,
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Debug: Show current status */}
                  <div className="mt-2 text-xs text-gray-500">
                    Debug - Status: {registration.status}
                  </div>

                  {/* Remove Registration Button */}
                  {registration.status === 'approved' && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      <Button
                        variant="error"
                        size="sm"
                        onClick={() => {
                          console.log('Remove button clicked for registration:', registration);
                          setActionModal({
                            open: true,
                            type: 'remove',
                            registration,
                          });
                        }}
                      >
                        Remove Registration
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
      label: 'All Properties',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" />
                </Card>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-700">No properties found</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
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
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 pb-4 border-b">
                    {property.bedrooms > 0 && (
                      <span>{property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}</span>
                    )}
                    {property.bathrooms > 0 && (
                      <span>{property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}</span>
                    )}
                    {property.sqft && <span>{property.sqft} sq ft</span>}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-4">
                    <p><strong>Listed by:</strong> {property.user_id?.substring(0, 8)}...</p>
                    <p><strong>Created:</strong> {formatDate(property.created_at)}</p>
                    {property.removed_at && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-800"><strong>Removed:</strong> {formatDate(property.removed_at)}</p>
                        {property.removal_reason && (
                          <p className="text-red-700 text-xs mt-1"><strong>Reason:</strong> {property.removal_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!property.removed_at && (
                    <Button
                      variant="accent"
                      size="sm"
                      className="w-full"
                      onClick={() => setRemovalModal({ open: true, property })}
                    >
                      Remove Property
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
      label: 'Statistics',
      content: (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton width="w-1/2" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/4" height="h-8" />
                </Card>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="md" className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Total Registrations</h3>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </Card>
              <Card padding="md" className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Pending</h3>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </Card>
              <Card padding="md" className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Approved</h3>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </Card>
              <Card padding="md" className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Rejected</h3>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </Card>
            </div>
          ) : (
            <Card padding="lg" className="text-center">
              <p className="text-gray-700">No statistics available</p>
            </Card>
          )}
        </div>
      ),
    },
  ]

  const getModalTitle = () => {
    switch (actionModal.type) {
      case 'approve':
        return 'Approve Registration'
      case 'reject':
        return 'Reject Registration'
      case 'in_review':
        return 'Set Registration In Review'
      case 'remove':
        return 'Remove Registration'
      default:
        return 'Action'
    }
  }

  return (
    <Section>
      <Container>
        {/* Toast Notifications */}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={toast.duration}
          />
        ))}

        <div className="mb-8">
          <h1 className="mb-4">Admin Dashboard</h1>
          <p className="text-body-large text-gray-700">
            Manage and review all land registration submissions
          </p>
        </div>

        <Tabs tabs={tabs} defaultTab={activeTab} onChange={setActiveTab} />

        {/* Action Modal */}
        <Modal
          isOpen={actionModal.open}
          onClose={() => {
            setActionModal({ open: false, type: null, registration: null })
            setReviewNotes('')
          }}
          title={getModalTitle()}
          size="md"
        >
          <div className="space-y-4">
            {actionModal.registration && (
              <div>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Property Address:</strong> {actionModal.registration.property_address}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Owner:</strong> {actionModal.registration.owner_name}
                </p>
              </div>
            )}

            {(actionModal.type === 'approve' || actionModal.type === 'reject' || actionModal.type === 'remove') && (
              <div>
                <label
                  htmlFor="review-notes"
                  className="block text-sm font-medium text-gray-900 mb-2"
                >
                  {actionModal.type === 'approve' 
                    ? 'Review Notes' 
                    : actionModal.type === 'remove'
                    ? 'Reason for Removal <span className="text-red-600">*</span>'
                    : 'Review Notes <span className="text-red-600">*</span>'}
                </label>
                <textarea
                  id="review-notes"
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={
                    actionModal.type === 'approve'
                      ? 'Optional notes about this registration'
                      : actionModal.type === 'remove'
                      ? 'Please provide a reason for removing this registration (required)'
                      : 'Please provide a reason for rejection (required)'
                  }
                  required={actionModal.type !== 'approve'}
                />
              </div>
            )}

            <div className="flex gap-4">
              <Button
                variant="primary"
                onClick={handleAction}
                disabled={processingAction || (actionModal.type === 'reject' && !reviewNotes.trim())}
                className="flex-1"
              >
                {processingAction
                  ? 'Processing...'
                  : actionModal.type === 'approve'
                  ? 'Approve'
                  : actionModal.type === 'reject'
                  ? 'Reject'
                  : actionModal.type === 'remove'
                  ? 'Remove Registration'
                  : 'Set In Review'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setActionModal({ open: false, type: null, registration: null })
                  setReviewNotes('')
                }}
                disabled={processingAction}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>

        {/* Property Removal Modal */}
        <Modal
          isOpen={removalModal.open}
          onClose={() => {
            setRemovalModal({ open: false, property: null })
            setRemovalReason('')
          }}
          title="Remove Property"
          size="md"
        >
          <div className="space-y-4">
            {removalModal.property && (
              <div className="p-4 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Property:</strong> {removalModal.property.title}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Location:</strong> {removalModal.property.location}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Listed by:</strong> {removalModal.property.user_id?.substring(0, 8)}...
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="removal-reason"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Reason for Removal <span className="text-red-600">*</span>
              </label>
              <Textarea
                id="removal-reason"
                rows={4}
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                placeholder="Please provide a valid reason for removing this property (e.g., fraud, policy violation, suspicious activity)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be recorded for audit purposes and may be reviewed later.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="accent"
                onClick={handleRemoveProperty}
                disabled={processingRemoval || !removalReason.trim()}
                className="flex-1"
              >
                {processingRemoval ? 'Removing...' : 'Remove Property'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRemovalModal({ open: false, property: null })
                  setRemovalReason('')
                }}
                disabled={processingRemoval}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </Container>
    </Section>
  )
}

export default AdminDashboard

