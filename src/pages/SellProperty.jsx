import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'
import { createProperty, updateProperty, getPropertyById } from '../services/properties'
import { getRegistrations } from '../services/registrations'
import { getPurchasedProperties } from '../services/properties'
import { useToast } from '../hooks/useToast'
import Toast from '../components/ui/Toast'
import { PROPERTY_PLACEHOLDER } from '../utils/placeholders'
import { registerPropertyOnChain } from '../services/contracts'
// No ethers needed for Stellar
import useWallet from '../hooks/useWallet'
import TokenConversionInfo from '../components/TokenConversionInfo'
import { inrToTokens } from '../utils/tokenConversion'
import { notifyPropertyBlockchain } from '../services/notifications'
import { uploadPropertyToIPFS } from '../services/ipfs'
import { supabase } from '../lib/supabase'

const SellProperty = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isLoaded } = useUser()
  const { toasts, success, error, removeToast } = useToast()
  const { walletAddress, isTestnet, isFreighterInstalled, connectWallet, switchNetwork } = useWallet()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [registrations, setRegistrations] = useState([])
  const [purchasedProperties, setPurchasedProperties] = useState([])
  const [selectedRegistrationId, setSelectedRegistrationId] = useState('')
  const [selectedPropertySource, setSelectedPropertySource] = useState('registration') // 'registration' or 'purchased'
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isLoadingProperty, setIsLoadingProperty] = useState(false)
  const [isPurchasedProperty, setIsPurchasedProperty] = useState(false) // Track if editing a purchased property
  const [originalProperty, setOriginalProperty] = useState(null) // Store original property data to preserve ownership history
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    address: '',
    price: '',
    listingType: 'for_sale', // Default to for_sale since rent is removed
    type: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    yearBuilt: '',
    description: '',
    features: '',
    images: [],
    ownershipHistory: [], // Array of ownership records
    registrationId: '', // Registration ID - links to land registration
  })
  const [formErrors, setFormErrors] = useState({})

  // Load property for editing
  useEffect(() => {
    const loadPropertyForEdit = async () => {
      const editId = searchParams.get('edit')
      if (!editId || !user?.id || !isLoaded) return
      
      setIsLoadingProperty(true)
      try {
        const { data: property, error: propertyError } = await getPropertyById(editId, false, true) // includeSold = true
        
        if (propertyError || !property) {
          error('Property not found or you do not have permission to edit it.')
          setTimeout(() => navigate('/dashboard?tab=My Listings'), 1500)
          return
        }
        
        // Check if user owns the property (either as owner or buyer)
        // For purchased properties, user_id is the new owner (buyer) and sold_to also contains buyer ID
        const isOwner = property.user_id === user.id
        const isBuyer = property.sold_to === user.id
        
        if (!isOwner && !isBuyer) {
          error('You can only edit your own properties.')
          setTimeout(() => navigate('/dashboard?tab=My Listings'), 1500)
          return
        }
        
        setIsEditMode(true)
        setOriginalProperty(property) // Store original property to preserve ownership history
        const isPurchased = property.sold_to === user.id || (property.sold_at && property.user_id === user.id)
        
        // Populate form with existing property data
        setFormData({
          title: property.title || '',
          location: property.location || '',
          address: property.address || '',
          price: property.price?.toString() || '',
          listingType: property.listing_type || null,
          type: property.type || '',
          bedrooms: property.bedrooms?.toString() || '',
          bathrooms: property.bathrooms?.toString() || '',
          sqft: property.sqft?.toString() || '',
          yearBuilt: property.year_built?.toString() || '',
          description: property.description || '',
          features: property.features?.join(', ') || '',
          images: property.images?.filter(img => !img || !img.startsWith('blob:')) || [], // Filter out blob URLs
          ownershipHistory: property.ownership_history || [],
          registrationId: property.registration_id || '',
        })
        
        // Set property source based on registration or if it's a purchased property
        setIsPurchasedProperty(isPurchased)
        if (!property.listing_type && !isPurchased) {
          setFormData(prev => ({ ...prev, listingType: 'for_sale' }))
        }
        
        if (property.registration_id) {
          setSelectedPropertySource('registration')
          setSelectedRegistrationId(property.registration_id)
        } else if (isPurchased) {
          // This is a purchased property
          setSelectedPropertySource('purchased')
          setSelectedRegistrationId(property.id) // Use property ID as the selected ID
        }
      } catch (err) {
        console.error('Error loading property for edit:', err)
        error('Failed to load property for editing.')
        navigate('/dashboard?tab=My Listings')
      } finally {
        setIsLoadingProperty(false)
      }
    }
    
    loadPropertyForEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, isLoaded]) // Removed navigate and error to prevent infinite loop

  // Load approved registrations and purchased properties on mount (skip in edit mode)
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id || !isLoaded || isEditMode) {
        // If in edit mode, set loading to false immediately
        if (isEditMode) {
          setIsLoadingRegistrations(false)
        }
        return
      }
      
      setIsLoadingRegistrations(true)
      try {
        const [registrationsResult, purchasedResult] = await Promise.all([
          getRegistrations(user.id, { status: 'approved' }),
          getPurchasedProperties(user.id)
        ])
        
        if (!registrationsResult.error && registrationsResult.data) {
          // Fetch existing properties to find out which registrations are already listed or sold
          const { data: existingProperties } = await supabase
            .from('properties')
            .select('registration_id')
            .not('registration_id', 'is', null)
          
          const usedRegistrationIds = existingProperties?.map(p => p.registration_id) || []
          
          // Filter out registrations that are already used
          const availableRegistrations = registrationsResult.data.filter(
            reg => !usedRegistrationIds.includes(reg.id)
          )
          
          setRegistrations(availableRegistrations)
        } else {
          setRegistrations([])
        }
        
        if (!purchasedResult.error && purchasedResult.data) {
          setPurchasedProperties(purchasedResult.data)
        } else {
          setPurchasedProperties([])
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setRegistrations([])
        setPurchasedProperties([])
      } finally {
        setIsLoadingRegistrations(false)
      }
    }
    
    loadData()
  }, [user?.id, isLoaded, isEditMode])

  // Handle property source change (registration vs purchased)
  const handlePropertySourceChange = (source) => {
    setSelectedPropertySource(source)
    setSelectedRegistrationId('')
    setFormData(prev => ({
      ...prev,
      registrationId: '',
      address: '',
      type: '',
      sqft: '',
    }))
  }

  // Auto-populate form when registration or purchased property is selected
  const handleRegistrationChange = (registrationId) => {
    setSelectedRegistrationId(registrationId)
    
    if (!registrationId) {
      // Clear form if no registration selected
      setFormData(prev => ({
        ...prev,
        registrationId: '',
        address: '',
        type: '',
        sqft: '',
        title: '',
        description: '',
        location: '',
      }))
      return
    }

    if (selectedPropertySource === 'registration') {
      const registration = registrations.find(r => r.id === registrationId)
      if (!registration) return

      // Auto-populate from registration
      setFormData(prev => ({
        ...prev,
        registrationId: registrationId,
        address: registration.property_address || prev.address,
        type: mapRegistrationTypeToPropertyType(registration.property_type) || prev.type,
        sqft: registration.property_size ? String(registration.property_size) : prev.sqft,
        // Use property_title if available, fall back to first 60 chars of description
        title: registration.property_title
          ? registration.property_title
          : (registration.property_description
              ? (registration.property_description.length > 60
                  ? registration.property_description.substring(0, 60).trimEnd() + '…'
                  : registration.property_description)
              : prev.title),
        description: registration.property_description || prev.description,
        // Extract location from address (try to get area/neighborhood)
        location: registration.property_address 
          ? (() => {
              const parts = registration.property_address.split(',')
              // Try to get a meaningful location (usually second-to-last or last part)
              return parts.length > 1 
                ? parts[parts.length - 2]?.trim() || parts[0]?.trim() || prev.location
                : parts[0]?.trim() || prev.location
            })()
          : prev.location,
      }))
    } else if (selectedPropertySource === 'purchased') {
      const property = purchasedProperties.find(p => p.id === registrationId)
      if (!property) return

      // Auto-populate from purchased property
      setFormData(prev => ({
        ...prev,
        registrationId: registrationId, // Store property ID for reference
        address: property.address || prev.address,
        type: property.type || prev.type,
        sqft: property.sqft ? String(property.sqft) : prev.sqft,
        location: property.location || prev.location,
        title: property.title || prev.title,
        description: property.description || prev.description,
      }))
    }

    // Clear errors for auto-filled fields
    setFormErrors(prev => ({
      ...prev,
      address: '',
      type: '',
      sqft: '',
      location: '',
    }))
  }

  // Map registration property_type to property listing type
  const mapRegistrationTypeToPropertyType = (regType) => {
    const mapping = {
      'residential': 'house',
      'commercial': 'commercial',
      'agricultural': 'land',
      'industrial': 'commercial',
    }
    return mapping[regType] || ''
  }

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' })
    }
  }

  const handlePriceChange = (e) => {
    const value = e.target.value
    // Allow empty string, numbers, and single decimal point
    // This prevents the browser from auto-formatting the number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      handleInputChange('price', value)
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Validate file types and sizes
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const MAX_IMAGES = 10
    const currentImageCount = formData.images.length

    // Check total image count
    if (currentImageCount + files.length > MAX_IMAGES) {
      error(`You can upload a maximum of ${MAX_IMAGES} images. You currently have ${currentImageCount} and are trying to add ${files.length}.`)
      e.target.value = '' // Reset input
      return
    }

    // Validate each file
    const invalidFiles = []
    const validFiles = []

    for (const file of files) {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        invalidFiles.push({
          name: file.name,
          reason: `Invalid file type. Allowed formats: JPG, PNG, WEBP`
        })
        continue
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push({
          name: file.name,
          reason: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        })
        continue
      }

      validFiles.push(file)
    }

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      const errorMessages = invalidFiles.map(f => `${f.name}: ${f.reason}`).join('\n')
      error(`Some files could not be uploaded:\n${errorMessages}`)
      e.target.value = '' // Reset input
    }

    // If no valid files, return
    if (validFiles.length === 0) {
      return
    }

    setUploadingImages(true)
    setUploadProgress(0)

    try {
      // Use the authenticated Supabase client for storage uploads.
      const { supabaseStorage } = await import('../lib/supabaseStorage')
      
      // Debug: Check if we have authentication
      if (user?.id) {
        console.log('User authenticated:', user.id)
      } else {
        console.error('User not authenticated!')
        error('Please log in to upload images.')
        return
      }
      
      const imageUrls = []
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        
        // Generate unique file name with better uniqueness
        const fileExt = file.name.split('.').pop()
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const uniqueId = `${timestamp}-${i}-${randomStr}` // Include index to ensure uniqueness even if timestamp is same
        const fileName = `${user.id}/${uniqueId}.${fileExt}`
        const filePath = `properties/${fileName}`
        
        console.log('Attempting to upload:', filePath)
        
        // Upload to Supabase Storage using the authenticated client.
        const { error: uploadError } = await supabaseStorage.storage
          .from('property-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          console.error('Upload error details:', {
            message: uploadError.message,
            statusCode: uploadError.statusCode,
            error: uploadError.error
          })
          
          // Provide helpful error message
          if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS')) {
            error(`Storage policy error: Please run the SQL script in storage-property-images-setup.sql in your Supabase SQL Editor to fix this. Error: ${uploadError.message}`)
          } else {
            error(`Failed to upload ${file.name}: ${uploadError.message}`)
          }
          continue
        }
        
        // Get public URL (use regular client - public URLs don't need auth)
        const { supabase } = await import('../lib/supabase')
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(filePath)
        
        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl)
        } else {
          console.error('Failed to get public URL for:', filePath)
          error(`Failed to get URL for ${file.name}`)
          continue
        }
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100))
      }
      
      if (imageUrls.length > 0) {
        setFormData({ ...formData, images: [...formData.images, ...imageUrls] })
        
        if (invalidFiles.length > 0) {
          success(`Successfully uploaded ${imageUrls.length} image(s). ${invalidFiles.length} file(s) were skipped due to errors.`)
        } else {
          success(`Successfully uploaded ${imageUrls.length} image(s).`)
        }
      } else {
        error('No images were uploaded. Please try again.')
      }
      
      setUploadingImages(false)
      setUploadProgress(0)
    } catch (err) {
      console.error('Error uploading images:', err)
      error('Failed to upload images. Please check your connection and try again.')
      setUploadingImages(false)
      setUploadProgress(0)
    } finally {
      e.target.value = '' // Reset input
    }
  }

  const removeImage = (index) => {
    const newImages = formData.images.filter((_, i) => i !== index)
    setFormData({ ...formData, images: newImages })
  }

  const addOwnershipRecord = () => {
    setFormData({
      ...formData,
      ownershipHistory: [
        ...formData.ownershipHistory,
        {
          owner_name: '',
          from_date: '',
          to_date: '',
          transfer_type: 'sale',
          notes: '',
        },
      ],
    })
  }

  const updateOwnershipRecord = (index, field, value) => {
    const updated = [...formData.ownershipHistory]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, ownershipHistory: updated })
  }

  const removeOwnershipRecord = (index) => {
    const updated = formData.ownershipHistory.filter((_, i) => i !== index)
    setFormData({ ...formData, ownershipHistory: updated })
  }

  const validateForm = () => {
    const errors = {}

    // Registration is required only when creating new listings (not editing purchased properties)
    if (!isEditMode && !formData.registrationId) {
      errors.registrationId = 'Please select a registered property. You can only list properties that have been registered and approved.'
    }

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    } else if (formData.title.trim().length < 10) {
      errors.title = 'Title should be at least 10 characters long'
    }

    if (!formData.location.trim()) {
      errors.location = 'Location is required'
    } else if (formData.location.trim().length < 3) {
      errors.location = 'Please enter a valid location (minimum 3 characters)'
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required'
    } else if (formData.address.trim().length < 10) {
      errors.address = 'Please provide a complete address (minimum 10 characters)'
    }

    // Price is required only if listing type is selected (for sale)
    // For purchased properties being edited without listing, price is optional
    if (formData.listingType) {
      if (!formData.price || parseFloat(formData.price) <= 0) {
        errors.price = 'Please enter a valid price greater than 0'
      } else if (parseFloat(formData.price) > 999999999) {
        errors.price = 'Price seems too high. Please verify the amount'
      }
    }

    if (!formData.type) {
      errors.type = 'Please select a property type'
    }

    if (!formData.bedrooms || parseInt(formData.bedrooms) < 0) {
      errors.bedrooms = 'Please enter the number of bedrooms (0 or more)'
    } else if (parseInt(formData.bedrooms) > 50) {
      errors.bedrooms = 'Number of bedrooms seems too high. Please verify'
    }

    if (!formData.bathrooms || parseInt(formData.bathrooms) < 0) {
      errors.bathrooms = 'Please enter the number of bathrooms (0 or more)'
    } else if (parseInt(formData.bathrooms) > 50) {
      errors.bathrooms = 'Number of bathrooms seems too high. Please verify'
    }

    if (!formData.sqft || parseInt(formData.sqft) <= 0) {
      errors.sqft = 'Please enter a valid square footage greater than 0'
    } else if (parseInt(formData.sqft) > 1000000) {
      errors.sqft = 'Square footage seems too large. Please verify'
    }

    // Images are optional - no validation needed

    setFormErrors(errors)
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isLoaded || !user?.id) {
      error('Please log in to list a property')
      setTimeout(() => navigate('/login'), 1500)
      return
    }

    // Skip registration validation in edit mode
    if (!isEditMode) {
      // Check if user has approved registrations or purchased properties
      if (selectedPropertySource === 'registration' && registrations.length === 0) {
        error('You must have at least one approved property registration before listing a property. Please register your property first.')
        return
      }
      if (selectedPropertySource === 'purchased' && purchasedProperties.length === 0) {
        error('You must have at least one purchased property before listing it. Please purchase a property first.')
        return
      }

      // Check if property is selected
      if (!formData.registrationId) {
        const sourceText = selectedPropertySource === 'registration' ? 'registered property' : 'purchased property'
        error(`Please select a ${sourceText}.`)
        setFormErrors(prev => ({ ...prev, registrationId: `Please select a ${sourceText}` }))
        return
      }
    }

    // Blockchain registration is OPTIONAL - properties will work through Supabase even if blockchain fails
    // Check blockchain requirements but don't block property creation
    let currentWalletAddress = walletAddress
    let canRegisterOnBlockchain = false
    
    if (isFreighterInstalled && walletAddress && isTestnet) {
      canRegisterOnBlockchain = true
      currentWalletAddress = walletAddress
    } else {
      // Try to enable blockchain if possible, but don't fail if it doesn't work
      if (isFreighterInstalled) {
        if (!currentWalletAddress) {
          try {
            const connectedAddress = await connectWallet()
            if (connectedAddress) {
              currentWalletAddress = connectedAddress
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (err) {
            console.log('Could not connect wallet, continuing without blockchain registration')
          }
        }
        
        if (currentWalletAddress && !isTestnet) {
          try {
            await switchNetwork()
            await new Promise(resolve => setTimeout(resolve, 2000))
            canRegisterOnBlockchain = true
          } catch (err) {
            console.log('Could not switch network, continuing without blockchain registration')
          }
        } else if (currentWalletAddress && isTestnet) {
          canRegisterOnBlockchain = true
        }
      }
    }
    
    if (!canRegisterOnBlockchain) {
      console.log('Blockchain registration not available - property will be saved to Supabase only')
    }

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
        // Create a helpful error message listing all missing fields
        const fieldLabels = {
          registrationId: 'Registered Property',
          title: 'Property Title',
          location: 'Location',
          address: 'Full Address',
          price: 'Price',
          type: 'Property Type',
          bedrooms: 'Bedrooms',
          bathrooms: 'Bathrooms',
          sqft: 'Square Feet'
        }
        
        const missingFields = Object.keys(validationErrors)
          .filter(key => validationErrors[key])
          .map(key => fieldLabels[key] || key)
        
        if (missingFields.length > 0) {
          const fieldsList = missingFields.length === 1 
            ? missingFields[0]
            : missingFields.slice(0, -1).join(', ') + ' and ' + missingFields[missingFields.length - 1]
          
          error(`Please fill in the following required field${missingFields.length > 1 ? 's' : ''}: ${fieldsList}`)
          
          // Scroll to the first error field
          setTimeout(() => {
            const firstErrorKey = Object.keys(validationErrors).find(key => validationErrors[key])
            if (firstErrorKey) {
              let element = null
              
              // Try different methods to find the element
              if (firstErrorKey === 'images') {
                element = document.getElementById('images')
              } else if (firstErrorKey === 'registrationId') {
                // Find the select element for registration
                const selects = document.querySelectorAll('select')
                for (let select of selects) {
                  const label = select.closest('div')?.querySelector('label')
                  if (label?.textContent?.includes('Registered Property')) {
                    element = select
                    break
                  }
                }
              } else {
                // Try to find input/select by looking for labels that match
                const allInputs = document.querySelectorAll('input, select, textarea')
                for (let input of allInputs) {
                  const label = input.closest('div')?.querySelector('label')
                  if (label && fieldLabels[firstErrorKey] && 
                                          label.textContent.includes(fieldLabels[firstErrorKey])) {
                  element = input
                  break
                }
              }
            }
            
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setTimeout(() => element.focus(), 300)
            }
          }
        }, 100)
      } else {
        error('Please fill in all required fields correctly')
      }
      
      return
    }

    setIsSubmitting(true)

    try {
      const propertyData = {
        title: formData.title,
        location: formData.location,
        address: formData.address,
        listing_type: formData.listingType || (isEditMode && isPurchasedProperty ? originalProperty?.listing_type : null), // Preserve original listing type if not set
        type: formData.type,
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        sqft: parseInt(formData.sqft),
        year_built: formData.yearBuilt ? parseInt(formData.yearBuilt) : null,
        description: formData.description.trim() || null,
        features: formData.features
          ? formData.features.split(',').map(f => f.trim()).filter(Boolean)
          : [],
        images: formData.images.length > 0 ? formData.images : [PROPERTY_PLACEHOLDER],
        // Don't update ownership history for purchased properties - preserve historical records
        ownership_history: isPurchasedProperty 
          ? (originalProperty?.ownership_history || []) // Keep existing ownership history unchanged
          : (formData.ownershipHistory.length > 0 
              ? formData.ownershipHistory.filter(r => r.owner_name.trim()) // Only include records with owner names
              : []),
        user_id: user.id,
        // Preserve 'sold' status for purchased properties — only new/relisted properties should be 'active'
        status: (isPurchasedProperty && originalProperty?.status === 'sold') ? 'sold' : 'active',
      }

      // Preserve sold_to and sold_at for purchased properties so they remain visible in the buyer's dashboard
      if (isPurchasedProperty && originalProperty) {
        if (originalProperty.sold_to) propertyData.sold_to = originalProperty.sold_to
        if (originalProperty.sold_at) propertyData.sold_at = originalProperty.sold_at
      }
      
      // Only include price if listing type is set or if editing purchased property (preserve original price)
      if (formData.listingType) {
        propertyData.price = parseFloat(formData.price)
      } else if (isEditMode && isPurchasedProperty && originalProperty?.price) {
        propertyData.price = originalProperty.price // Preserve original price if not listing
      } else if (!isEditMode) {
        propertyData.price = parseFloat(formData.price) // Required for new listings
      }

      // Link property to its verified registration record
      if (formData.registrationId && selectedPropertySource === 'registration') {
        propertyData.registration_id = formData.registrationId;
        
        // Also attach the registration number if it exists on the source registration
        const sourceReg = registrations.find(r => r.id === formData.registrationId);
        if (sourceReg && sourceReg.registration_number) {
          propertyData.registration_number = sourceReg.registration_number;
        }
      }

      console.log('Submitting property data:', propertyData)

      // Register on blockchain ONLY for new properties OR if property doesn't have blockchain ID yet
      let blockchainPropertyId = null
      let blockchainTxHash = null
      let blockchainError = null

      // Only register on blockchain if:
      // 1. Creating a new property (not editing), OR
      // 2. Editing but property doesn't have blockchain_property_id yet
      const shouldRegisterOnBlockchain = !isEditMode || !originalProperty?.blockchain_property_id

      // Only try blockchain registration if conditions are met (OPTIONAL)
      if (shouldRegisterOnBlockchain && canRegisterOnBlockchain && currentWalletAddress) {
        try {
          // Convert price appropriately - use form price or original price
          const priceToUse = formData.price ? parseFloat(formData.price) : (originalProperty?.price || 0)
          
          success('Registering property on blockchain...')
          const blockchainResult = await registerPropertyOnChain(
            formData.title,
            formData.location || formData.address,
            BigInt(Math.floor(priceToUse))
          )
        
          if (blockchainResult.propertyId) {
            blockchainPropertyId = blockchainResult.propertyId
            blockchainTxHash = blockchainResult.txHash
            propertyData.blockchain_property_id = blockchainPropertyId
            propertyData.blockchain_tx_hash = blockchainTxHash
            success('Property registered on blockchain! Uploading to IPFS...')
            
            // Create notification for property owner
            if (user?.id) {
              try {
                await notifyPropertyBlockchain(
                  user.id,
                  formData.title,
                  null, // Property ID not available yet
                  blockchainTxHash
                )
              } catch (notifError) {
                console.error('Error creating blockchain notification:', notifError)
              }
            }
          }
        } catch (err) {
          console.error('Blockchain registration error:', err)
          blockchainError = err
          // Graceful fallback: Continue with IPFS and Supabase save even if blockchain fails
          console.log('Blockchain registration failed, but property will still be saved to database')
        }
      } else {
        // When editing existing property that already has blockchain ID, preserve it
        if (originalProperty?.blockchain_property_id) {
          propertyData.blockchain_property_id = originalProperty.blockchain_property_id
          propertyData.blockchain_tx_hash = originalProperty.blockchain_tx_hash
          blockchainPropertyId = originalProperty.blockchain_property_id
          blockchainTxHash = originalProperty.blockchain_tx_hash
        }
        console.log('Skipping blockchain registration - property already on-chain or edit mode')
      }

      const editId = searchParams.get('edit')

      // Upload to IPFS (OPTIONAL - property works without it)
      let ipfsMetadataCid = null
      let ipfsMetadataUrl = null
      let ipfsImageCids = []
      let ipfsError = null

      // For purchased properties, fetch the actual ownership transfer history
      // so IPFS metadata reflects the real on-chain ownership records.
      let ipfsOwnershipHistory = formData.ownershipHistory || []
      if (isPurchasedProperty && editId) {
        try {
          const { getPropertyOwnershipHistory } = await import('../services/contracts')
          const transfers = await getPropertyOwnershipHistory(editId)
          if (transfers && transfers.length > 0) {
            ipfsOwnershipHistory = transfers.map(t => ({
              from: t.previousOwner || 'Unknown',
              to: t.newOwner || 'Unknown',
              transferType: t.transferType || 'sale',
              date: t.timestamp || new Date().toISOString(),
              escrowTxHash: t.blockchainTxHash || null,
              nftTransferTxHash: t.nftTransferTxHash || null,
            }))
          }
        } catch (historyErr) {
          console.warn('Could not fetch ownership history for IPFS metadata:', historyErr?.message)
        }
      }

      const baseMetadata = {
        title: formData.title,
        location: formData.location,
        address: formData.address,
        type: formData.type,
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 0,
        sqft: parseInt(formData.sqft) || null,
        yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null,
        description: formData.description || null,
        features: formData.features ? formData.features.split(',').map(f => f.trim()).filter(Boolean) : [],
        price: formData.price ? parseFloat(formData.price) : null,
        listingType: formData.listingType,
        // For purchased properties, include the sold status so IPFS reflects the true state
        status: (isPurchasedProperty && originalProperty?.status === 'sold') ? 'sold' : 'active',
        ownershipHistory: ipfsOwnershipHistory,
        blockchainPropertyId: blockchainPropertyId || null,
        blockchainTxHash: blockchainTxHash || null,
      }

      // Try to upload to IPFS, but don't fail if it doesn't work
      if (formData.images.length > 0) {
        try {
          success('Uploading to IPFS...')
          const imageFiles = []
          
          const metadata = {
            ...baseMetadata,
            images: formData.images, // Store image URLs in metadata
          }

          const ipfsResult = await uploadPropertyToIPFS(
            imageFiles.length > 0 ? imageFiles : [],
            metadata,
            isEditMode ? editId : null
          )

          ipfsMetadataCid = ipfsResult.metadataCid
          ipfsMetadataUrl = ipfsResult.metadataUrl
          ipfsImageCids = ipfsResult.images.map(img => img.cid)

          propertyData.ipfs_metadata_cid = ipfsMetadataCid
          propertyData.ipfs_metadata_url = ipfsMetadataUrl
          propertyData.ipfs_image_cids = ipfsImageCids

          success('Uploaded to IPFS!')
        } catch (err) {
          console.error('IPFS upload error:', err)
          ipfsError = err
          console.log('IPFS upload failed, but property will still be saved to database')
        }
      } else {
        try {
          success('Uploading metadata to IPFS...')
          
          const metadata = {
            ...baseMetadata,
            images: [], // No images
          }

          const { uploadMetadataToIPFS } = await import('../services/ipfs')
          const ipfsResult = await uploadMetadataToIPFS(metadata, {
            name: `property-${isEditMode ? editId : Date.now()}/metadata.json`,
            keyvalues: {
              propertyId: isEditMode ? editId : 'new',
              type: 'property-metadata'
            }
          })

          ipfsMetadataCid = ipfsResult.cid
          ipfsMetadataUrl = ipfsResult.gatewayUrl

          propertyData.ipfs_metadata_cid = ipfsMetadataCid
          propertyData.ipfs_metadata_url = ipfsMetadataUrl
          propertyData.ipfs_image_cids = []

          success('Uploaded to IPFS!')
        } catch (err) {
          console.error('IPFS upload error:', err)
          ipfsError = err
          console.log('IPFS upload failed, but property will still be saved to database')
        }
      }

      // Save to Supabase (always happens, even if blockchain registration is enabled)
      let result
      if (isEditMode && editId) {
        // Update existing property
        result = await updateProperty(editId, propertyData)
      } else {
        // Create new property
        result = await createProperty(propertyData)
      }
      
      const { data, error: submitError } = result

      // Update notification with property ID if blockchain registration succeeded
      if (!submitError && data && blockchainTxHash && user?.id) {
        try {
          // Update the notification link with actual property ID
          const { supabase } = await import('../lib/supabase')
          await supabase
            .from('notifications')
            .update({ link: `/properties/${data.id}` })
            .eq('user_id', user.id)
            .eq('type', 'property_blockchain')
            .order('created_at', { ascending: false })
            .limit(1)
        } catch (notifError) {
          console.error('Error updating notification link:', notifError)
        }
      }

      // Auto-mint NFT via Supabase Edge Function (server-side admin key signing)
      if (!submitError && data && blockchainPropertyId && !isEditMode) {
        try {
          const tokenUri = ipfsMetadataCid
            ? `ipfs://${ipfsMetadataCid}`
            : `${window.location.origin}/properties/${data.id}`

          success('Minting property NFT on-chain...')

          const { mintPropertyNFT } = await import('../services/contracts')
          const mintResult = await mintPropertyNFT(
            currentWalletAddress,
            blockchainPropertyId,
            tokenUri
          )

          if (mintResult?.tokenId) {
            // Save NFT metadata back to Supabase
            const { supabase } = await import('../lib/supabase')
            await supabase
              .from('properties')
              .update({
                nft_token_id: mintResult.tokenId,
                nft_contract_address: mintResult.contractId,
                nft_token_uri: tokenUri,
                nft_mint_tx_hash: mintResult.txHash,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.id)

            success(`NFT minted! Token #${mintResult.tokenId} 🎉`)
          } else {
            console.warn('[NFT] Mint edge function returned error:', mintResult)
            // Store URI for later reference even if minting failed
            const { supabase } = await import('../lib/supabase')
            await supabase
              .from('properties')
              .update({ nft_token_uri: tokenUri, updated_at: new Date().toISOString() })
              .eq('id', data.id)
          }
        } catch (nftErr) {
          console.warn('[NFT] Could not auto-mint NFT:', nftErr)
        }
      }

      if (submitError) {
        console.error('Error creating property:', submitError)
        let errorMessage = 'Failed to list property. '
        
        if (submitError.code === '42501' || submitError.message?.includes('row-level security')) {
          errorMessage += 'Permission denied. Please ensure you are logged in and try again.'
        } else if (submitError.message?.includes('registration_id') || submitError.message?.includes('schema cache')) {
          errorMessage += 'Database schema error: The registration_id column is missing. Please run the migration file "migration-add-registration-id.sql" in your Supabase SQL Editor to add this column.'
        } else if (submitError.message) {
          errorMessage += submitError.message
        } else {
          errorMessage += 'Please check all fields and try again.'
        }
        
        error(errorMessage)
        setIsSubmitting(false) // Allow retry
      } else {
        if (isEditMode) {
          let message = 'Property updated successfully!'
          if (blockchainPropertyId) {
            message += ' Registered on blockchain.'
          } else if (originalProperty?.blockchain_property_id) {
            message += ' (Blockchain record preserved)'
          }
          if (ipfsMetadataCid) {
            message += ' Stored on IPFS.'
          } else if (ipfsError) {
            message += ' (IPFS upload failed, but property is saved in database)'
          }
          success(message)
          setTimeout(() => {
            navigate('/dashboard?tab=My Listings')
          }, 1500)
        } else {
          let message = 'Property listed successfully!'
          if (blockchainPropertyId) {
            message += ' Registered on blockchain.'
          } else if (blockchainError) {
            message += ' (Blockchain registration failed, but property is saved in database)'
          }
          if (ipfsMetadataCid) {
            message += ' Stored on IPFS.'
          } else if (ipfsError) {
            message += ' (IPFS upload failed, but property is saved in database)'
          }
          if (!blockchainPropertyId && !ipfsMetadataCid && !blockchainError && !ipfsError) {
            message += ' (Saved to database - blockchain/IPFS features unavailable)'
          } else {
            message += ' It will be reviewed before going live.'
          }
          success(message)
          setTimeout(() => {
            navigate('/properties')
          }, 1500)
        }
      }
    } catch (err) {
      console.error('Error:', err)
      error('An unexpected error occurred. Please check your connection and try again.')
      setIsSubmitting(false) // Allow retry on error
    }
  }

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

  return (
    <Section>
      <Container>
        <div className="max-w-3xl mx-auto">
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

          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-bold text-gray-900 tracking-tight">
              {isEditMode ? 'Refine Your Listing' : 'List Your Real Estate'}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {isEditMode 
                ? 'Update your property details, images, and blockchain records to keep your listing accurate.'
                : 'Turn your real-world assets into digital property. Sell with full blockchain transparency.'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Card padding="lg">
              <div className="space-y-6">
                {/* Property Source Selection - Premium Cards (Hidden in edit mode) */}
                {!isEditMode && (
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                      Select Property Source
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div 
                        onClick={() => handlePropertySourceChange('registration')}
                        className={`radio-card ${selectedPropertySource === 'registration' ? 'radio-card-active' : 'border-gray-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${selectedPropertySource === 'registration' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Registered Land</p>
                          <p className="text-xs text-gray-500">List from your verified registrations</p>
                        </div>
                      </div>

                      <div 
                        onClick={() => handlePropertySourceChange('purchased')}
                        className={`radio-card ${selectedPropertySource === 'purchased' ? 'radio-card-active' : 'border-gray-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${selectedPropertySource === 'purchased' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Purchased Assets</p>
                          <p className="text-xs text-gray-500">Resell properties you've acquired</p>
                        </div>
                      </div>
                    </div>
                    
                    {isLoadingRegistrations ? (
                      <div className="status-banner-info animate-pulse flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Synchronizing with blockchain records...
                      </div>
                    ) : selectedPropertySource === 'registration' && registrations.length === 0 ? (
                      <div className="status-banner-error">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm font-medium">No approved registrations found.</span>
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => navigate('/register')}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Register Property
                          </Button>
                        </div>
                      </div>
                    ) : selectedPropertySource === 'purchased' && purchasedProperties.length === 0 ? (
                      <div className="status-banner-error">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm font-medium">No purchased properties found in your wallet.</span>
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => navigate('/properties')}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Explore Marketplace
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-900 ml-1">
                          {selectedPropertySource === 'registration' ? 'Available Registered Properties' : 'Available Purchased Properties'}
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(selectedPropertySource === 'registration' ? registrations : purchasedProperties).map((item) => {
                            const isRegistration = selectedPropertySource === 'registration';
                            const id = isRegistration ? item.id : item.id;
                            const uniqueKey = `${isRegistration ? 'reg' : 'pur'}-${id}`;
                            const isSelected = selectedRegistrationId === id;
                            const title = isRegistration ? (item.property_description || 'Registered Property') : item.title;
                            const subtitle = isRegistration ? item.property_address : item.location;
                            const type = isRegistration ? (item.property_type || 'property') : 'Purchased';
                            
                            return (
                              <div 
                                key={uniqueKey}
                                onClick={() => handleRegistrationChange(isSelected ? '' : id)}
                                className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 relative overflow-hidden ${
                                  isSelected 
                                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary' 
                                    : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50/50'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[100%] transition-all" />
                                )}
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isSelected ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                                    {type}
                                  </span>
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    )}
                                  </div>
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1 relative z-10" title={title}>{title}</h4>
                                <p className="text-[11px] text-gray-500 line-clamp-2 relative z-10" title={subtitle}>{subtitle}</p>
                              </div>
                            );
                          })}
                        </div>
                        {formErrors.registrationId && (
                          <p className="mt-2 text-sm text-error ml-1">{formErrors.registrationId}</p>
                        )}
                        {!formErrors.registrationId && (
                          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                            <svg className="w-4 h-4 text-primary opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>Details will be auto-synchronized from your {selectedPropertySource === 'registration' ? 'legal records' : 'blockchain ownership'}.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Smart Contract & Storage Status (Collapsible/Premium) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`status-banner-${(isFreighterInstalled && walletAddress && isTestnet) ? 'success' : 'info'}`}>
                    <div className="flex items-center gap-3 mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <h3 className="text-sm font-bold">Stellar Blockchain</h3>
                    </div>
                    <p className="text-xs opacity-90 mb-3">Permanent, verifiable ownership record.</p>
                    {isFreighterInstalled && walletAddress && isTestnet ? (
                      <div className="flex items-center text-[10px] font-bold tracking-wider uppercase bg-white/40 px-2 py-1 rounded w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        On-Chain Ready
                      </div>
                    ) : (
                      <div className="flex items-center text-[10px] font-bold tracking-wider uppercase bg-white/40 px-2 py-1 rounded w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                        Action Required
                      </div>
                    )}
                  </div>

                  <div className="status-banner-info">
                    <div className="flex items-center gap-3 mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="text-sm font-bold">IPFS Persistence</h3>
                    </div>
                    <p className="text-xs opacity-90 mb-3">Immutable decentralized document storage.</p>
                    <div className="flex items-center text-[10px] font-bold tracking-wider uppercase bg-white/40 px-2 py-1 rounded w-fit text-blue-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span>
                      Server-Side Pinning
                    </div>
                  </div>
                </div>

                <div className={registrations.length === 0 ? 'opacity-50 pointer-events-none' : ''}>
                  <Input
                    label="Property Title"
                    required
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    error={formErrors.title}
                    placeholder="e.g., Beautiful 3 BHK Apartment in Koregaon Park"
                    helperText={!formErrors.title ? "Make it descriptive and appealing (minimum 10 characters)" : undefined}
                    disabled={registrations.length === 0}
                  />
                </div>

                <div className={registrations.length === 0 ? 'opacity-50 pointer-events-none' : ''}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Location"
                      required
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      error={formErrors.location}
                      placeholder="e.g., Koregaon Park, Pune"
                      helperText={!formErrors.location && selectedRegistrationId ? "Auto-filled from registration address. You can edit if needed." : !formErrors.location ? "Enter the area or neighborhood name" : undefined}
                      disabled={registrations.length === 0}
                    />

                    <Input
                      label={formData.listingType 
                        ? 'Sale Price (₹)'
                        : (isEditMode && isPurchasedProperty ? 'Price (₹) (Optional)' : 'Price (₹)')}
                      type="text"
                      inputMode="numeric"
                      required={!!formData.listingType}
                      value={formData.price}
                      onChange={handlePriceChange}
                      error={formErrors.price}
                      placeholder="Enter price (e.g., 5000000)"
                      helperText={!formErrors.price 
                        ? (formData.listingType 
                            ? "Enter the price in INR (e.g., 5000000)"
                            : (isEditMode && isPurchasedProperty 
                                ? "Price is optional when not listing for sale"
                                : "Enter the price in INR (e.g., 5000000)"))
                        : undefined}
                      disabled={registrations.length === 0}
                    />
                    {formData.price && parseFloat(formData.price) > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                        <span className="font-medium">Token Equivalent: </span>
                        <span className="text-primary font-semibold">
                          {inrToTokens(parseFloat(formData.price)).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                        </span>
                      </div>
                    )}
                    <div className="mt-3">
                      <TokenConversionInfo variant="badge" />
                    </div>
                  </div>
                </div>

                <div className={registrations.length === 0 ? 'opacity-50 pointer-events-none' : ''}>
                  <Input
                    label="Full Address"
                    required
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    error={formErrors.address}
                    placeholder="Complete property address"
                    helperText={!formErrors.address && selectedRegistrationId ? "Auto-filled from registration. You can edit if needed." : !formErrors.address ? "Include street, building name, and landmark (minimum 10 characters)" : undefined}
                    disabled={registrations.length === 0}
                  />
                </div>


                <div className={registrations.length === 0 ? 'opacity-50 pointer-events-none' : ''}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select
                      label="Property Type"
                      required
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      error={formErrors.type}
                      options={[
                        { value: '', label: 'Select property type' },
                        { value: 'house', label: 'House' },
                        { value: 'apartment', label: 'Apartment' },
                        { value: 'land', label: 'Land' },
                        { value: 'commercial', label: 'Commercial' },
                      ]}
                      helperText={!formErrors.type && selectedRegistrationId ? "Auto-filled from registration. You can change if needed." : undefined}
                      disabled={registrations.length === 0}
                    />

                    <Input
                      label="Square Feet"
                      type="number"
                      required
                      min="1"
                      value={formData.sqft}
                      onChange={(e) => handleInputChange('sqft', e.target.value)}
                      error={formErrors.sqft}
                      placeholder="Total area in sq ft"
                      helperText={!formErrors.sqft && selectedRegistrationId ? "Auto-filled from registration. You can edit if needed." : !formErrors.sqft ? "Enter the total built-up area in square feet" : undefined}
                      disabled={registrations.length === 0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input
                    label="Bedrooms"
                    type="number"
                    required
                    min="0"
                    value={formData.bedrooms}
                    onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                    error={formErrors.bedrooms}
                    placeholder="0"
                  />

                  <Input
                    label="Bathrooms"
                    type="number"
                    required
                    min="0"
                    value={formData.bathrooms}
                    onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                    error={formErrors.bathrooms}
                    placeholder="0"
                  />

                  <Input
                    label="Year Built (Optional)"
                    type="number"
                    min="1800"
                    max={new Date().getFullYear()}
                    value={formData.yearBuilt}
                    onChange={(e) => handleInputChange('yearBuilt', e.target.value)}
                    placeholder="e.g., 2020"
                  />
                </div>

                <Textarea
                  label="Description (Optional)"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  error={formErrors.description}
                  placeholder="Describe your property in detail..."
                  minRows={6}
                />

                <Input
                  label="Features (comma-separated)"
                  value={formData.features}
                  onChange={(e) => handleInputChange('features', e.target.value)}
                  placeholder="e.g., Swimming Pool, Gym, Parking, Security"
                  helperText="Separate multiple features with commas"
                />

                {/* Ownership History Section */}
                <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Ownership History {isPurchasedProperty && '(Read-Only)'}
                      </label>
                      <p className="text-xs text-gray-600">
                        {isPurchasedProperty 
                          ? 'Ownership history cannot be modified for purchased properties. Historical records are preserved for authenticity.'
                          : 'Add previous owners to show property ownership chain'}
                      </p>
                    </div>
                    {!isPurchasedProperty && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOwnershipRecord}
                        disabled={isLoadingRegistrations || isLoadingProperty}
                      >
                        + Add Owner
                      </Button>
                    )}
                  </div>
                  
                  {isPurchasedProperty && formData.ownershipHistory.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This ownership history is read-only. It shows the complete chain of ownership before you purchased this property. You cannot modify historical records.
                      </p>
                    </div>
                  )}

                  {formData.ownershipHistory.length > 0 && (
                    <div className="space-y-4">
                      {formData.ownershipHistory.map((record, index) => (
                        <div key={index} className={`p-4 bg-white border border-gray-300 rounded ${isPurchasedProperty ? 'opacity-75' : ''}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Owner {index + 1}</h4>
                            {!isPurchasedProperty && (
                              <button
                                type="button"
                                onClick={() => removeOwnershipRecord(index)}
                                className="text-error hover:text-red-700 text-sm"
                                disabled={isLoadingRegistrations || isLoadingProperty}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              label="Owner Name"
                              value={record.owner_name}
                              onChange={(e) => updateOwnershipRecord(index, 'owner_name', e.target.value)}
                              placeholder="Previous owner's name"
                              disabled={isPurchasedProperty || isLoadingRegistrations || isLoadingProperty}
                              readOnly={isPurchasedProperty}
                            />
                            <Select
                              label="Transfer Type"
                              value={record.transfer_type}
                              onChange={(e) => updateOwnershipRecord(index, 'transfer_type', e.target.value)}
                              options={[
                                { value: 'sale', label: 'Sale' },
                                { value: 'inheritance', label: 'Inheritance' },
                                { value: 'gift', label: 'Gift' },
                                { value: 'other', label: 'Other' },
                              ]}
                              disabled={isPurchasedProperty || isLoadingRegistrations || isLoadingProperty}
                            />
                            <Input
                              label="From Date"
                              type="date"
                              value={record.from_date}
                              onChange={(e) => updateOwnershipRecord(index, 'from_date', e.target.value)}
                              disabled={isPurchasedProperty || isLoadingRegistrations || isLoadingProperty}
                              readOnly={isPurchasedProperty}
                            />
                            <Input
                              label="To Date (leave empty if current owner)"
                              type="date"
                              value={record.to_date}
                              onChange={(e) => updateOwnershipRecord(index, 'to_date', e.target.value)}
                              disabled={isPurchasedProperty || isLoadingRegistrations || isLoadingProperty}
                              readOnly={isPurchasedProperty}
                            />
                          </div>
                          <div className="mt-4">
                            <Textarea
                              label="Notes (Optional)"
                              value={record.notes}
                              onChange={(e) => updateOwnershipRecord(index, 'notes', e.target.value)}
                              placeholder="Additional information about this ownership"
                              minRows={2}
                              disabled={isPurchasedProperty || isLoadingRegistrations || isLoadingProperty}
                              readOnly={isPurchasedProperty}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {formData.ownershipHistory.length === 0 && (
                    <p className="text-sm text-gray-600 text-center py-4">
                      No ownership history added. Click "Add Owner" to add previous owners.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="images" className="block text-sm font-medium text-gray-900 mb-2">
                    Property Images (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImages}
                      className="w-full px-4 py-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {uploadingImages && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Uploading images...</span>
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
                      Upload multiple images (JPG, PNG). Max 10MB per file.
                    </p>
                  </div>
                  {formData.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-4">
                      {formData.images.map((image, index) => (
                        <div key={`img-${index}-${image.substring(image.lastIndexOf('/') + 1)}`} className="relative">
                          <img
                            src={image}
                            alt={`Property ${index + 1}`}
                            className="w-full aspect-square object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-400">
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    isLoading={isSubmitting || isLoadingProperty}
                    disabled={(!isEditMode && (registrations.length === 0 || !selectedRegistrationId)) || isLoadingProperty}
                  >
                    {isEditMode ? 'Update Property' : 'List Property'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/dashboard?tab=My Listings')}
                    disabled={isSubmitting || isLoadingProperty}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        </div>
      </Container>
    </Section>
  )
}

export default SellProperty
