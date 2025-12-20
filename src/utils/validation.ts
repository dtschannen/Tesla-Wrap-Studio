import { supabase } from '../lib/supabase'

/**
 * Check if a username (display_name) is already taken
 * Uses secure database function that doesn't expose user data
 */
export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; error?: string }> {
  if (!supabase) {
    return { available: false, error: 'Supabase not configured' }
  }

  try {
    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      return { available: false, error: 'Username cannot be empty' }
    }
    
    // Use secure database function that only returns boolean
    // This doesn't expose any user data
    const { data, error } = await supabase.rpc('check_username_available', {
      check_username: trimmedUsername
    })

    if (error) {
      console.error('Error checking username:', error)
      return { available: false, error: 'Failed to check username availability' }
    }

    // Function returns true if available, false if taken
    const isAvailable = data === true

    if (!isAvailable) {
      return { available: false, error: 'Username is already taken' }
    }

    return { available: true }
  } catch (err: any) {
    console.error('Error checking username:', err)
    return { available: false, error: 'Failed to check username availability' }
  }
}

/**
 * Check if an email is already registered
 * Note: Supabase auth.users will also prevent duplicates, but we check profiles for better UX
 * Uses secure database function that doesn't expose user data
 */
export async function checkEmailAvailable(email: string): Promise<{ available: boolean; error?: string }> {
  if (!supabase) {
    return { available: false, error: 'Supabase not configured' }
  }

  try {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      return { available: false, error: 'Email cannot be empty' }
    }
    
    // Use secure database function that only returns boolean
    // This doesn't expose any user data
    const { data, error } = await supabase.rpc('check_email_available', {
      check_email: normalizedEmail
    })

    if (error) {
      console.error('Error checking email:', error)
      return { available: false, error: 'Failed to check email availability' }
    }

    // Function returns true if available, false if taken
    const isAvailable = data === true

    if (!isAvailable) {
      return { available: false, error: 'Email is already registered' }
    }

    return { available: true }
  } catch (err: any) {
    console.error('Error checking email:', err)
    return { available: false, error: 'Failed to check email availability' }
  }
}
