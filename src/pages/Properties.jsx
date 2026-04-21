import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { getProperties } from '../services/properties'
import { saveProperty, removeSavedProperty, getSavedProperties } from '../services/user'
import { useToast } from '../hooks/useToast'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import ComparePropertiesModal from '../components/ComparePropertiesModal'
import { PROPERTY_PLACEHOLDER, getSafeImageUrl } from '../utils/placeholders'
import BlockchainBadge from '../components/BlockchainBadge'

const STORAGE_KEY = 'property_search_preferences'

const Properties = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUser()
  const { success, error } = useToast()
  
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid') // 'grid', 'list'
  const [listingType, setListingType] = useState('for_sale')
  const [sortBy, setSortBy] = useState('newest')
  const [filters, setFilters] = useState({
    location: location.state?.location || '',
    type: location.state?.type || '',
    price: location.state?.price || '',
    bedrooms: '',
    bathrooms: '',
    listingType: 'for_sale',
  })
  const [properties, setProperties] = useState([])
  const [savedPropertyIds, setSavedPropertyIds] = useState(new Set())
  const [comparedProperties, setComparedProperties] = useState([])
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)

  // Load saved search preferences
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const preferences = JSON.parse(saved)
        setFilters(prev => ({ ...prev, ...preferences }))
        if (preferences.listingType) setListingType(preferences.listingType)
        if (preferences.sortBy) setSortBy(preferences.sortBy)
        if (preferences.viewMode) setViewMode(preferences.viewMode)
      } catch (err) {
        console.error('Error loading saved preferences:', err)
      }
    }
  }, [])

  // Save search preferences
  useEffect(() => {
    const preferences = {
      ...filters,
      listingType,
      sortBy,
      viewMode,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [filters, listingType, sortBy, viewMode])

  // Load saved properties
  useEffect(() => {
    const loadSavedProperties = async () => {
      if (user?.id) {
        const { data } = await getSavedProperties(user.id)
        if (data) {
          const savedIds = new Set(data.map(item => item.property_id))
          setSavedPropertyIds(savedIds)
        }
      }
    }
    loadSavedProperties()
  }, [user?.id])

  // Load properties
  useEffect(() => {
    const loadProperties = async () => {
      setIsLoading(true)
      const filtersWithListingType = { ...filters, listingType, sortBy }
      const { data, error } = await getProperties(filtersWithListingType)
      if (!error && data) {
        setProperties(data)
      } else {
        setProperties([])
      }
      setIsLoading(false)
    }
    loadProperties()
  }, [filters, listingType, sortBy])

  // Refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const loadProperties = async () => {
          const filtersWithListingType = { ...filters, listingType, sortBy }
          const { data, error } = await getProperties(filtersWithListingType)
          if (!error && data) {
            setProperties(data)
          }
        }
        loadProperties()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [filters, listingType, sortBy])

  // Check if property is new (created within last 24 hours)
  const isNewProperty = (createdAt) => {
    if (!createdAt) return false
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    return new Date(createdAt) > twentyFourHoursAgo
  }

  // Toggle save property
  const handleSaveProperty = async (e, propertyId) => {
    e.stopPropagation()
    
    if (!user?.id) {
      error('Please log in to save properties')
      return
    }

    const isSaved = savedPropertyIds.has(propertyId)
    
    try {
      if (isSaved) {
        const { error: removeError } = await removeSavedProperty(user.id, propertyId)
        if (!removeError) {
          setSavedPropertyIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(propertyId)
            return newSet
          })
          success('Property removed from saved list')
        } else {
          error('Failed to remove property')
        }
      } else {
        const { error: saveError } = await saveProperty(user.id, propertyId)
        if (!saveError) {
          setSavedPropertyIds(prev => new Set(prev).add(propertyId))
          success('Property saved successfully!')
        } else {
          error('Failed to save property')
        }
      }
    } catch (err) {
      console.error('Error saving property:', err)
      error('An error occurred. Please try again.')
    }
  }

  // Toggle compare property
  const handleCompareProperty = (e, property) => {
    e.stopPropagation()
    
    const isComparing = comparedProperties.some(p => p.id === property.id)
    
    if (isComparing) {
      setComparedProperties(prev => prev.filter(p => p.id !== property.id))
    } else {
      if (comparedProperties.length >= 3) {
        error('You can compare up to 3 properties at a time')
        return
      }
      setComparedProperties(prev => [...prev, property])
      success('Property added to comparison')
    }
  }

  const PropertyCard = ({ property }) => {
    const isSaved = savedPropertyIds.has(property.id)
    const isComparing = comparedProperties.some(p => p.id === property.id)
    const isNew = isNewProperty(property.created_at)
    const isOwner = user?.id && property.user_id === user.id

    return (
      <Card
        hover
        onClick={() => navigate(`/properties/${property.id}`)}
        className="overflow-hidden relative"
      >
        <div className="aspect-video bg-gray-200 mb-4 rounded overflow-hidden relative">
          <img
            src={getSafeImageUrl(property.images?.[0])}
            onError={(e) => {
              e.target.src = PROPERTY_PLACEHOLDER
            }}
            alt={property.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            {isNew && (
              <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                New
              </span>
            )}
            {property.featured && (
              <span className="bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
                Featured
              </span>
            )}
          </div>
          <button
            onClick={(e) => handleSaveProperty(e, property.id)}
            className={`absolute top-2 left-2 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors ${
              isSaved ? 'text-red-500' : 'text-gray-600'
            }`}
            aria-label={isSaved ? 'Remove from saved' : 'Save property'}
          >
            <svg
              className="w-5 h-5"
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => handleCompareProperty(e, property)}
            className={`absolute bottom-2 right-2 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors ${
              isComparing ? 'text-blue-500' : 'text-gray-600'
            }`}
            aria-label={isComparing ? 'Remove from comparison' : 'Add to comparison'}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">{property.title}</h3>
          <BlockchainBadge property={property} />
        </div>
        <p className="text-gray-700 mb-4">{property.location}</p>
        <div className="flex items-center justify-between text-sm text-gray-700 mb-4">
          <span>{property.bedrooms} Beds</span>
          <span>{property.bathrooms} Baths</span>
          <span>{property.sqft?.toLocaleString()} sq ft</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-2xl font-semibold text-primary">
            ₹{property.price?.toLocaleString()}
          </p>
          {property.listing_type === 'for_rent' && (
            <span className="text-sm text-gray-700">/month</span>
          )}
        </div>
        {!isOwner && (
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/properties/${property.id}`, { state: { scrollToContact: true } })
            }}
          >
            Contact Owner
          </Button>
        )}
      </Card>
    )
  }

  const PropertyListItem = ({ property }) => {
    const isSaved = savedPropertyIds.has(property.id)
    const isComparing = comparedProperties.some(p => p.id === property.id)
    const isNew = isNewProperty(property.created_at)
    const isOwner = user?.id && property.user_id === user.id

    return (
      <Card
        hover
        onClick={() => navigate(`/properties/${property.id}`)}
        className="overflow-hidden relative"
      >
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-64 aspect-video md:aspect-auto bg-gray-200 rounded overflow-hidden flex-shrink-0 relative">
            <img
              src={getSafeImageUrl(property.images?.[0])}
              onError={(e) => {
                e.target.src = PROPERTY_PLACEHOLDER
              }}
              alt={property.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              {isNew && (
                <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                  New
                </span>
              )}
              {property.featured && (
                <span className="bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
                  Featured
                </span>
              )}
            </div>
          </div>
          <div className="flex-grow">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-semibold">{property.title}</h3>
              <div className="flex gap-2">
                <button
                  onClick={(e) => handleSaveProperty(e, property.id)}
                  className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                    isSaved ? 'text-red-500' : 'text-gray-600'
                  }`}
                  aria-label={isSaved ? 'Remove from saved' : 'Save property'}
                >
                  <svg
                    className="w-5 h-5"
                    fill={isSaved ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleCompareProperty(e, property)}
                  className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                    isComparing ? 'text-blue-500' : 'text-gray-600'
                  }`}
                  aria-label={isComparing ? 'Remove from comparison' : 'Add to comparison'}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-gray-700 mb-4">{property.location}</p>
            <div className="flex items-center gap-6 text-sm text-gray-700 mb-4">
              <span>{property.bedrooms} Beds</span>
              <span>{property.bathrooms} Baths</span>
              <span>{property.sqft?.toLocaleString()} sq ft</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold text-primary">
                  ₹{property.price?.toLocaleString()}
                </p>
                {property.listing_type === 'for_rent' && (
                  <span className="text-sm text-gray-700">/month</span>
                )}
              </div>
            </div>
            {!isOwner && (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/properties/${property.id}`, { state: { scrollToContact: true } })
                }}
              >
                Contact Owner
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Section>
      <Container>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="mb-2">Property Listings</h1>
              <p className="text-body-large text-gray-700">
                Find your perfect property from our extensive collection
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/sell-property')}
            >
              List Your Property
            </Button>
          </div>

          {/* Sale/Rent Tabs */}
          <div className="flex gap-2 border-b border-gray-300 mb-6">
            <button
              onClick={() => setListingType('for_sale')}
              className={`px-6 py-3 font-medium transition-colors duration-200 border-b-2 ${
                listingType === 'for_sale'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-700 hover:text-primary'
              }`}
            >
              For Sale
            </button>
            <button
              onClick={() => setListingType('for_rent')}
              className={`px-6 py-3 font-medium transition-colors duration-200 border-b-2 ${
                listingType === 'for_rent'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-700 hover:text-primary'
              }`}
            >
              For Rent
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <Card padding="md">
              <h3 className="text-lg font-semibold mb-6">Filters</h3>
              <div className="space-y-4">
                <Input
                  label="Location"
                  placeholder="Enter location"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                />
                <Select
                  label="Property Type"
                  placeholder="All Types"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  options={[
                    { value: '', label: 'All Types' },
                    { value: 'house', label: 'House' },
                    { value: 'apartment', label: 'Apartment' },
                    { value: 'land', label: 'Land' },
                    { value: 'commercial', label: 'Commercial' },
                  ]}
                />
                <Select
                  label="Price Range"
                  placeholder="All Prices"
                  value={filters.price}
                  onChange={(e) => setFilters({ ...filters, price: e.target.value })}
                  options={[
                    { value: '', label: 'All Prices' },
                    { value: '0-200k', label: 'Under ₹200k' },
                    { value: '200k-400k', label: '₹200k - ₹400k' },
                    { value: '400k-600k', label: '₹400k - ₹600k' },
                    { value: '600k+', label: 'Over ₹600k' },
                  ]}
                />
                <Select
                  label="Bedrooms"
                  placeholder="Any"
                  value={filters.bedrooms}
                  onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
                  options={[
                    { value: '', label: 'Any' },
                    { value: '1', label: '1+' },
                    { value: '2', label: '2+' },
                    { value: '3', label: '3+' },
                    { value: '4', label: '4+' },
                  ]}
                />
                <Button 
                  variant="primary" 
                  className="w-full" 
                  onClick={() => {
                    const loadProperties = async () => {
                      setIsLoading(true)
                      const filtersWithListingType = { ...filters, listingType, sortBy }
                      const { data, error } = await getProperties(filtersWithListingType)
                      if (!error && data) {
                        setProperties(data)
                      } else {
                        setProperties([])
                      }
                      setIsLoading(false)
                    }
                    loadProperties()
                  }}
                >
                  Apply Filters
                </Button>
              </div>
            </Card>
          </aside>

          {/* Properties List/Map */}
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <p className="text-gray-700">
                  {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
                </p>
                {comparedProperties.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCompareModalOpen(true)}
                  >
                    Compare ({comparedProperties.length})
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'newest', label: 'Newest' },
                    { value: 'price_asc', label: 'Price: Low to High' },
                    { value: 'price_desc', label: 'Price: High to Low' },
                    { value: 'featured', label: 'Featured' },
                  ]}
                  className="w-48"
                />
                <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors duration-200 ${
                      viewMode === 'grid'
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label="Grid view"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-colors duration-200 ${
                      viewMode === 'list'
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label="List view"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} padding="md">
                    <Skeleton height="h-48" className="mb-4" />
                    <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                    <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                    <Skeleton width="w-1/3" height="h-8" />
                  </Card>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <Card padding="lg" className="text-center">
                <p className="text-lg text-gray-700 mb-4">No properties found</p>
                <p className="text-gray-700 mb-6">
                  Try adjusting your filters to see more results.
                </p>
                <Button variant="outline" onClick={() => setFilters({
                  location: '',
                  type: '',
                  price: '',
                  bedrooms: '',
                  bathrooms: '',
                })}>
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}>
                {properties.map((property) =>
                  viewMode === 'grid' ? (
                    <PropertyCard key={property.id} property={property} />
                  ) : (
                    <PropertyListItem key={property.id} property={property} />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compare Modal */}
        <ComparePropertiesModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          properties={comparedProperties}
          onRemove={(propertyId) => {
            setComparedProperties(prev => prev.filter(p => p.id !== propertyId))
          }}
        />
      </Container>
    </Section>
  )
}

export default Properties
