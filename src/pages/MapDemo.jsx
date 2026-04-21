
import MapComponent from '../components/MapComponent'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'

/**
 * MapDemo - A demo page to test Google Maps integration
 * This component can be used for testing or removed in production
 * 
 * To use: Add route in App.jsx: <Route path="/map-demo" element={<MapDemo />} />
 */
const MapDemo = () => {
  const demoLocations = [
    {
      name: 'Koregaon Park, Pune',
      address: 'Koregaon Park, Pune, Maharashtra 411001',
      lat: 18.5362,
      lng: 73.8958
    },
    {
      name: 'Hinjewadi IT Park',
      address: 'Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057',
      lat: 18.5912,
      lng: 73.7389
    },
    {
      name: 'Shivajinagar',
      address: 'Shivajinagar, Pune, Maharashtra 411005',
      lat: 18.5304,
      lng: 73.8443
    }
  ]

  return (
    <Section>
      <Container>
        <div className="mb-8">
          <h1 className="mb-4">Google Maps Integration Demo</h1>
          <p className="text-body-large text-gray-700">
            This page demonstrates the MapComponent with different locations in Pune.
          </p>
        </div>

        <div className="space-y-8">
          {demoLocations.map((location, index) => (
            <Card key={index} padding="md">
              <h3 className="text-xl font-semibold mb-4">{location.name}</h3>
              <p className="text-gray-700 mb-4">{location.address}</p>
              <MapComponent
                address={location.address}
                lat={location.lat}
                lng={location.lng}
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                zoom={15}
                className="aspect-video"
              />
            </Card>
          ))}

          {/* Example with just address (geocoding) */}
          <Card padding="md">
            <h3 className="text-xl font-semibold mb-4">Geocoding Example</h3>
            <p className="text-gray-700 mb-4">
              This map uses only the address - coordinates are obtained via geocoding
            </p>
            <MapComponent
              address="FC Road, Deccan Gymkhana, Pune, Maharashtra"
              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
              zoom={16}
              className="aspect-video"
            />
          </Card>

          {/* Different zoom levels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="md">
              <h3 className="text-lg font-semibold mb-4">Zoom Level 12 (City View)</h3>
              <MapComponent
                address="Pune, Maharashtra"
                lat={18.5204}
                lng={73.8567}
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                zoom={12}
                className="aspect-video"
              />
            </Card>
            <Card padding="md">
              <h3 className="text-lg font-semibold mb-4">Zoom Level 18 (Street View)</h3>
              <MapComponent
                address="Aga Khan Palace, Pune"
                lat={18.5511}
                lng={73.9045}
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                zoom={18}
                className="aspect-video"
              />
            </Card>
          </div>
        </div>

        <Card padding="md" className="mt-8 bg-blue-50 border border-blue-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-900">
            💡 Implementation Notes
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Maps automatically geocode addresses if coordinates aren't provided</li>
            <li>• Zoom levels range from 1 (world) to 20 (building)</li>
            <li>• Markers are clickable and show info windows</li>
            <li>• Maps are fully interactive with pan, zoom, and street view</li>
            <li>• The component handles loading and error states gracefully</li>
          </ul>
        </Card>
      </Container>
    </Section>
  )
}

export default MapDemo








