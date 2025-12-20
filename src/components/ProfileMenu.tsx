import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserProfile, type UserProfile } from '../utils/profile'
import { User, LogOut, ExternalLink } from 'lucide-react'
import { LoginDialog } from './LoginDialog'

export function ProfileMenu() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch profile when user is authenticated
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      setLoading(true)
      const profileData = await getUserProfile(user.id)
      setProfile(profileData)
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const handleSignOut = async () => {
    await signOut()
    setIsMenuOpen(false)
  }

  const getInitials = (email: string | null, displayName: string | null) => {
    if (displayName) {
      const parts = displayName.split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return displayName.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  if (authLoading || loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setIsLoginDialogOpen(true)}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors"
          title="Sign in"
          aria-label="Sign in"
        >
          <User className="w-4 h-4 text-white/80" />
        </button>
        <LoginDialog
          isOpen={isLoginDialogOpen}
          onClose={() => setIsLoginDialogOpen(false)}
        />
      </>
    )
  }

  const profilePictureUrl = profile?.profile_picture_url
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'User'
  const initials = getInitials(profile?.email || null, profile?.display_name || null)
  const profileUrl = `https://tesla-wrap.com/profile/${user.id}`

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 hover:border-tesla-red/50 transition-colors flex items-center justify-center bg-gradient-to-br from-tesla-red to-red-600 flex-shrink-0"
          title={displayName}
        >
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-xs font-medium">{initials}</span>
          )}
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200]">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-tesla-red to-red-600 flex items-center justify-center flex-shrink-0">
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-sm font-medium">{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  {profile?.email && (
                    <p className="text-xs text-white/50 truncate">{profile.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <User className="w-4 h-4 text-tesla-red flex-shrink-0" />
                <span>View Profile</span>
                <ExternalLink className="w-3 h-3 text-white/40 ml-auto" />
              </a>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <LogOut className="w-4 h-4 text-tesla-red flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

