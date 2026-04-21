
/**
 * PropertiesMapView - Shows properties using Google Maps Embed API
 * 
 * Uses the Maps Embed API (free, no billing required) instead of JavaScript API
 * 
 * Usage:
 * import PropertiesMapView from '../components/PropertiesMapView'
 * 
 * <PropertiesMapView 
 *   properties={properties} 
 *   apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
 * />
 */
const PropertiesMapView = ({ 
  properties = [], 
  apiKey,
  className = ''
}) => {
  // Build the embed URL for a single property
  const getEmbedUrl = (property) => {
    if (!apiKey || !property) {
      return null
    }

    const address = property.address || property.location
    if (!address) {
      return null
    }

    const encodedAddress = encodeURIComponent(address)
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15`
  }

  if (!apiKey) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`} style={{ minHeight: '500px' }}>
        <div className="text-center p-6">
          <svg 
            className="w-12 h-12 text-gray-400 mx-auto mb-3" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round"
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
          <p className="text-gray-600 text-sm">Google Maps API key is not configured</p>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`} style={{ minHeight: '500px' }}>
        <div className="text-center p-6">
          <svg 
            className="w-12 h-12 text-gray-400 mx-auto mb-3" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round"
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
          <p className="text-gray-600 text-sm">No properties to display</p>
        </div>
      </div>
    )
  }

  // Single property view - show full map
  if (properties.length === 1) {
    const embedUrl = getEmbedUrl(properties[0])
    
    if (!embedUrl) {
      return (
        <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`} style={{ minHeight: '500px' }}>
          <div className="text-center p-6">
            <p className="text-gray-600 text-sm">Unable to generate map URL</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`relative ${className}`} style={{ height: '100%', width: '100%' }}>
        <iframe
          width="100%"
          height="100%"
          style={{
            border: 0,
            borderRadius: '8px',
            minHeight: '500px'
          }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={`Property Map: ${properties[0].title}`}
        />
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2">
          <p className="text-sm font-semibold text-gray-700">{properties[0].title}</p>
          <p className="text-xs text-gray-500">{properties[0].location}</p>
        </div>
      </div>
    )
  }

  // Multiple properties - show grid of maps
  return (
    <div className={className} style={{ height: '100%', width: '100%' }}>
      <div className="mb-4 bg-white rounded-lg shadow-lg px-4 py-2 inline-block">
        <p className="text-sm font-semibold text-gray-700">
          {properties.length} Properties
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ minHeight: '500px' }}>
        {properties.map((property) => {
          const embedUrl = getEmbedUrl(property)
          
          if (!embedUrl) {
            return (
              <div key={property.id} className="bg-gray-100 rounded flex items-center justify-center" style={{ minHeight: '300px' }}>
                <p className="text-gray-600 text-sm text-center px-4">
                  {property.location || 'Location not available'}
                </p>
              </div>
            )
          }

          return (
            <div key={property.id} className="relative bg-white rounded-lg shadow-md overflow-hidden" style={{ minHeight: '300px' }}>
              <iframe
                width="100%"
                height="100%"
                style={{
                  border: 0,
                  minHeight: '300px'
                }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={embedUrl}
                title={`Property Map: ${property.title}`}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-3">
                <p className="text-sm font-semibold truncate">{property.title}</p>
                <p className="text-xs text-gray-300 truncate">{property.location}</p>
                <p className="text-xs font-semibold mt-1">₹{property.price?.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PropertiesMapView
