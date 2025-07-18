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
          await cookieStore.set({ name: key, value, ...options })
        },
        remove: async (key, options) => {
          await cookieStore.delete({ name: key, ...options })
        }
      }
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

  const { data, error: fetchError } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
