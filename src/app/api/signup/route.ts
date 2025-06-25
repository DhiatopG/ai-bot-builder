import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data?.user) {
    return NextResponse.json({ success: false, message: error?.message || 'Signup failed' }, { status: 400 })
  }

  await supabase.from('users').insert({
    auth_id: data.user.id,
    email: data.user.email,
    name: '',
    role: 'user',
  })

  return NextResponse.json({ success: true, user: data.user })
}
