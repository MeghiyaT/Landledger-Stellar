import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { createRegistration, uploadRegistrationDocument, getRegistrationById, updateRegistration } from '../services/registrations'
import { getUserProfile } from '../services/user'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'

const Registration = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const { user, isLoaded } = useUser()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(!!editId)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [isEditMode, setIsEditMode] = useState(!!editId)
  const [existingRegistration, setExistingRegistration] = useState(null)
  // eslint-disable-next-line no-unused-vars
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  // uploading712 state is managed by the upload handler to give user visual feedback
  const [uploading712, _setUploading712] = useState(false)
  const hasAutoPopulatedRef = useRef(false)
  const initialFormData = {
    // Step 1: Property Information
    propertyTitle: '', // Custom property title
    propertyType: '',
    propertyAddress: '',
    propertyState: '',
    propertySize: '',
    propertyDescription: '',
    surveyNumber: '', // Survey Number - critical for land identification
    // Step 2: Owner Information
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    // Step 3: Documents
    documents: [],
    extract712: null, // 7/12 extract for Maharashtra/Gujarat
    aadharCard: null, // Aadhar Card - required
    panCard: null, // PAN Card - required
    propertyDocument: null, // Property Document - required
    additionalNotes: '',
  }

  // Use local state for form data
  const [formData, setFormData] = useState(initialFormData)
  
  // Auto-fill owner information from profile (only if not editing and fields are empty)
  useEffect(() => {
    if (!isEditMode && !isLoading && user?.id && isLoaded) {
      const prefillOwnerInfo = async () => {
        try {
          const { data } = await getUserProfile(user.id)
          const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || ''
          const email = user.primaryEmailAddress?.emailAddress || ''
          const phone = data?.phone || ''
          
          setFormData(prev => ({
            ...prev,
            ownerName: prev.ownerName.trim() || name,
            ownerEmail: prev.ownerEmail.trim() || email,
            ownerPhone: prev.ownerPhone.trim() || phone,
          }))
        } catch (err) {
          console.error('Error loading user profile:', err)
        }
      }
      prefillOwnerInfo()
    }
  }, [isEditMode, isLoading, user, isLoaded])

  // Auto-populate Aadhar and PAN cards from profile when entering step 3
  useEffect(() => {
    // Reset ref when leaving step 3 or when edit mode changes
    if (currentStep !== 3) {
      hasAutoPopulatedRef.current = false
      return
    }
    
    if (currentStep === 3 && !isEditMode && user?.id && isLoaded && !hasAutoPopulatedRef.current) {
      hasAutoPopulatedRef.current = true
      console.log('🔍 Step 3 detected - checking for profile documents...')
      const loadProfileDocuments = async () => {
        try {
          const { data, error } = await getUserProfile(user.id)
          
          if (error) {
            console.error('❌ Error fetching profile:', error)
            return
          }
          
          console.log('📋 Profile data received:', {
            hasAadhar: !!data?.aadhar_card,
            hasPan: !!data?.pan_card,
            aadharCard: data?.aadhar_card,
            panCard: data?.pan_card
          })
          
          if (data) {
            setFormData(prev => {
              console.log('📝 Current form data:', {
                hasAadhar: !!prev.aadharCard,
                hasPan: !!prev.panCard,
                aadharCard: prev.aadharCard,
                panCard: prev.panCard
              })
              
              // Only update if fields are empty/null and profile has documents
              const updates = {}
              
              // Auto-populate Aadhar Card if not already set and profile has it
              // Only skip if user has uploaded a new file (File object) or already has a URL
              const hasAadharFile = prev.aadharCard instanceof File
              const hasAadharUrl = prev.aadharCard && prev.aadharCard.url && !(prev.aadharCard instanceof File)
              const needsAadhar = !hasAadharFile && !hasAadharUrl
              const hasAadharInProfile = !!data.aadhar_card
              
              if (needsAadhar && hasAadharInProfile) {
                updates.aadharCard = { url: data.aadhar_card, name: 'Aadhar Card' }
                console.log('✅ Will auto-populate Aadhar Card from profile')
              } else if (hasAadharFile) {
                console.log('ℹ️ Aadhar Card already has a new file upload, skipping auto-populate')
              } else if (hasAadharUrl) {
                console.log('ℹ️ Aadhar Card already has a URL, skipping auto-populate')
              } else if (!hasAadharInProfile) {
                console.log('ℹ️ Profile does not have Aadhar Card')
              }
              
              // Auto-populate PAN Card if not already set and profile has it
              // Only skip if user has uploaded a new file (File object) or already has a URL
              const hasPanFile = prev.panCard instanceof File
              const hasPanUrl = prev.panCard && prev.panCard.url && !(prev.panCard instanceof File)
              const needsPan = !hasPanFile && !hasPanUrl
              const hasPanInProfile = !!data.pan_card
              
              if (needsPan && hasPanInProfile) {
                updates.panCard = { url: data.pan_card, name: 'PAN Card' }
                console.log('✅ Will auto-populate PAN Card from profile')
              } else if (hasPanFile) {
                console.log('ℹ️ PAN Card already has a new file upload, skipping auto-populate')
              } else if (hasPanUrl) {
                console.log('ℹ️ PAN Card already has a URL, skipping auto-populate')
              } else if (!hasPanInProfile) {
                console.log('ℹ️ Profile does not have PAN Card')
              }
              
              // Only update if there are changes
              if (Object.keys(updates).length > 0) {
                console.log('📄 Auto-populating documents from profile:', updates)
                return { ...prev, ...updates }
              } else {
                console.log('ℹ️ No documents to auto-populate (fields already filled or profile has no documents)')
              }
              
              return prev
            })
          } else {
            console.log('⚠️ No profile data found')
          }
        } catch (err) {
          console.error('❌ Error loading profile documents:', err)
        }
      }
      loadProfileDocuments()
    }
  }, [currentStep, isEditMode, user?.id, isLoaded])

  const totalSteps = 3

  // Load existing registration if editing
  useEffect(() => {
    const loadRegistration = async () => {
      if (editId && user?.id) {
        setIsLoading(true)
        try {
          const { data, error } = await getRegistrationById(editId, user.id)
          if (error) {
            setGeneralError('Failed to load registration. You may not have permission to edit this registration.')
            setIsLoading(false)
            return
          }

          if (data) {
            // Check if registration can be edited
            if (data.status !== 'pending' && data.status !== 'rejected') {
              setGeneralError('Only pending or rejected registrations can be edited.')
              setIsLoading(false)
              return
            }

            setExistingRegistration(data)
            setIsEditMode(true)
            
            // Populate form with existing data (don't auto-fill when editing)
            setFormData({
              propertyTitle: data.property_title || '',
              propertyType: data.property_type || '',
              propertyAddress: data.property_address || '',
              propertyState: data.property_state || '',
              propertySize: data.property_size?.toString() || '',
              propertyDescription: data.property_description || '',
              surveyNumber: data.survey_number || '',
              ownerName: data.owner_name || '',
              ownerEmail: data.owner_email || '',
              ownerPhone: data.owner_phone || '',
              documents: [], // Documents are URLs, not files
              extract712: data.extract_712 ? { name: '7-12-extract.pdf', url: data.extract_712 } : null,
              aadharCard: data.aadhar_card ? { name: 'aadhar-card.pdf', url: data.aadhar_card } : null,
              panCard: data.pan_card ? { name: 'pan-card.pdf', url: data.pan_card } : null,
              propertyDocument: data.property_document ? { name: 'property-document.pdf', url: data.property_document } : null,
              additionalNotes: data.additional_notes || '',
            })
          }
        } catch (error) {
          console.error('Error loading registration:', error)
          setGeneralError('Failed to load registration.')
        } finally {
          setIsLoading(false)
        }
      }
    }

    if (editId && isLoaded && user?.id) {
      loadRegistration()
    }
  }, [editId, isLoaded, user?.id])

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }
    // Clear general error when user makes changes
    if (generalError) {
      setGeneralError('')
    }
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    setFormData({
      ...formData,
      documents: [...formData.documents, ...files],
    })
  }

  const handle712ExtractUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        extract712: file,
      })
      // Clear error if exists
      if (errors.extract712) {
        setErrors({ ...errors, extract712: '' })
      }
    }
  }

  const remove712Extract = () => {
    setFormData({
      ...formData,
      extract712: null,
    })
  }

  const handleAadharCardUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        aadharCard: file,
      })
      // Clear error if exists
      if (errors.aadharCard) {
        setErrors({ ...errors, aadharCard: '' })
      }
    }
  }

  const removeAadharCard = () => {
    setFormData({
      ...formData,
      aadharCard: null,
    })
  }

  const handlePanCardUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        panCard: file,
      })
      // Clear error if exists
      if (errors.panCard) {
        setErrors({ ...errors, panCard: '' })
      }
    }
  }

  const removePanCard = () => {
    setFormData({
      ...formData,
      panCard: null,
    })
  }

  const handlePropertyDocumentUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({
        ...formData,
        propertyDocument: file,
      })
      // Clear error if exists
      if (errors.propertyDocument) {
        setErrors({ ...errors, propertyDocument: '' })
      }
    }
  }

  const removePropertyDocument = () => {
    setFormData({
      ...formData,
      propertyDocument: null,
    })
  }

  const validateStep = (step) => {
    const newErrors = {}
    
    switch (step) {
      case 1:
        // Validate Property Information
        if (!formData.propertyTitle.trim()) {
          newErrors.propertyTitle = 'Please enter a property title'
        } else if (formData.propertyTitle.trim().length < 5) {
          newErrors.propertyTitle = 'Property title should be at least 5 characters long'
        }
        if (!formData.propertyType || formData.propertyType === '') {
          newErrors.propertyType = 'Please select a property type'
        }
        if (!formData.propertyAddress.trim()) {
          newErrors.propertyAddress = 'Please enter the property address'
        } else if (formData.propertyAddress.trim().length < 10) {
          newErrors.propertyAddress = 'Please provide a complete address (minimum 10 characters)'
        }
        if (!formData.propertyState || formData.propertyState === '') {
          newErrors.propertyState = 'Please select the state where the property is located'
        }
        if (!formData.propertySize || formData.propertySize <= 0) {
          newErrors.propertySize = 'Please enter a valid property size in square feet or square meters'
        } else if (formData.propertySize > 1000000) {
          newErrors.propertySize = 'Property size seems too large. Please verify the value'
        }
        // Survey Number is critical for land identification
        if (!formData.surveyNumber.trim()) {
          newErrors.surveyNumber = 'Survey Number is required for land identification. This helps verify property ownership.'
        } else if (formData.surveyNumber.trim().length < 3) {
          newErrors.surveyNumber = 'Survey Number should be at least 3 characters long'
        }
        break
      case 2:
        // Validate Owner Information
        if (!formData.ownerName.trim()) {
          newErrors.ownerName = 'Please enter the owner name as it appears on legal documents'
        } else if (formData.ownerName.trim().length < 2) {
          newErrors.ownerName = 'Owner name should be at least 2 characters long'
        }
        if (!formData.ownerEmail.trim()) {
          newErrors.ownerEmail = 'Please enter the owner email address'
        } else {
          // Enhanced email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(formData.ownerEmail)) {
            newErrors.ownerEmail = 'Please enter a valid email address (e.g., name@example.com)'
          }
        }
        if (!formData.ownerPhone.trim()) {
          newErrors.ownerPhone = 'Please enter the owner phone number'
        } else {
          // Basic phone validation (10 digits minimum)
          const phoneRegex = /^[0-9]{10,15}$/
          const cleanedPhone = formData.ownerPhone.replace(/[\s\-()+]/g, '')
          if (!phoneRegex.test(cleanedPhone)) {
            newErrors.ownerPhone = 'Please enter a valid phone number (10-15 digits)'
          }
        }
        break
      case 3:
        // Validate required documents
        if (!formData.aadharCard) {
          newErrors.aadharCard = 'Aadhar Card is required'
        }
        if (!formData.panCard) {
          newErrors.panCard = 'PAN Card is required'
        }
        if (!formData.propertyDocument) {
          newErrors.propertyDocument = 'Property Document is required'
        }
        break
      default:
        break
    }
    
    setErrors(newErrors)
    console.log('Validation errors for step', step, ':', newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    console.log('Attempting to move to next step. Current step:', currentStep)
    console.log('Current form data:', formData)
    
    // Clear any general error
    setGeneralError('')
    
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        console.log('Validation passed. Moving to step:', currentStep + 1)
        setCurrentStep(currentStep + 1)
        // Scroll to top when moving to next step
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      console.log('Validation failed. Please check the errors.')
      setGeneralError('Please fill in all required fields correctly.')
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Prevent submission if not on final step
    if (currentStep !== totalSteps) {
      console.log('Not on final step, cannot submit')
      return
    }
    
    if (!user?.id) {
      setGeneralError('You must be logged in to submit a registration')
      return
    }

    setIsSubmitting(true)
    setGeneralError('')
    setUploadProgress(0)

    try {
      setUploadProgress(5)

      // Upload required documents first (only if they are File objects, not existing URLs)
      let aadharCardUrl = null
      if (formData.aadharCard) {
        if (formData.aadharCard instanceof File) {
          const tempId = `aadhar-${Date.now()}`
          const { data: uploadData, error: uploadError } = await uploadRegistrationDocument(
            formData.aadharCard,
            tempId,
            user.id
          )
          if (!uploadError && uploadData?.url) {
            aadharCardUrl = uploadData.url
          }
        } else if (formData.aadharCard.url) {
          // Existing document URL (during edit)
          aadharCardUrl = formData.aadharCard.url
        }
        setUploadProgress(15)
      }

      let panCardUrl = null
      if (formData.panCard) {
        if (formData.panCard instanceof File) {
          const tempId = `pan-${Date.now()}`
          const { data: uploadData, error: uploadError } = await uploadRegistrationDocument(
            formData.panCard,
            tempId,
            user.id
          )
          if (!uploadError && uploadData?.url) {
            panCardUrl = uploadData.url
          }
        } else if (formData.panCard.url) {
          // Existing document URL (during edit)
          panCardUrl = formData.panCard.url
        }
        setUploadProgress(25)
      }

      let propertyDocumentUrl = null
      if (formData.propertyDocument) {
        if (formData.propertyDocument instanceof File) {
          const tempId = `property-doc-${Date.now()}`
          const { data: uploadData, error: uploadError } = await uploadRegistrationDocument(
            formData.propertyDocument,
            tempId,
            user.id
          )
          if (!uploadError && uploadData?.url) {
            propertyDocumentUrl = uploadData.url
          }
        } else if (formData.propertyDocument.url) {
          // Existing document URL (during edit)
          propertyDocumentUrl = formData.propertyDocument.url
        }
        setUploadProgress(35)
      }

      // Upload 7/12 extract if provided (only if it's a File object)
      let extract712Url = null
      if (formData.extract712) {
        if (formData.extract712 instanceof File) {
          const tempId = `712-${Date.now()}`
          const { data: uploadData, error: uploadError } = await uploadRegistrationDocument(
            formData.extract712,
            tempId,
            user.id
          )
          if (!uploadError && uploadData?.url) {
            extract712Url = uploadData.url
          }
        } else if (formData.extract712.url) {
          // Existing document URL (during edit)
          extract712Url = formData.extract712.url
        }
        setUploadProgress(45)
      }

      // Upload other additional documents
      const documentUrls = []
      const totalDocs = formData.documents.length
      for (let i = 0; i < formData.documents.length; i++) {
        const file = formData.documents[i]
        const tempId = `temp-${Date.now()}-${i}`
        const { data: uploadData, error: uploadError } = await uploadRegistrationDocument(
          file,
          tempId,
          user.id
        )
        if (!uploadError && uploadData?.url) {
          documentUrls.push(uploadData.url)
        }
        // Update progress: 45% base + 35% for documents + 20% for submission
        setUploadProgress(45 + Math.round(((i + 1) / totalDocs) * 35))
      }

      setUploadProgress(80)
      
      // Create registration
      const registrationData = {
        property_title: formData.propertyTitle.trim() || null,
        property_type: formData.propertyType,
        property_address: formData.propertyAddress,
        property_state: formData.propertyState,
        property_size: parseInt(formData.propertySize) || null,
        property_description: formData.propertyDescription,
        survey_number: formData.surveyNumber.trim() || null,
        owner_name: formData.ownerName,
        owner_email: formData.ownerEmail,
        owner_phone: formData.ownerPhone,
        documents: documentUrls,
        extract_712: extract712Url,
        aadhar_card: aadharCardUrl,
        pan_card: panCardUrl,
        property_document: propertyDocumentUrl,
        additional_notes: formData.additionalNotes || null,
      }

      let result
      if (isEditMode && existingRegistration) {
        // Update existing registration
        result = await updateRegistration(existingRegistration.id, user.id, registrationData)
      } else {
        // Create new registration
        result = await createRegistration(registrationData, user.id)
      }

      setUploadProgress(90)

      if (result.error) {
        console.error('Registration error:', result.error)
        let errorMsg = 'Failed to submit registration. '
        
        if (result.error.code === '42501' || result.error.message?.includes('row-level security')) {
          errorMsg = 'Permission denied. Please ensure you are logged in and try again.'
        } else if (result.error.message) {
          errorMsg += result.error.message
        } else {
          errorMsg += 'Please check all fields and try again.'
        }
        
        setGeneralError(errorMsg)
        setIsSubmitting(false)
        setUploadProgress(0)
      } else {
        setUploadProgress(100)
        setIsSubmitting(false)
        setIsSuccess(true)
      }
    } catch (error) {
      console.error('Registration error:', error)
      setGeneralError('An unexpected error occurred. Please check your connection and try again. If the problem persists, contact support.')
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const progressPercentage = (currentStep / totalSteps) * 100

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <Section>
        <Container>
          <div className="max-w-2xl mx-auto text-center py-12">
            <p className="text-gray-700">Loading...</p>
          </div>
        </Container>
      </Section>
    )
  }

  // Redirect if not authenticated
  if (!user) {
    navigate('/login')
    return null
  }

  if (isSuccess) {
    return (
      <Section>
        <Container>
          <div className="max-w-2xl mx-auto">
            <Card padding="lg" className="text-center">
              <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="mb-4">
                {isEditMode ? 'Registration Updated Successfully' : 'Registration Submitted Successfully'}
              </h2>
              <p className="text-body-large text-gray-700 mb-8">
                {isEditMode
                  ? 'Your land registration has been updated. Our team will review your submission and contact you within 2-3 business days.'
                  : 'Your land registration request has been received. Our team will review your submission and contact you within 2-3 business days.'}
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  View Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Back to Home
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>
    )
  }

  return (
    <Section>
      <Container>
        <div className="max-w-3xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-bold text-gray-900 tracking-tight">
              {isEditMode ? 'Modify Registration' : 'Land Registration'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Secure your property ownership by registering it on the legal ledger and Stellar blockchain.
            </p>
          </div>

          {/* Progress Stepper - Pro Version */}
          <div className="mb-12">
            <div className="relative flex items-center justify-between">
              {/* Progress Line Background */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
              {/* Active Progress Line */}
              <div 
                className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-in-out" 
                style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
              />

              {[1, 2, 3].map((step) => (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm border-4 transition-all duration-300 ${
                      step < currentStep
                        ? 'bg-primary border-primary text-white scale-110'
                        : step === currentStep
                        ? 'bg-white border-primary text-primary scale-125 shadow-md shadow-primary/20'
                        : 'bg-white border-gray-100 text-gray-400'
                    }`}
                  >
                    {step < currentStep ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step
                    )}
                  </div>
                  <span className={`absolute -bottom-7 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${
                    step <= currentStep ? 'text-primary' : 'text-gray-400'
                  }`}>
                    {step === 1 ? 'Property Details' : step === 2 ? 'Owner Info' : 'Documents'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <Card padding="lg">
              {/* General Error Message */}
              {generalError && (
                <div className="status-banner-error mb-8">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold">{generalError}</p>
                  </div>
                </div>
              )}

              {/* Step 1: Property Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Property Information
                    </h3>
                    <p className="text-gray-700">
                      Provide details about the property you want to register
                    </p>
                  </div>
                  <Input
                    label="Property Title"
                    required
                    value={formData.propertyTitle}
                    onChange={(e) =>
                      handleInputChange('propertyTitle', e.target.value)
                    }
                    error={errors.propertyTitle}
                    placeholder="e.g., 3BHK Apartment in Andheri West"
                    helperText={!errors.propertyTitle ? "A short, descriptive name for your property (minimum 5 characters)" : undefined}
                  />
                  <Select
                    label="Property Type"
                    required
                    value={formData.propertyType}
                    onChange={(e) =>
                      handleInputChange('propertyType', e.target.value)
                    }
                    error={errors.propertyType}
                    options={[
                      { value: '', label: 'Select property type' },
                      { value: 'residential', label: 'Residential' },
                      { value: 'commercial', label: 'Commercial' },
                      { value: 'agricultural', label: 'Agricultural' },
                      { value: 'industrial', label: 'Industrial' },
                    ]}
                  />
                  <Input
                    label="Property Address"
                    required
                    value={formData.propertyAddress}
                    onChange={(e) =>
                      handleInputChange('propertyAddress', e.target.value)
                    }
                    error={errors.propertyAddress}
                    placeholder="Enter full property address"
                    helperText={!errors.propertyAddress ? "Include street, city, and landmark (minimum 10 characters)" : undefined}
                  />
                  <Select
                    label="State"
                    required
                    value={formData.propertyState}
                    onChange={(e) =>
                      handleInputChange('propertyState', e.target.value)
                    }
                    error={errors.propertyState}
                    options={[
                      { value: '', label: 'Select state' },
                      { value: 'Maharashtra', label: 'Maharashtra (7/12 Extract Required)' },
                      { value: 'Gujarat', label: 'Gujarat (7/12 Extract Required)' },
                      { value: 'Karnataka', label: 'Karnataka (RTC Document)' },
                      { value: 'Tamil Nadu', label: 'Tamil Nadu (Patta/Chitta)' },
                      { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
                      { value: 'Telangana', label: 'Telangana' },
                      { value: 'Kerala', label: 'Kerala' },
                      { value: 'Delhi', label: 'Delhi' },
                      { value: 'Rajasthan', label: 'Rajasthan' },
                      { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
                      { value: 'West Bengal', label: 'West Bengal' },
                      { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
                      { value: 'Punjab', label: 'Punjab' },
                      { value: 'Haryana', label: 'Haryana' },
                      { value: 'Bihar', label: 'Bihar' },
                      { value: 'Odisha', label: 'Odisha' },
                      { value: 'Assam', label: 'Assam' },
                      { value: 'Jharkhand', label: 'Jharkhand' },
                      { value: 'Chhattisgarh', label: 'Chhattisgarh' },
                      { value: 'Uttarakhand', label: 'Uttarakhand' },
                      { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
                      { value: 'Goa', label: 'Goa' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    helperText={
                      formData.propertyState === 'Maharashtra' || formData.propertyState === 'Gujarat'
                        ? '7/12 Extract (Satbara Utara) document will be recommended in Step 3'
                        : formData.propertyState === 'Karnataka'
                        ? 'RTC (Record of Rights, Tenancy, and Crops) document may be helpful'
                        : formData.propertyState === 'Tamil Nadu'
                        ? 'Patta or Chitta document may be helpful'
                        : ''
                    }
                  />
                  <Input
                    label="Property Size (sq ft)"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.propertySize}
                    onChange={(e) =>
                      handleInputChange('propertySize', e.target.value)
                    }
                    error={errors.propertySize}
                    placeholder="Enter property size"
                    helperText={!errors.propertySize ? "Enter the total area in square feet" : undefined}
                  />
                  <Input
                    label="Survey Number"
                    required
                    value={formData.surveyNumber}
                    onChange={(e) =>
                      handleInputChange('surveyNumber', e.target.value)
                    }
                    error={errors.surveyNumber}
                    placeholder="e.g., 125/3, 45/2/1, Survey No. 78"
                    helperText="Critical identifier for land. Format varies by state (e.g., '125/3', '45/2/1', 'Survey No. 78')"
                  />
                  <Textarea
                    label="Property Description"
                    value={formData.propertyDescription}
                    onChange={(e) =>
                      handleInputChange('propertyDescription', e.target.value)
                    }
                    placeholder="Describe the property"
                    minRows={4}
                  />
                </div>
              )}

              {/* Step 2: Owner Information */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Owner Information
                    </h3>
                    <p className="text-gray-700">
                      Provide your personal details as the property owner
                    </p>
                  </div>
                  <Input
                    label="Full Name"
                    required
                    value={formData.ownerName}
                    onChange={(e) =>
                      handleInputChange('ownerName', e.target.value)
                    }
                    error={errors.ownerName}
                    placeholder="Enter your full name"
                    helperText={!errors.ownerName ? "Enter name as it appears on legal documents (minimum 2 characters)" : undefined}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    required
                    value={formData.ownerEmail}
                    onChange={(e) =>
                      handleInputChange('ownerEmail', e.target.value)
                    }
                    error={errors.ownerEmail}
                    placeholder="Enter your email"
                    helperText={!errors.ownerEmail ? "We'll use this to send registration updates (e.g., name@example.com)" : undefined}
                  />
                  <Input
                    label="Phone Number"
                    type="tel"
                    required
                    value={formData.ownerPhone}
                    onChange={(e) =>
                      handleInputChange('ownerPhone', e.target.value)
                    }
                    error={errors.ownerPhone}
                    placeholder="Enter your phone number"
                    helperText={!errors.ownerPhone ? "Enter 10-15 digit phone number (e.g., 9876543210)" : undefined}
                  />
                </div>
              )}

              {/* Step 3: Documents */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Documents & Additional Information
                    </h3>
                    <p className="text-gray-700">
                      Upload the required documents and provide any additional details
                    </p>
                  </div>

                  {/* Required Documents Section */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Required Documents</h4>
                      <p className="text-sm text-gray-600">
                        The following documents are mandatory for land registration:
                      </p>
                      {(formData.aadharCard?.url || formData.panCard?.url) && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-800">
                            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Some documents have been auto-populated from your profile. You can update them if needed.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Aadhar Card */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label htmlFor="aadhar-card" className="block text-sm font-medium text-gray-900 mb-2">
                        Aadhar Card <span className="text-error">*</span>
                      </label>
                      <p className="text-sm text-gray-700 mb-2">
                        Upload a clear copy of your Aadhar Card (front side). This document is required for identity verification.
                      </p>
                      {!formData.aadharCard ? (
                        <div className="space-y-2">
                          <input
                            id="aadhar-card"
                            type="file"
                            onChange={handleAadharCardUpload}
                            className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                          <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {formData.aadharCard instanceof File ? formData.aadharCard.name : (formData.aadharCard.name || 'Aadhar Card')}
                              </p>
                              <p className="text-xs text-gray-600">
                                {formData.aadharCard instanceof File && formData.aadharCard.size 
                                  ? `${(formData.aadharCard.size / 1024 / 1024).toFixed(2)} MB` 
                                  : 'Uploaded'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeAadharCard}
                            className="text-error hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {errors.aadharCard && (
                        <p className="mt-2 text-sm text-error">{errors.aadharCard}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-600">
                        <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                      </p>
                    </div>

                    {/* PAN Card */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label htmlFor="pan-card" className="block text-sm font-medium text-gray-900 mb-2">
                        PAN Card <span className="text-error">*</span>
                      </label>
                      <p className="text-sm text-gray-700 mb-2">
                        Upload a clear copy of your PAN Card. This document is required for tax identification purposes.
                      </p>
                      {!formData.panCard ? (
                        <div className="space-y-2">
                          <input
                            id="pan-card"
                            type="file"
                            onChange={handlePanCardUpload}
                            className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                          <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {formData.panCard instanceof File ? formData.panCard.name : (formData.panCard.name || 'PAN Card')}
                              </p>
                              <p className="text-xs text-gray-600">
                                {formData.panCard instanceof File && formData.panCard.size 
                                  ? `${(formData.panCard.size / 1024 / 1024).toFixed(2)} MB` 
                                  : 'Uploaded'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removePanCard}
                            className="text-error hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {errors.panCard && (
                        <p className="mt-2 text-sm text-error">{errors.panCard}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-600">
                        <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                      </p>
                    </div>

                    {/* Property Document */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label htmlFor="property-document" className="block text-sm font-medium text-gray-900 mb-2">
                        Property Document <span className="text-error">*</span>
                      </label>
                      <p className="text-sm text-gray-700 mb-2">
                        Upload the property ownership document (e.g., Sale Deed, Gift Deed, Partition Deed, or any other legal document proving ownership).
                      </p>
                      {!formData.propertyDocument ? (
                        <div className="space-y-2">
                          <input
                            id="property-document"
                            type="file"
                            onChange={handlePropertyDocumentUpload}
                            className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                          <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {formData.propertyDocument instanceof File ? formData.propertyDocument.name : (formData.propertyDocument.name || 'Property Document')}
                              </p>
                              <p className="text-xs text-gray-600">
                                {formData.propertyDocument instanceof File && formData.propertyDocument.size 
                                  ? `${(formData.propertyDocument.size / 1024 / 1024).toFixed(2)} MB` 
                                  : 'Uploaded'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removePropertyDocument}
                            className="text-error hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {errors.propertyDocument && (
                        <p className="mt-2 text-sm text-error">{errors.propertyDocument}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-600">
                        <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                      </p>
                    </div>
                  </div>

                  {/* 7/12 Extract Section for Maharashtra and Gujarat */}
                  {(formData.propertyState === 'Maharashtra' || formData.propertyState === 'Gujarat') && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="mb-4">
                        <label htmlFor="extract-712" className="block text-sm font-medium text-gray-900 mb-2">
                          7/12 Extract (Satbara Utara / 7/12 Utara) <span className="text-gray-600 text-xs">(Recommended)</span>
                        </label>
                        <p className="text-sm text-gray-700 mb-2">
                          The <strong>7/12 Extract</strong> (also known as <strong>Satbara Utara</strong> or <strong>7/12 Utara</strong>) is an important land record document for properties in {formData.propertyState}. 
                          It contains survey number, area, owner details, land type, encumbrances, and crop details (for agricultural land).
                        </p>
                        <div className="text-xs text-gray-600 mb-3 space-y-1 bg-yellow-50 p-2 rounded">
                          <p><strong>ℹ️ When you might not have it:</strong></p>
                          <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>Apartment/flat registrations (may not require 7/12 extract)</li>
                            <li>Properties registered through different systems</li>
                            <li>Properties that don't fall under agricultural/revenue land</li>
                            <li>If you haven't needed it for previous transactions</li>
                          </ul>
                          <p className="mt-2"><strong>Note:</strong> If you don't have this document, you can still proceed. However, it may be requested during the review process.</p>
                        </div>
                        {!formData.extract712 ? (
                          <div className="space-y-2">
                            <input
                              id="extract-712"
                              type="file"
                              onChange={handle712ExtractUpload}
                              disabled={uploading712}
                              className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                            {uploading712 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                  <span>Uploading 7/12 Extract...</span>
                                  <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-white border border-gray-300 rounded">
                            <div className="flex items-center gap-3">
                              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{formData.extract712.name}</p>
                                <p className="text-xs text-gray-600">
                                  {(formData.extract712.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={remove712Extract}
                              className="text-error hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {errors.extract712 && (
                          <p className="mt-2 text-sm text-error">{errors.extract712}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-600">
                          <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB)
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          <strong>How to obtain:</strong>
                          {formData.propertyState === 'Maharashtra' && (
                            <> Online: <a href="https://mahabhulekh.maharashtra.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mahabhulekh.maharashtra.gov.in</a> | Offline: Visit Talathi office</>
                          )}
                          {formData.propertyState === 'Gujarat' && (
                            <> Online: <a href="https://anyror.gujarat.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">anyror.gujarat.gov.in</a> | Offline: Visit Talati office</>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Additional Documents Section */}
                  <div className="pt-4 border-t border-gray-200">
                    <label htmlFor="document-upload" className="block text-sm font-medium text-gray-900 mb-2">
                      Additional Documents (Optional)
                    </label>
                    <div className="space-y-2">
                      <input
                        id="document-upload"
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploadingDocuments}
                        className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      {uploadingDocuments && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Uploading documents...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-gray-700">
                        Accepted formats: PDF, JPG, PNG (Max 10MB per file)
                      </p>
                    </div>
                  </div>
                  {formData.documents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        Uploaded Documents:
                      </p>
                      {formData.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-100 rounded"
                        >
                          <span className="text-sm text-gray-700">
                            {doc.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newDocs = formData.documents.filter(
                                (_, i) => i !== index
                              )
                              setFormData({ ...formData, documents: newDocs })
                            }}
                            className="text-error hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Textarea
                    label="Additional Notes (Optional)"
                    value={formData.additionalNotes}
                    onChange={(e) =>
                      handleInputChange('additionalNotes', e.target.value)
                    }
                    placeholder="Add any additional information or special instructions for your registration..."
                    minRows={4}
                    helperText="For example: specific concerns, questions, or additional details about the property"
                  />
                </div>
              )}

              {/* Submission Progress */}
              {isSubmitting && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center justify-between text-sm text-blue-800 mb-2">
                    <span className="font-medium">Submitting registration...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    {uploadProgress < 30 ? 'Preparing documents...' :
                     uploadProgress < 80 ? 'Uploading documents...' :
                     'Finalizing submission...'}
                  </p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-400">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={currentStep === 1 || isSubmitting}
                >
                  Previous
                </Button>
                {currentStep < totalSteps ? (
                  <Button 
                    type="button" 
                    variant="primary" 
                    onClick={(e) => {
                      e.preventDefault()
                      handleNext()
                    }}
                    disabled={isSubmitting}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isEditMode ? 'Update Registration' : 'Submit Registration'}
                  </Button>
                )}
              </div>
            </Card>
          </form>
        </div>
      </Container>
    </Section>
  )
}

export default Registration

