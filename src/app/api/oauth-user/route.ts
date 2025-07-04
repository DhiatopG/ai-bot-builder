import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value || '',
        set: async () => {},
        remove: async () => {}
      }
    }
  )

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!existingUser) {
    await supabase.from('users').insert({
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      auth_id: user.id,
      role: 'user',
    })
  }

  return NextResponse.json({ success: true })
}
