import { supabase } from '../lib/supabase'

export interface UserProfile {
  id: string
  email: string | null
  profile_picture_url: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

/**
 * Fetch user profile from profiles table
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data as UserProfile
  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
}

