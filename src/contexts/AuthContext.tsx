import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } }
    }
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } }
    }
    return await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          display_name: displayName?.trim() || '',
        },
      },
    })
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  const resendConfirmationEmail = async (email: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } }
    }
    return await supabase.auth.resend({
      type: 'signup',
      email,
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resendConfirmationEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}



