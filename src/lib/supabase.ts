import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Supabase credentials are required for gallery integration

export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          if (!document.cookie) return []
          return document.cookie.split('; ').map(cookie => {
            const [name, ...rest] = cookie.split('=')
            return { name, value: rest.join('=') }
          })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set cookie with shared domain for cross-subdomain access
            const host = window.location.hostname || ''
            const isProd = host.endsWith('tesla-wrap.com')

            const cookieOptions = {
              ...options,
              domain: isProd ? '.tesla-wrap.com' : undefined,
              path: '/',
              sameSite: isProd ? ('lax' as const) : ('lax' as const),
              secure: isProd ? true : window.location.protocol === 'https:',
            }
            
            let cookieString = `${name}=${value}`
            if (cookieOptions.domain) cookieString += `; domain=${cookieOptions.domain}`
            if (cookieOptions.path) cookieString += `; path=${cookieOptions.path}`
            if (cookieOptions.sameSite) cookieString += `; sameSite=${cookieOptions.sameSite}`
            if (cookieOptions.secure) cookieString += `; secure`
            if (cookieOptions.maxAge) cookieString += `; max-age=${cookieOptions.maxAge}`
            if (cookieOptions.expires) cookieString += `; expires=${cookieOptions.expires.toUTCString()}`
            
            document.cookie = cookieString
          })
        },
      },
    })
  : null



