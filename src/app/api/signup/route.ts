import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data?.user) {
      return NextResponse.json(
        { success: false, message: error?.message || 'Signup failed' },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        auth_id: data.user.id,
        email: data.user.email,
        name: '',
        role: 'user',
      })

    if (insertError) {
      return NextResponse.json(
        { success: false, message: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    return NextResponse.json(
      { success: false, message: (err as Error).message },
      { status: 500 }
    )
  }
}
