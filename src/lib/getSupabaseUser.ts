import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function getSupabaseUser() {
  const cookieStore = await nextCookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value || '',
        set: async (key, value, options) => {
          await cookieStore.set({ name: key, value, ...options })
        },
        remove: async (key, options) => {
          await cookieStore.delete({ name: key, ...options })
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  return user
}
