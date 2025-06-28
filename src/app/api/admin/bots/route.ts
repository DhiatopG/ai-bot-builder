import { NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  const cookieStore = await nextCookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value ?? '',
        set: async (key, value, options) => {
          cookieStore.set({ name: key, value, ...options })
        },
        remove: async (key, options) => {
          cookieStore.delete({ name: key, ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (dbUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase
    .from('bots')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json(data)
}
