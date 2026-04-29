import { SignUp, useUser, useClerk } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

const Register = () => {
  const navigate = useNavigate()
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()

  const handleSignOut = async () => {
    await signOut()
    // Force a page reload to clear all Clerk state
    window.location.href = '/register'
  }

  // Show message with sign out option if already signed in
  if (isSignedIn) {
    return (
      <Section>
        <Container>
          <div className="max-w-md mx-auto">
            <Card padding="lg">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-4">Already Signed In</h2>
                <p className="text-gray-700 mb-2">
                  You're currently signed in as:
                </p>
                <p className="font-semibold text-primary mb-6">
                  {user?.primaryEmailAddress?.emailAddress || user?.username}
                </p>
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => navigate('/')}
                  >
                    Go to Homepage
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSignOut}
                  >
                    Sign Out & Create New Account
                  </Button>
                </div>
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
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="mb-4">Create Account</h1>
            <p className="text-body-large text-gray-700">
              Register to start managing your properties
            </p>
          </div>
          <div className="flex justify-center">
            <SignUp
              routing="path"
              path="/register"
              signInUrl="/login"
              forceRedirectUrl="/"
              appearance={{
                elements: {
                  rootBox: 'mx-auto',
                  card: 'shadow-elevated',
                },
              }}
            />
          </div>
        </div>
      </Container>
    </Section>
  )
}

export default Register
