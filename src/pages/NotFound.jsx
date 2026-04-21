import { useNavigate } from 'react-router-dom'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <Section>
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <Card padding="lg">
            <div className="text-6xl font-bold text-primary mb-4">404</div>
            <h1 className="mb-4">Page Not Found</h1>
            <p className="text-body-large text-gray-700 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="primary" onClick={() => navigate('/')}>
                Go Home
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  )
}

export default NotFound

