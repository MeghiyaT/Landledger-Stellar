import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Container from '../components/layout/Container'
import Section from '../components/layout/Section'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'

const VerifyCertificate = () => {
  const { registrationId } = useParams()
  const navigate = useNavigate()
  const [registration, setRegistration] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRegistration = async () => {
      setIsLoading(true)
      try {
        // Public verification doesn't require user_id
        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', registrationId)
          .single()

        if (fetchError || !data) {
          setError('Certificate not found or invalid.')
        } else if (data.status !== 'approved') {
          setError('This registration is not yet approved.')
        } else {
          setRegistration(data)
        }
      } catch (err) {
        console.error('Error verifying certificate:', err)
        setError('An error occurred during verification.')
      } finally {
        setIsLoading(false)
      }
    }

    if (registrationId) {
      fetchRegistration()
    }
  }, [registrationId])

  return (
    <Section className="bg-gray-50 min-h-screen pt-20">
      <Container>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Certificate Verification</h1>
            <p className="text-gray-600 mt-2">Official registry verification service</p>
          </div>

          {isLoading ? (
            <Card padding="lg">
              <Skeleton height="h-8" width="w-3/4" className="mb-4" />
              <Skeleton height="h-4" width="w-1/2" className="mb-6" />
              <div className="space-y-3">
                <Skeleton height="h-4" width="w-full" />
                <Skeleton height="h-4" width="w-full" />
                <Skeleton height="h-4" width="w-full" />
              </div>
            </Card>
          ) : error ? (
            <Card padding="lg" className="text-center border-red-100">
              <div className="status-banner-error mb-6">
                <div className="flex items-center justify-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="font-bold">{error}</p>
                </div>
              </div>
              <Button variant="primary" onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="status-banner-success flex items-center justify-between p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold">Authentic Record</p>
                    <p className="text-xs opacity-90">This certificate is officially registered on LandLedger.</p>
                  </div>
                </div>
                <Badge variant="success" className="uppercase tracking-widest text-[10px]">Verified</Badge>
              </div>

              <Card padding="lg" className="card-pro overflow-hidden">
                <div className="bg-gray-50 -mx-6 -mt-6 p-6 mb-6 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Registration Details</h2>
                  <p className="text-xs font-mono text-gray-400">ID: {registration.id}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Owner Name</p>
                      <p className="text-lg font-bold text-gray-900">{registration.owner_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Property Address</p>
                      <p className="text-gray-700 leading-relaxed">{registration.property_address}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Property Type</p>
                        <p className="font-semibold text-gray-900">{registration.property_type}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Size (Sq Ft)</p>
                        <p className="font-semibold text-gray-900">{registration.property_size || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Registration Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(registration.submitted_date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-dashed border-gray-200">
                  {registration.blockchain_tx_hash ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center text-sm text-blue-600 font-semibold">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Cryptographic Proof Linked
                      </div>
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${registration.blockchain_tx_hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                      >
                        View Receipt on Stellar
                        <svg className="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-gray-500 italic">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Blockchain anchor verification is currently in synchronization. Check back for cryptographic proof.
                    </div>
                  )}
                </div>
              </Card>

              <div className="flex justify-center mt-8">
                <Button variant="outline" onClick={() => navigate('/')}>
                  Return to Marketplace
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </Section>
  )
}

export default VerifyCertificate
