import { createServerClient as supabaseCreateServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createAdminClient = async () => {
  const cookieStore = await cookies()

  return supabaseCreateServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔐 Service Role Key
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: async (newCookies) => {
          newCookies.forEach((cookie) => {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          })
        },
      },
    }
  )
}
