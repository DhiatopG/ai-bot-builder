import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
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

  const body = await request.json()
  const { bot_id } = body

  const { error } = await supabase
    .from('bots')
    .delete()
    .eq('id', bot_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
