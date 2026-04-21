
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'

const About = () => {

  const certifications = [
    'Licensed Real Estate Broker',
    'Certified Property Appraiser',
    'Government-Registered Land Surveyor',
    'Legal Documentation Specialist',
  ]

  return (
    <div>
      {/* Hero Section */}
      <Section className="bg-gray-100">
        <Container>
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="mb-6">About LandLedger</h1>
            <p className="text-body-large text-gray-700">
              We are a trusted partner in real estate and land registration,
              helping property owners secure their rights with professional,
              reliable services.
            </p>
          </div>
        </Container>
      </Section>

      {/* Mission & Values */}
      <Section>
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-6">Our Mission</h2>
              <p className="text-body-large text-gray-700 mb-4">
                To provide accessible, transparent, and reliable land registration
                services that protect property rights and enable confident real
                estate transactions.
              </p>
              <p className="text-gray-700">
                We believe that secure property rights are fundamental to
                economic growth and individual prosperity. Our mission is to make
                the registration process straightforward, efficient, and
                trustworthy for all property owners.
              </p>
            </div>
            <div>
              <h2 className="mb-6">Our Values</h2>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-secondary mr-3 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold mb-1">Integrity</h4>
                    <p className="text-gray-700">
                      We conduct all business with honesty and transparency
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-secondary mr-3 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold mb-1">Excellence</h4>
                    <p className="text-gray-700">
                      We strive for the highest standards in every service we provide
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-secondary mr-3 mt-1 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h4 className="font-semibold mb-1">Client Focus</h4>
                    <p className="text-gray-700">
                      Your success and satisfaction are our top priorities
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      {/* Certifications */}
      <Section>
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center mb-12">Certifications & Licenses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certifications.map((cert, index) => (
                <Card key={index} padding="md">
                  <div className="flex items-center">
                    <svg
                      className="w-6 h-6 text-secondary mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-900">{cert}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </div>
  )
}

export default About

