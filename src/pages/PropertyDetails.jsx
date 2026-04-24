import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Toast from '../components/ui/Toast'
import MapComponent from '../components/MapComponent'
import { getPropertyById } from '../services/properties'
import { saveProperty, removeSavedProperty, getSavedProperties, getUserProfile } from '../services/user'
import { createInquiry, getInquiriesByPropertyId, getInquiryReplies, createInquiryReply } from '../services/inquiries'
import { createOffer } from '../services/offers'
import { useToast } from '../hooks/useToast'
import { getSafeImageUrl } from '../utils/placeholders'
import { useLocation } from 'react-router-dom'
import BlockchainBadge from '../components/BlockchainBadge'
import TokenConversionInfo from '../components/TokenConversionInfo'
import { inrToTokens } from '../utils/tokenConversion'
import BlockchainOwnershipHistory from '../components/BlockchainOwnershipHistory'
import NFTInfo from '../components/NFTInfo'

const PropertyDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoaded: isUserLoaded } = useUser()
  const { toasts, success, error, removeToast } = useToast()
  const [property, setProperty] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentImage, setCurrentImage] = useState(0)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [contactErrors, setContactErrors] = useState({})
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    appointmentDate: '',
    appointmentTime: '',
  })
  const [ownerPhone, setOwnerPhone] = useState(null)
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userInquiry, setUserInquiry] = useState(null)
  const [inquiryReplies, setInquiryReplies] = useState([])
  const [showInquiryMessages, setShowInquiryMessages] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false)

  useEffect(() => {
    const loadProperty = async () => {
      setIsLoading(true)
      // Don't clear property immediately to prevent flash
      
      // Wait for user to load if not already loaded (prevents flash of "Property Not Found")
      if (!isUserLoaded) {
        let waitAttempts = 0
        while (!isUserLoaded && waitAttempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waitAttempts++
        }
      }
      
      // First try to get the property (excluding removed ones, but including sold)
      // This allows users to view properties they purchased
      let { data, error } = await getPropertyById(id, false, true) // includeSold = true
      
      // If not found, try to get it including removed properties to check if it was removed
      if ((error || !data) && !error?.message?.includes('removed_at')) {
        const { data: removedData } = await getPropertyById(id, true, true)
        if (removedData && (removedData.removed_at || removedData.status === 'paused')) {
          // Property exists but is removed
          setProperty({ ...removedData, isRemoved: true })
          setIsLoading(false)
          return
        }
      }
      
      // If still not found, check if user purchased it (wait for user to load if needed)
      if (error || !data) {
        // Wait a bit for user to load (in case of page refresh)
        let attempts = 0
        while ((!user?.id || !data) && attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 300))
          attempts++
          
          // Try to fetch directly from Supabase to check if user is the buyer
          const { supabase } = await import('../lib/supabase')
          const { data: directData } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id)
            .maybeSingle()
          
          if (directData) {
            // If user is loaded, check ownership
            if (user?.id) {
              // Allow access if user is the buyer (sold_to) or current owner (user_id)
              if (directData.sold_to === user.id || directData.user_id === user.id) {
                data = directData
                error = null
                break
              }
            } else {
              // User not loaded yet, but property exists - store it temporarily
              // We'll check ownership once user loads
              data = directData
              error = null
            }
          }
        }
        
        // Final check: if we have data but user is now loaded, verify ownership
        if (data && user?.id) {
          // Only restrict access if property is sold and user is not the buyer or owner
          if (data.sold_to && data.sold_to !== user.id && data.user_id !== user.id) {
            // User is not the owner or buyer
            data = null
            error = { message: 'Property not found' }
          }
        } else if (data && !user?.id) {
          // Property found but user not loaded yet - wait a bit more for user to load
          await new Promise(resolve => setTimeout(resolve, 500))
          // Re-check with user context
          if (user?.id) {
            if (data.sold_to && data.sold_to !== user.id && data.user_id !== user.id) {
              data = null
              error = { message: 'Property not found' }
            }
          }
        }
      }
      
      if (!error && data) {
        console.log('Property data loaded:', data)
        console.log('Ownership history:', data.ownership_history)
        console.log('Ownership history type:', typeof data.ownership_history)
        console.log('Is array?', Array.isArray(data.ownership_history))
        setProperty(data)
        
        // Check if user has already submitted an inquiry
        if (user?.id) {
          const { data: inquiries } = await getInquiriesByPropertyId(id)
          const foundInquiry = inquiries?.find(inq => inq.user_id === user.id)
          if (foundInquiry) {
            setUserInquiry(foundInquiry)
            if (foundInquiry.phone_revealed && foundInquiry.owner_phone) {
              setOwnerPhone(foundInquiry.owner_phone)
              setPhoneRevealed(true)
            }
            // Load replies for this inquiry
            const { data: replies } = await getInquiryReplies(foundInquiry.id)
            if (replies) {
              setInquiryReplies(replies)
            }
          }
        }
      } else {
        console.error('Error loading property:', error)
        // Only set property to null after we've fully checked (including user context)
        setProperty(null)
      }
      
      setIsLoading(false)
    }
    
    loadProperty()
  }, [id, user?.id, isUserLoaded])

  // Scroll to contact section if coming from Properties page
  useEffect(() => {
    if (location.state?.scrollToContact && !isLoading && property) {
      setTimeout(() => {
        setIsContactModalOpen(true)
      }, 500)
    }
  }, [location.state, isLoading, property])

  // Auto-refresh replies when messages are visible
  useEffect(() => {
    if (!showInquiryMessages || !userInquiry?.id) return

    // Load replies immediately
    const loadReplies = async () => {
      const { data: replies } = await getInquiryReplies(userInquiry.id)
      if (replies) {
        setInquiryReplies(replies)
      }
    }

    loadReplies()

    // Set up polling to refresh replies every 3 seconds when messages are visible
    const interval = setInterval(loadReplies, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInquiryMessages, userInquiry?.id])

  useEffect(() => {
    const checkIfSaved = async () => {
      if (user?.id && id) {
        const { data } = await getSavedProperties(user.id)
        if (data) {
          const saved = data.some(item => item.property_id === id)
          setIsSaved(saved)
        }
      }
    }
    
    checkIfSaved()
  }, [user?.id, id])

  const handleSaveProperty = async () => {
    if (!user?.id) {
      error('Please log in to save properties')
      setTimeout(() => navigate('/login'), 1500)
      return
    }

    setIsSaving(true)
    try {
      if (isSaved) {
        // Remove saved property (id is already a UUID string)
        const { error: removeError } = await removeSavedProperty(user.id, id)
        if (!removeError) {
          setIsSaved(false)
          success('Property removed from saved list')
        } else {
          error('Failed to remove property. Please try again.')
        }
      } else {
        // Save property (id is already a UUID string)
        const { error: saveError } = await saveProperty(user.id, id)
        if (!saveError) {
          setIsSaved(true)
          success('Property saved successfully!')
        } else {
          error('Failed to save property. Please try again.')
        }
      }
    } catch (err) {
      console.error('Error saving property:', err)
      error('An error occurred. Please try again.')
    }
    setIsSaving(false)
  }

  // Load owner phone when inquiry is submitted
  useEffect(() => {
    const loadOwnerPhone = async () => {
      if (property?.user_id && phoneRevealed) {
        try {
          const { data } = await getUserProfile(property.user_id)
          if (data?.phone) {
            setOwnerPhone(data.phone)
          }
        } catch (err) {
          console.error('Error loading owner phone:', err)
        }
      }
    }
    loadOwnerPhone()
  }, [property?.user_id, phoneRevealed])

  // Pre-fill contact form from user profile when modal opens or user changes
  useEffect(() => {
    if (user && !phoneRevealed) {
      const prefillForm = async () => {
        const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || ''
        const email = user.primaryEmailAddress?.emailAddress || ''
        
        // Try to get phone from user profile
        let phone = ''
        if (user?.id) {
          try {
            const { data } = await getUserProfile(user.id)
            phone = data?.phone || ''
          } catch (err) {
            console.error('Error loading user phone:', err)
          }
        }

        // Only pre-fill if fields are empty (don't overwrite user input)
        setContactForm(prev => ({
          ...prev,
          name: prev.name.trim() || name,
          email: prev.email.trim() || email,
          phone: prev.phone.trim() || phone,
        }))
      }
      prefillForm()
    }
  }, [user, phoneRevealed])

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    
    const newErrors = {}
    
    // Validate required fields
    if (!contactForm.name.trim()) {
      newErrors.name = 'Please enter your name'
    } else if (contactForm.name.trim().length < 2) {
      newErrors.name = 'Name should be at least 2 characters long'
    }
    
    if (!contactForm.email.trim()) {
      newErrors.email = 'Please enter your email'
    } else {
      // Enhanced email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contactForm.email)) {
        newErrors.email = 'Please enter a valid email address (e.g., name@example.com)'
      }
    }
    
    // Validate phone if provided
    if (contactForm.phone && contactForm.phone.trim()) {
      const phoneRegex = /^[0-9]{10,15}$/
      const cleanedPhone = contactForm.phone.replace(/[\s\-()+]/g, '')
      if (!phoneRegex.test(cleanedPhone)) {
        newErrors.phone = 'Please enter a valid phone number (10-15 digits)'
      }
    }
    
    // Validate appointment if provided
    if (contactForm.appointmentDate && !contactForm.appointmentTime) {
      newErrors.appointmentTime = 'Please select a time for the appointment'
    }
    if (contactForm.appointmentTime && !contactForm.appointmentDate) {
      newErrors.appointmentDate = 'Please select a date for the appointment'
    }
    
    setContactErrors(newErrors)
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Validate property exists
      if (!property || !property.id) {
        error('Property not found. Please refresh the page and try again.')
        setIsSubmitting(false)
        return
      }

      // Prepare appointment date if both date and time are provided
      let appointmentDateTime = null
      if (contactForm.appointmentDate && contactForm.appointmentTime) {
        const dateTime = new Date(`${contactForm.appointmentDate}T${contactForm.appointmentTime}`)
        appointmentDateTime = dateTime.toISOString()
      }

      // Create inquiry - start with required fields
      const inquiryData = {
        property_id: property.id,
        user_id: user?.id || null,
        buyer_name: contactForm.name.trim(),
        buyer_email: contactForm.email.trim(),
        buyer_phone: contactForm.phone.trim() || null,
        message: contactForm.message.trim() || null,
      }

      // Add appointment fields only if they exist (migration may not be run)
      if (appointmentDateTime) {
        inquiryData.appointment_date = appointmentDateTime
      }
      if (contactForm.appointmentTime) {
        inquiryData.appointment_time = contactForm.appointmentTime
      }

      // Get owner phone to reveal
      let ownerPhoneNumber = null
      if (property?.user_id) {
        try {
          const { data: ownerProfile } = await getUserProfile(property.user_id)
          if (ownerProfile?.phone) {
            ownerPhoneNumber = ownerProfile.phone
            inquiryData.owner_phone = ownerProfile.phone
            inquiryData.phone_revealed = true
            setOwnerPhone(ownerProfile.phone)
          }
        } catch (profileErr) {
          console.error('Error loading owner profile:', profileErr)
          // Continue without owner phone - inquiry can still be created
        }
      }

      const { data: inquiryResult, error: inquiryError } = await createInquiry(inquiryData)
      
      if (inquiryError) {
        console.error('Inquiry creation error:', inquiryError)
        console.error('Error code:', inquiryError.code)
        console.error('Error message:', inquiryError.message)
        console.error('Error details:', inquiryError.details)
        console.error('Error hint:', inquiryError.hint)
        console.error('Inquiry data attempted:', JSON.stringify(inquiryData, null, 2))
        
        // Provide more specific error message based on error type
        let errorMessage = 'Failed to send inquiry. Please try again.'
        
        if (inquiryError.code === '42501' || inquiryError.message?.includes('row-level security') || inquiryError.message?.includes('RLS') || inquiryError.message?.includes('policy')) {
          errorMessage = 'Permission denied. The inquiry INSERT policy may be blocking this. Please run fix-inquiries-insert-policy.sql in Supabase SQL Editor.'
        } else if (inquiryError.code === '42703' || inquiryError.message?.includes('column') || inquiryError.message?.includes('does not exist')) {
          errorMessage = 'Database schema issue. Please run add-inquiries-appointments.sql migration in Supabase SQL Editor.'
        } else if (inquiryError.message) {
          errorMessage = `Failed to send inquiry: ${inquiryError.message}`
          // Include error code if available
          if (inquiryError.code) {
            errorMessage += ` (Error code: ${inquiryError.code})`
          }
        }
        
        error(errorMessage)
      } else {
        // If owner phone wasn't set during creation, try to set it now
        if (ownerPhoneNumber && inquiryResult?.id) {
          try {
            setOwnerPhone(ownerPhoneNumber)
          } catch (err) {
            console.error('Error setting owner phone:', err)
          }
        }
        success('Inquiry sent successfully! Owner contact details are now available.')
        setPhoneRevealed(true)
        // Reload inquiry to get the new one
        const { data: inquiries } = await getInquiriesByPropertyId(id)
        const foundInquiry = inquiries?.find(inq => inq.user_id === user.id)
        if (foundInquiry) {
          setUserInquiry(foundInquiry)
          const { data: replies } = await getInquiryReplies(foundInquiry.id)
          if (replies) {
            setInquiryReplies(replies)
          }
        }
        // Keep modal open to show phone number
        // Form will be cleared when modal is closed
      }
    } catch (err) {
      console.error('Error submitting inquiry:', err)
      error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <Section>
        <Container>
          <div className="animate-pulse">
            <div className="h-96 bg-gray-200 rounded mb-6" />
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </Container>
      </Section>
    )
  }

  if (!property) {
    return (
      <Section>
        <Container>
          <Card padding="lg" className="text-center">
            <h2 className="mb-4">Property Not Found</h2>
            <p className="text-gray-700 mb-6">
              The property you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate('/properties')}>
              Back to Properties
            </Button>
          </Card>
        </Container>
      </Section>
    )
  }

  // Check if property is removed
  if (property.isRemoved || property.removed_at || property.status === 'paused') {
    return (
      <Section>
        <Container>
          <Card padding="lg" className="text-center">
            <div className="mb-6">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="mb-4">Property Has Been Removed</h2>
              <p className="text-gray-700 mb-4">
                This property listing has been removed by an administrator.
              </p>
              {property.removal_reason && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 max-w-2xl mx-auto">
                  <p className="text-sm font-semibold text-red-800 mb-2">Reason for Removal:</p>
                  <p className="text-sm text-red-700">{property.removal_reason}</p>
                </div>
              )}
              {property.removed_at && (
                <p className="text-sm text-gray-600 mb-6">
                  Removed on: {new Date(property.removed_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            <Button onClick={() => navigate('/properties')}>
              Back to Properties
            </Button>
          </Card>
        </Container>
      </Section>
    )
  }

  return (
    <div>
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
      
      <Section>
        <Container>
          {/* Image Gallery */}
          <div className="mb-8">
            <div className="relative bg-gray-200 rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/10', maxHeight: '600px' }}>
              <img
                src={getSafeImageUrl(property.images[currentImage])}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            </div>
            {property.images.length > 1 && (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {property.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImage(index)}
                    className={`relative bg-gray-200 rounded overflow-hidden border-2 transition-all duration-200 ${
                      currentImage === index
                        ? 'border-primary ring-2 ring-primary ring-offset-2'
                        : 'border-transparent hover:border-gray-400'
                    }`}
                    style={{ aspectRatio: '4/3' }}
                  >
                    <img
                      src={getSafeImageUrl(image)}
                      alt={`${property.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {currentImage === index && (
                      <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h1>{property.title}</h1>
                  <BlockchainBadge property={property} />
                </div>
                <p className="text-body-large text-gray-700 mb-6">
                  {property.address}
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <Badge variant="primary">{property.type}</Badge>
                  {property.listing_type && (
                    <Badge variant={property.listing_type === 'for_rent' ? 'secondary' : 'primary'}>
                      {property.listing_type === 'for_rent' ? 'For Rent' : 'For Sale'}
                    </Badge>
                  )}
                  {property.year_built && (
                    <span className="text-gray-700">Built in {property.year_built}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-8">
                  <p className="text-3xl font-bold text-primary">
                    ₹{property.price?.toLocaleString()}
                  </p>
                  {property.listing_type === 'for_rent' && (
                    <span className="text-lg text-gray-700">/month</span>
                  )}
                </div>
              </div>

              <Card padding="md">
                <h3 className="text-xl font-semibold mb-4">Property Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {property.bedrooms > 0 && (
                    <div>
                      <p className="text-sm text-gray-700 mb-1">Bedrooms</p>
                      <p className="text-lg font-semibold">{property.bedrooms}</p>
                    </div>
                  )}
                  {property.bathrooms > 0 && (
                    <div>
                      <p className="text-sm text-gray-700 mb-1">Bathrooms</p>
                      <p className="text-lg font-semibold">{property.bathrooms}</p>
                    </div>
                  )}
                  {property.sqft && (
                    <div>
                      <p className="text-sm text-gray-700 mb-1">Square Feet</p>
                      <p className="text-lg font-semibold">{property.sqft.toLocaleString()}</p>
                    </div>
                  )}
                  {property.year_built && (
                    <div>
                      <p className="text-sm text-gray-700 mb-1">Year Built</p>
                      <p className="text-lg font-semibold">{property.year_built}</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-xl font-semibold mb-4">Description</h3>
                <p className="text-gray-700 leading-relaxed">{property.description}</p>
              </Card>

              <Card padding="md">
                <h3 className="text-xl font-semibold mb-4">Features</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {property.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <svg
                        className="w-5 h-5 text-secondary mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* NFT Information */}
              <NFTInfo property={property} />

              {/* Blockchain Ownership History */}
              {property?.blockchain_property_id && (
                <Card padding="md">
                  <BlockchainOwnershipHistory property={property} />
                </Card>
              )}

              {/* Ownership History (Supabase) */}
              {property.ownership_history && 
               Array.isArray(property.ownership_history) && 
               property.ownership_history.length > 0 && 
               property.ownership_history.some(r => r.owner_name) && (
                <Card padding="md">
                  <h3 className="text-xl font-semibold mb-4">Ownership History (Database)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Historical record of property ownership and transfers
                  </p>
                  <div className="space-y-4">
                    {property.ownership_history
                      .filter(record => record.owner_name) // Only show records with owner names
                      .map((record, index) => (
                        <div key={index} className="border-l-4 border-primary pl-4 py-3 bg-gray-50 rounded-r">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-grow">
                              <p className="font-semibold text-gray-900 text-lg">
                                {record.owner_name}
                              </p>
                              {record.transfer_type && (
                                <span className="inline-block mt-2 px-2 py-1 text-xs border border-gray-400 text-gray-700 rounded">
                                  {record.transfer_type === 'sale' ? 'Sale' : 
                                   record.transfer_type === 'inheritance' ? 'Inheritance' :
                                   record.transfer_type === 'gift' ? 'Gift' :
                                   record.transfer_type || 'Transfer'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700 space-y-1 mt-2">
                            {record.from_date && (
                              <p>
                                <strong>From:</strong> {new Date(record.from_date).toLocaleDateString('en-IN', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                            )}
                            {record.to_date ? (
                              <p>
                                <strong>To:</strong> {new Date(record.to_date).toLocaleDateString('en-IN', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                            ) : record.from_date && (
                              <p className="text-primary font-medium">✓ Current Owner</p>
                            )}
                          </div>
                          {record.notes && (
                            <p className="text-sm text-gray-600 mt-3 italic">"{record.notes}"</p>
                          )}
                        </div>
                      ))}
                  </div>
                </Card>
              )}

              <Card padding="md">
                <h3 className="text-xl font-semibold mb-4">Location</h3>
                {property.address ? (
                  <div className="w-full" style={{ height: '400px' }}>
                    <MapComponent 
                      address={property.address || property.location}
                      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                      zoom={15}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-full bg-gray-100 rounded flex items-center justify-center" style={{ height: '400px' }}>
                    <p className="text-gray-600">Address not available</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card padding="md" className="sticky top-24">
                <h3 className="text-xl font-semibold mb-6">Contact Owner</h3>
                {phoneRevealed && ownerPhone ? (
                  <div className="space-y-4 mb-6">
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800 font-medium mb-2">Owner Contact Details</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Phone</p>
                          <a 
                            href={`tel:${ownerPhone}`}
                            className="text-base font-semibold text-primary hover:underline"
                          >
                            {ownerPhone}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-gray-600">
                      Send an inquiry to get the owner's contact details and schedule a viewing.
                    </p>
                  </div>
                )}
                {user?.id && property.user_id === user.id ? (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded mb-4">
                    <p className="text-sm text-gray-700 text-center">
                      This is your property listing
                    </p>
                  </div>
                ) : userInquiry ? (
                  <div className="space-y-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() => setShowInquiryMessages(!showInquiryMessages)}
                      >
                        {showInquiryMessages ? 'Hide Messages' : 'View Messages'}
                      </Button>
                      {inquiryReplies.filter(r => r.sender_type === 'owner').length > 0 && (
                        <Badge variant="warning">
                          {inquiryReplies.filter(r => r.sender_type === 'owner').length}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setShowOfferModal(true)}
                    >
                      {(property?.listing_type || 'for_sale') === 'for_sale' ? 'Make an Offer' : 'Rent This Property'}
                    </Button>
                    
                    {showInquiryMessages && (
                      <Card padding="md" className="border-l-4 border-l-primary">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Your Inquiry</h4>
                            <p className="text-sm text-gray-600 mb-1">
                              {new Date(userInquiry.created_at).toLocaleString()}
                            </p>
                            {userInquiry.message && (
                              <p className="text-gray-700 whitespace-pre-wrap">{userInquiry.message}</p>
                            )}
                            {userInquiry.appointment_date && (
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                <p className="text-xs font-semibold text-blue-900">📅 Scheduled Viewing</p>
                                <p className="text-xs text-blue-800">
                                  {new Date(userInquiry.appointment_date).toLocaleDateString()} 
                                  {userInquiry.appointment_time && ` at ${userInquiry.appointment_time}`}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Conversation Thread */}
                          <div className="border-t border-gray-200 pt-4">
                            <h4 className="font-semibold mb-3">Conversation</h4>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                              {inquiryReplies.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No messages yet. Waiting for owner's response...</p>
                              ) : (
                                inquiryReplies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className={`p-3 rounded-lg ${
                                      reply.sender_type === 'owner'
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'bg-gray-50 border border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold">
                                        {reply.sender_type === 'owner' ? 'Owner' : 'You'}
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

                            {/* Reply Form for Buyer */}
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
                                onClick={async () => {
                                  if (!replyMessage.trim() || !user?.id || !userInquiry) return
                                  
                                  setIsSendingReply(true)
                                  try {
                                    const { error: replyError } = await createInquiryReply({
                                      inquiry_id: userInquiry.id,
                                      sender_id: user.id,
                                      sender_type: 'buyer',
                                      message: replyMessage.trim()
                                    })

                                    if (replyError) {
                                      error('Failed to send reply. Please try again.')
                                      return
                                    }

                                    success('Reply sent successfully!')
                                    setReplyMessage('')
                                    // Reload replies immediately
                                    const { data: replies } = await getInquiryReplies(userInquiry.id)
                                    if (replies) {
                                      setInquiryReplies(replies)
                                    }
                                    // Note: Auto-refresh will continue polling, so new messages will appear automatically
                                  } catch (err) {
                                    console.error('Error sending reply:', err)
                                    error('An error occurred while sending the reply')
                                  } finally {
                                    setIsSendingReply(false)
                                  }
                                }}
                                disabled={isSendingReply || !replyMessage.trim()}
                                className="w-full"
                                isLoading={isSendingReply}
                              >
                                Send Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => setIsContactModalOpen(true)}
                    >
                      Contact Owner
                    </Button>
                    {property?.listing_type && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => setShowOfferModal(true)}
                      >
                        {property.listing_type === 'for_sale' ? 'Make an Offer' : 'Rent This Property'}
                      </Button>
                    )}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full mb-4"
                  onClick={handleSaveProperty}
                  isLoading={isSaving}
                >
                  {isSaved ? (
                    <>
                      <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      Saved
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2 stroke-current" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Save Property
                    </>
                  )}
                </Button>
              </Card>
            </div>
          </div>
        </Container>
      </Section>

      {/* Contact Modal */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false)
          if (phoneRevealed) {
            // Reset form but keep user info for next time
            const name = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.firstName || ''
            const email = user?.primaryEmailAddress?.emailAddress || ''
            setContactForm({ 
              name: name, 
              email: email, 
              phone: contactForm.phone, // Keep phone if user entered it
              message: '', 
              appointmentDate: '', 
              appointmentTime: '' 
            })
            setPhoneRevealed(false)
          } else {
            // Keep form data if modal is closed without submitting
            // This allows user to reopen and continue
          }
        }}
        title={phoneRevealed ? "Owner Contact Details" : "Contact Owner"}
      >
        {phoneRevealed && ownerPhone ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800 mb-2">Your inquiry has been sent successfully!</p>
              <p className="text-sm text-gray-700">Owner contact details:</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Phone Number</p>
                <a 
                  href={`tel:${ownerPhone}`}
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  {ownerPhone}
                </a>
              </div>
              {property?.user_id && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                  <p className="text-base text-gray-900">
                    {user?.primaryEmailAddress?.emailAddress || 'Contact via phone'}
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setIsContactModalOpen(false)
                setContactForm({ name: '', email: '', phone: '', message: '', appointmentDate: '', appointmentTime: '' })
                setPhoneRevealed(false)
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <Input
              label="Your Name"
              required
              value={contactForm.name}
              onChange={(e) => {
                setContactForm({ ...contactForm, name: e.target.value })
                if (contactErrors.name) {
                  setContactErrors({ ...contactErrors, name: '' })
                }
              }}
              error={contactErrors.name}
              helperText={!contactErrors.name ? "Enter your full name as it appears on your ID" : undefined}
            />
            <Input
              label="Email"
              type="email"
              required
              value={contactForm.email}
              onChange={(e) => {
                setContactForm({ ...contactForm, email: e.target.value })
                if (contactErrors.email) {
                  setContactErrors({ ...contactErrors, email: '' })
                }
              }}
              error={contactErrors.email}
              helperText={!contactErrors.email ? "We'll use this to send you property updates" : undefined}
            />
            <Input
              label="Phone"
              type="tel"
              value={contactForm.phone}
              onChange={(e) => {
                setContactForm({ ...contactForm, phone: e.target.value })
                if (contactErrors.phone) {
                  setContactErrors({ ...contactErrors, phone: '' })
                }
              }}
              placeholder="Your phone number (optional)"
              error={contactErrors.phone}
              helperText={!contactErrors.phone ? "Optional: Helps the owner contact you faster (10-15 digits)" : undefined}
            />
            <Textarea
              label="Message"
              value={contactForm.message}
              onChange={(e) =>
                setContactForm({ ...contactForm, message: e.target.value })
              }
              placeholder="Your message to the owner"
              minRows={4}
            />
            
            {/* Appointment Scheduling */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-900 mb-3">Schedule Viewing (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Date"
                    type="date"
                    value={contactForm.appointmentDate}
                    onChange={(e) => {
                      setContactForm({ ...contactForm, appointmentDate: e.target.value })
                      if (contactErrors.appointmentDate) {
                        setContactErrors({ ...contactErrors, appointmentDate: '' })
                      }
                    }}
                    error={contactErrors.appointmentDate}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Input
                    label="Time"
                    type="time"
                    value={contactForm.appointmentTime}
                    onChange={(e) => {
                      setContactForm({ ...contactForm, appointmentTime: e.target.value })
                      if (contactErrors.appointmentTime) {
                        setContactErrors({ ...contactErrors, appointmentTime: '' })
                      }
                    }}
                    error={contactErrors.appointmentTime}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {isSubmitting && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sending inquiry...</span>
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <Button 
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Send Inquiry
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsContactModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Make Offer Modal */}
      <Modal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false)
          setOfferAmount('')
          setOfferMessage('')
        }}
        title={(property?.listing_type || 'for_sale') === 'for_sale' ? 'Make an Offer' : 'Rent This Property'}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800 font-medium mb-1">
              {(property?.listing_type || 'for_sale') === 'for_sale' ? 'Property Price' : 'Monthly Rent'}
            </p>
            <p className="text-lg font-semibold text-blue-900">
              ₹{property?.price?.toLocaleString('en-IN') || '0'}
            </p>
          </div>

          <div>
            <Input
              label={(property?.listing_type || 'for_sale') === 'for_sale' ? 'Your Offer Amount (₹)' : 'Monthly Rent Offer (₹)'}
              type="number"
              required
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder={`Enter your offer amount`}
              min="0"
              step="0.01"
            />
            {offerAmount && parseFloat(offerAmount) > 0 && (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                <span className="font-medium">Token Equivalent: </span>
                <span className="text-primary font-semibold">
                  {inrToTokens(parseFloat(offerAmount)).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                </span>
              </div>
            )}
          </div>
          
          <TokenConversionInfo />

          <Textarea
            label="Message to Owner (Optional)"
            value={offerMessage}
            onChange={(e) => setOfferMessage(e.target.value)}
            placeholder="Add any additional details or conditions for your offer..."
            rows={4}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowOfferModal(false)
                setOfferAmount('')
                setOfferMessage('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={async () => {
                if (!offerAmount || parseFloat(offerAmount) <= 0) {
                  error('Please enter a valid offer amount')
                  return
                }

                if (!user?.id) {
                  error('Please log in to make an offer')
                  return
                }

                setIsSubmittingOffer(true)
                try {
                  const listingType = property?.listing_type || 'for_sale'
                  const { error: offerError } = await createOffer({
                    property_id: property.id,
                    buyer_id: user.id,
                    seller_id: property.user_id,
                    offer_amount: parseFloat(offerAmount),
                    currency: 'INR',
                    offer_type: listingType === 'for_sale' ? 'purchase' : 'rental',
                    message: offerMessage.trim() || null,
                    status: 'pending'
                  })

                  if (offerError) {
                    console.error('Offer creation error:', offerError)
                    console.error('Error code:', offerError.code)
                    console.error('Error message:', offerError.message)
                    console.error('Error details:', offerError.details)
                    console.error('Error hint:', offerError.hint)
                    
                    let errorMessage = 'Failed to submit offer. Please try again.'
                    
                    if (offerError.code === '42501' || offerError.message?.includes('row-level security') || offerError.message?.includes('RLS') || offerError.message?.includes('policy')) {
                      errorMessage = 'Permission denied. Please run fix-offers-rls.sql in Supabase SQL Editor to disable RLS for offers.'
                    } else if (offerError.message) {
                      errorMessage = `Failed to submit offer: ${offerError.message}`
                      if (offerError.code) {
                        errorMessage += ` (Error code: ${offerError.code})`
                      }
                    }
                    
                    error(errorMessage)
                    return
                  }

                  success('Offer submitted successfully! The owner will review your offer.')
                  setShowOfferModal(false)
                  setOfferAmount('')
                  setOfferMessage('')
                } catch (err) {
                  console.error('Error submitting offer:', err)
                  error('An error occurred while submitting the offer')
                } finally {
                  setIsSubmittingOffer(false)
                }
              }}
              disabled={isSubmittingOffer || !offerAmount}
              isLoading={isSubmittingOffer}
            >
              {(property?.listing_type || 'for_sale') === 'for_sale' ? 'Submit Offer' : 'Submit Rental Request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PropertyDetails

