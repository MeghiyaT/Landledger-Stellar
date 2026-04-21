import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@clerk/clerk-react'
import { getUserProfile } from '../services/user'

/**
 * Custom hook to auto-fill form fields with user profile information
 * @param {Object} initialFormData - Initial form data object
 * @param {Array} fieldsToFill - Array of field names to auto-fill (e.g., ['name', 'email', 'wallet'])
 * @param {Object} fieldMapping - Optional mapping of form fields to profile fields (e.g., { ownerName: 'name', ownerEmail: 'email' })
 * @returns {Object} - { formData, setFormData, userProfile, isLoading }
 */
const useAutoFillForm = (initialFormData = {}, fieldsToFill = ['name', 'email'], fieldMapping = {}) => {
  const { user, isLoaded } = useUser()
  const [formData, setFormData] = useState(initialFormData)
  const [userProfile, setUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Stabilise array/object references so they don't cause infinite effect loops.
  // Joining the array to a string is safe here because field names are simple strings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFields = useMemo(() => fieldsToFill, [fieldsToFill.join(',')])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableMapping = useMemo(() => fieldMapping, [JSON.stringify(fieldMapping)])

  // Dev-only: warn if caller is passing a new array literal on every render,
  // which would defeat the stabilisation above and trigger repeated fetches.
  // @important Callers must stabilise fieldsToFill with useMemo or a module-level constant.
  useEffect(() => {
    if (import.meta.env.DEV && fieldsToFill.join(',') !== stableFields.join(',')) {
      console.warn(
        '[useAutoFillForm] fieldsToFill reference changed between renders. ' +
        'Wrap it in useMemo or define it outside the component to prevent repeated profile fetches.'
      )
    }
  })

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!isLoaded || !user?.id || stableFields.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        const { data } = await getUserProfile(user.id)
        setUserProfile(data)

        setFormData(prevFormData => {
          const updatedFormData = { ...prevFormData }
          let hasChanges = false

          stableFields.forEach(field => {
            const formField = stableMapping[field] || field

            if (!updatedFormData[formField] || updatedFormData[formField].toString().trim() === '') {
              let value = ''

              switch (field) {
                case 'name':
                case 'ownerName':
                case 'fullName':
                  value = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || ''
                  break

                case 'email':
                case 'ownerEmail':
                  value = user.primaryEmailAddress?.emailAddress || ''
                  break

                case 'wallet':
                case 'walletAddress':
                  value = data?.wallet_address || ''
                  break

                case 'phone':
                case 'ownerPhone':
                  value = data?.phone || ''
                  break

                default:
                  value = data?.[field] || ''
              }

              if (value) {
                updatedFormData[formField] = value
                hasChanges = true
              }
            }
          })

          return hasChanges ? updatedFormData : prevFormData
        })
      } catch (err) {
        console.error('Error loading user profile for auto-fill:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [isLoaded, user, stableFields, stableMapping])

  return { formData, setFormData, userProfile, isLoading }
}

export default useAutoFillForm
