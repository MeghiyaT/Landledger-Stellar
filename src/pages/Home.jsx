import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeaturedProperties } from '../services/properties'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import { PROPERTY_PLACEHOLDER, getSafeImageUrl } from '../utils/placeholders'

const Home = () => {
  const navigate = useNavigate()
  const [searchLocation, setSearchLocation] = useState('')
  const [searchType, setSearchType] = useState('')
  const [searchPrice, setSearchPrice] = useState('')
  const [featuredProperties, setFeaturedProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProperties = async () => {
      setIsLoading(true)
      const { data, error } = await getFeaturedProperties(3)
      if (!error && data) {
        setFeaturedProperties(data)
      }
      setIsLoading(false)
    }
    loadProperties()
  }, [])

  const services = [
    {
      title: 'Land Registration',
      description: 'Complete documentation and legal registration of land properties with government authorities.',
      icon: '📋',
    },
    {
      title: 'Property Verification',
      description: 'Thorough verification of property ownership, boundaries, and legal status.',
      icon: '✅',
    },
    {
      title: 'Documentation Services',
      description: 'Professional preparation and filing of all required property documentation.',
      icon: '📄',
    },
  ]

  const stats = [
    { value: '10,000+', label: 'Properties Registered' },
    { value: '98%', label: 'Client Satisfaction' },
    { value: '15+', label: 'Years Experience' },
    { value: '24/7', label: 'Support Available' },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    navigate('/properties', {
      state: { location: searchLocation, type: searchType, price: searchPrice },
    })
  }

  return (
    <div>
      {/* Hero Section */}
      <Section padding="lg" className="bg-gray-100">
        <Container>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="mb-6">
              Secure your property rights with trusted land registration services
            </h1>
            <p className="text-body-large text-gray-700 mb-8">
              Professional property registration, verification, and documentation services
              to protect your real estate investments.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white rounded shadow-elevated p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Location"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                />
                <Select
                  placeholder="Property Type"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  options={[
                    { value: 'house', label: 'House' },
                    { value: 'apartment', label: 'Apartment' },
                    { value: 'land', label: 'Land' },
                    { value: 'commercial', label: 'Commercial' },
                  ]}
                />
                <Select
                  placeholder="Price Range"
                  value={searchPrice}
                  onChange={(e) => setSearchPrice(e.target.value)}
                  options={[
                    { value: '0-200k', label: 'Under ₹200k' },
                    { value: '200k-400k', label: '₹200k - ₹400k' },
                    { value: '400k-600k', label: '₹400k - ₹600k' },
                    { value: '600k+', label: 'Over ₹600k' },
                  ]}
                />
                <Button type="submit" variant="primary" className="w-full">
                  Search Properties
                </Button>
              </div>
            </form>
          </div>
        </Container>
      </Section>

      {/* Featured Properties */}
      <Section>
        <Container>
          <div className="text-center mb-12">
            <h2 className="mb-4">Featured Properties</h2>
            <p className="text-body-large text-gray-700">
              Explore our curated selection of premium properties
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton height="h-48" className="mb-4" />
                  <Skeleton width="w-3/4" height="h-6" className="mb-2" />
                  <Skeleton width="w-1/2" height="h-4" className="mb-4" />
                  <Skeleton width="w-1/3" height="h-8" />
                </Card>
              ))
            ) : featuredProperties.length > 0 ? (
              featuredProperties.map((property) => (
                <Card
                  key={property.id}
                  hover
                  onClick={() => navigate(`/properties/${property.id}`)}
                  className="overflow-hidden"
                >
                  <div className="aspect-video bg-gray-200 mb-4 rounded overflow-hidden">
                    <img
                      src={getSafeImageUrl(property.images?.[0])}
                      onError={(e) => {
                        e.target.src = PROPERTY_PLACEHOLDER
                      }}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{property.title}</h3>
                  <p className="text-gray-700 mb-4">{property.location}</p>
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-4">
                    <span>{property.bedrooms} Beds</span>
                    <span>{property.bathrooms} Baths</span>
                    <span>{property.sqft?.toLocaleString()} sq ft</span>
                  </div>
                  <p className="text-2xl font-semibold text-primary">
                    ₹{property.price?.toLocaleString()}
                  </p>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-8">
                <p className="text-gray-700">No featured properties available</p>
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => navigate('/properties')}>
              View All Properties
            </Button>
          </div>
        </Container>
      </Section>

      {/* Services */}
      <Section className="bg-gray-100">
        <Container>
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Services</h2>
            <p className="text-body-large text-gray-700">
              Comprehensive real estate and land registration solutions
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card key={index} padding="lg" className="text-center">
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{service.title}</h3>
                <p className="text-gray-700">{service.description}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Trust Indicators */}
      <Section>
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-base text-gray-700">{stat.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </div>
  )
}

export default Home

