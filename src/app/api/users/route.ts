import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await nextCookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value || '',
        set: async (key, value, options) => {
          try {
            await cookieStore.set({ name: key, value, ...options })
          } catch (err) {
            console.error('Cookie set error:', err)
          }
        },
        remove: async (key, options) => {
          try {
            await cookieStore.delete({ name: key, ...options })
          } catch (err) {
            console.error('Cookie remove error:', err)
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: dbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (roleError || dbUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(users)
}
