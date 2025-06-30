import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import process from 'node:process'

export async function GET() {
  const cookieStore = await nextCookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (key) => (await cookieStore).get(key)?.value ?? '',
        set: async (key, value, options) => {
          ;(await cookieStore).set({ name: key, value, ...options })
        },
        remove: async (key, options) => {
          ;(await cookieStore).delete({ name: key, ...options })
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: dbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (roleError || dbUser?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(users), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
