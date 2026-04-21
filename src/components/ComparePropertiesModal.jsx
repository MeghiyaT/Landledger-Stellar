import PropTypes from 'prop-types'
import Modal from './ui/Modal'
import { PROPERTY_PLACEHOLDER, getSafeImageUrl } from '../utils/placeholders'

const ComparePropertiesModal = ({ isOpen, onClose, properties, onRemove }) => {
  if (properties.length === 0) return null

  const getValue = (property, field) => {
    if (field === 'price') {
      return property.price ? `₹${property.price.toLocaleString()}` : 'N/A'
    }
    if (field === 'bedrooms') return property.bedrooms || 0
    if (field === 'bathrooms') return property.bathrooms || 0
    if (field === 'sqft') return property.sqft ? `${property.sqft.toLocaleString()} sq ft` : 'N/A'
    if (field === 'type') {
      const typeMap = {
        house: 'House',
        apartment: 'Apartment',
        land: 'Land',
        commercial: 'Commercial'
      }
      return typeMap[property.type] || property.type
    }
    if (field === 'location') return property.location || 'N/A'
    if (field === 'features') {
      return property.features && property.features.length > 0
        ? property.features.join(', ')
        : 'No features listed'
    }
    return property[field] || 'N/A'
  }

  const comparisonFields = [
    { key: 'price', label: 'Price' },
    { key: 'type', label: 'Type' },
    { key: 'location', label: 'Location' },
    { key: 'bedrooms', label: 'Bedrooms' },
    { key: 'bathrooms', label: 'Bathrooms' },
    { key: 'sqft', label: 'Size' },
    { key: 'features', label: 'Features' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Compare Properties (${properties.length}/3)`} size="xl">
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-4 border-b border-gray-300 font-semibold text-gray-700 min-w-[150px] sticky left-0 bg-white z-10">
                Property
              </th>
              {properties.map((property) => (
                <th key={property.id} className="p-4 border-b border-gray-300 relative min-w-[200px]">
                  <button
                    onClick={() => onRemove(property.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors text-sm z-20"
                    aria-label="Remove from comparison"
                  >
                    ×
                  </button>
                  <div className="aspect-video bg-gray-200 rounded mb-2 overflow-hidden">
                    <img
                      src={getSafeImageUrl(property.images?.[0])}
                      alt={property.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = PROPERTY_PLACEHOLDER
                      }}
                    />
                  </div>
                  <h3 className="font-semibold text-sm mt-2 line-clamp-2">{property.title}</h3>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonFields.map((field) => (
              <tr key={field.key}>
                <td className="font-semibold text-gray-700 py-3 px-4 border-b border-gray-200 bg-gray-50 sticky left-0 z-10">
                  {field.label}
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="py-3 px-4 border-b border-gray-200 text-sm min-w-[200px]">
                    {getValue(property, field.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {properties.length < 3 && (
        <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
          Select up to 3 properties to compare. Currently comparing {properties.length} {properties.length === 1 ? 'property' : 'properties'}.
        </div>
      )}
    </Modal>
  )
}

ComparePropertiesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  properties: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      price: PropTypes.number,
      type: PropTypes.string,
      location: PropTypes.string,
      bedrooms: PropTypes.number,
      bathrooms: PropTypes.number,
      sqft: PropTypes.number,
      features: PropTypes.arrayOf(PropTypes.string),
      images: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
}

export default ComparePropertiesModal
