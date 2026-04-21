import { createContext, useContext } from 'react'
const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const value = {
    user: null,
    loading: false,
    signUp: async () => ({ data: null, error: new Error('Use Clerk for sign up') }),
    signIn: async () => ({ data: null, error: new Error('Use Clerk for sign in') }),
    signOut: async () => ({ error: new Error('Use Clerk for sign out') }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}









