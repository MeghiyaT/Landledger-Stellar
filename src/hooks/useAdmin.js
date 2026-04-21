import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { isAdmin } from '../utils/admin'

const useAdmin = () => {
  const { user, isLoaded } = useUser()
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isLoaded && user?.id) {
        const adminStatus = await isAdmin(user.id)
        setUserIsAdmin(adminStatus)
        setIsChecking(false)
      } else if (isLoaded && !user) {
        setUserIsAdmin(false)
        setIsChecking(false)
      }
    }

    checkAdminStatus()
  }, [isLoaded, user])

  return { isAdmin: userIsAdmin, isChecking }
}

export default useAdmin







