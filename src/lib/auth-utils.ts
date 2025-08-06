import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function getSupabaseUser() {
  const cookieStore = await nextCookies() // ✅ await it

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: async (cookies) => {
          await Promise.all(cookies.map((cookie) => cookieStore.set(cookie)))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
