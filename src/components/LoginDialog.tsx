import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { checkUsernameAvailable, checkEmailAvailable } from '../utils/validation'
import { supabase } from '../lib/supabase'
import { X, Mail, Lock, AlertCircle, User as UserIcon, CheckCircle2, Loader2 } from 'lucide-react'

interface LoginDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LoginDialog({ isOpen, onClose, onSuccess }: LoginDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [checkingConfirmation, setCheckingConfirmation] = useState(false)
  const { signIn, signUp } = useAuth()

  if (!isOpen) return null

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading('email')

    // Signup validations (match Gallery behavior)
    if (mode === 'signup') {
      if (!username.trim()) {
        setError('Username is required')
        setLoading(null)
        return
      }
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters')
        setLoading(null)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(null)
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(null)
        return
      }

      // Check if username is already taken
      setLoading('checking-username')
      const usernameCheck = await checkUsernameAvailable(username.trim())
      if (!usernameCheck.available) {
        setError(usernameCheck.error || 'Username is already taken')
        setLoading(null)
        return
      }

      // Check if email is already registered
      setLoading('checking-email')
      const emailCheck = await checkEmailAvailable(email.trim())
      if (!emailCheck.available) {
        setError(emailCheck.error || 'Email is already registered')
        setLoading(null)
        return
      }
    }

    try {
      if (mode === 'login') {
        const result = await signIn(email, password)
        if (result.error) {
          setError(result.error.message || 'Authentication failed')
          setLoading(null)
        } else {
          setLoading(null)
          onSuccess?.()
          onClose()
        }
      } else {
        // Signup
        setLoading('signup')
        const result = await signUp(email, password, username)
        if (result.error) {
          // Handle specific Supabase errors
          const errorMessage = result.error.message || 'Authentication failed'
          if (errorMessage.includes('already registered') || errorMessage.includes('User already registered')) {
            setError('Email is already registered')
          } else if (errorMessage.includes('email')) {
            setError('This email address is already in use')
          } else {
            setError(errorMessage)
          }
          setLoading(null)
        } else {
          setLoading(null)
          // Show success message - user needs to confirm email via link
          setSignupSuccess(true)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden relative z-[10000]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-1">
              {mode === 'login' ? 'Welcome back' : 'Join the community'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {signupSuccess ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
                  <p className="text-white/60 text-sm">
                    We&apos;ve sent a confirmation email to
                  </p>
                  <p className="text-tesla-red font-medium mt-1">{email}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="text-white font-medium">Please check your email</p>
                    <p className="text-white/70">
                      Click the confirmation link in the email to activate your account. 
                      Once confirmed, click Continue to proceed.
                    </p>
                    <p className="text-white/50 text-xs">
                      Don&apos;t forget to check your spam/junk folder if you don&apos;t see it.
                    </p>
                  </div>
                </div>
              </div>

              {error && !checkingConfirmation && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {checkingConfirmation && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                  <p>Checking email confirmation status...</p>
                </div>
              )}

              <button
                onClick={async () => {
                  if (!supabase) {
                    setError('Supabase not configured')
                    return
                  }

                  setCheckingConfirmation(true)
                  setError(null)

                  // Minimum display time for better UX (500ms)
                  const minDisplayTime = new Promise(resolve => setTimeout(resolve, 500))

                  try {
                    // Try signing in with the signup credentials. If email is confirmed,
                    // signIn returns a session in the response. Use that directly to avoid
                    // timing issues with getSession().
                    const signInResult = await signIn(email, password)

                    await minDisplayTime

                    if (!signInResult.error) {
                      const directSessionUser = (signInResult as any)?.data?.session?.user
                      if (directSessionUser) {
                        setSignupSuccess(false)
                        onSuccess?.()
                        onClose()
                        return
                      }

                      // Fallback: check current session (in case the client stored it)
                      const sessionCheck = await supabase.auth.getSession()
                      if (sessionCheck.data.session?.user) {
                        setSignupSuccess(false)
                        onSuccess?.()
                        onClose()
                        return
                      }

                      // Wait briefly and retry once
                      await new Promise((resolve) => setTimeout(resolve, 700))
                      const retrySession = await supabase.auth.getSession()
                      if (retrySession.data.session?.user) {
                        setSignupSuccess(false)
                        onSuccess?.()
                        onClose()
                        return
                      }

                      setError('Signed in, but session not ready yet. Please try again.')
                      setCheckingConfirmation(false)
                    } else {
                      const msg = signInResult.error.message || 'Email not confirmed yet. Please confirm and try again.'
                      setError(msg)
                      setCheckingConfirmation(false)
                    }
                  } catch (err: any) {
                    await minDisplayTime // Ensure minimum display time even on error
                    setError(err.message || 'Failed to check email confirmation')
                    setCheckingConfirmation(false)
                  }
                }}
                disabled={checkingConfirmation}
                className="w-full px-4 py-3 bg-tesla-red hover:bg-tesla-red/80 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkingConfirmation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          ) : (
            <>
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={!!loading}
                  className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-2">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your display name"
                    required
                    disabled={!!loading}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                  placeholder="••••••••"
                  disabled={!!loading}
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-white/70 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-tesla-red/50 focus:border-transparent"
                    placeholder="••••••••"
                    disabled={!!loading}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!!loading}
              className="w-full px-4 py-3 bg-tesla-red hover:bg-tesla-red/80 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {loading === 'checking-username' ? 'Checking username...' :
                     loading === 'checking-email' ? 'Checking email...' :
                     loading === 'signup' ? 'Creating account...' :
                     'Please wait...'}
                  </span>
                </div>
              ) : (
                mode === 'login' ? 'Sign In' : 'Sign Up'
              )}
            </button>
          </form>

          {/* Social auth removed (not implemented yet) */}

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
              }}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

