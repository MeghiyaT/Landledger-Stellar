
/**
 * MapComponent - A Google Maps component using the FREE Embed API
 * 
 * The Maps Embed API is free and doesn't require billing!
 * 
 * @param {Object} props
 * @param {string} props.address - Property address to display on map
 * @param {number} props.lat - Latitude coordinate (optional)
 * @param {number} props.lng - Longitude coordinate (optional)
 * @param {number} props.zoom - Map zoom level (default: 15)
 * @param {string} props.apiKey - Google Maps API key
 * @param {string} props.className - Additional CSS classes
 */
const MapComponent = ({ 
  address, 
  lat, 
  lng, 
  zoom = 15, 
  apiKey,
  className = ''
}) => {
  // Build the embed URL
  const getEmbedUrl = () => {
    if (!apiKey) {
      return null
    }

    // If coordinates are provided, use them
    if (lat && lng) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=${zoom}`
    }

    // Otherwise use the address
    if (address) {
      // URL encode the address
      const encodedAddress = encodeURIComponent(address)
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=${zoom}`
    }

    return null
  }

  const embedUrl = getEmbedUrl()

  if (!apiKey) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`}>
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

  if (!address && !(lat && lng)) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`}>
        <div className="text-center p-6">
          <p className="text-gray-600 text-sm">Address or coordinates are required</p>
        </div>
      </div>
    )
  }

  if (!embedUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`}>
        <div className="text-center p-6">
          <p className="text-gray-600 text-sm">Unable to generate map URL</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full ${className}`} style={{ minHeight: '400px' }}>
      <iframe
        width="100%"
        height="100%"
        style={{
          border: 0,
          borderRadius: '8px',
          minHeight: '400px'
        }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
        title="Property Location Map"
      />
    </div>
  )
}

export default MapComponent
