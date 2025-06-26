import { NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

async function createSupabase() {
  const cookieStore = await nextCookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
}

export async function GET() {
  const supabase = await createSupabase()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (adminUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: users } = await supabase.from('users').select('*')
  return NextResponse.json(users)
}

export async function PATCH(request: Request) {
  const supabase = await createSupabase()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (adminUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role } = await request.json()

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('email', email)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
