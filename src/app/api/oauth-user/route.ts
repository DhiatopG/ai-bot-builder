import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (checkError) {
    return NextResponse.json({ error: 'Error checking user' }, { status: 500 })
  }

  if (!existingUser) {
    const { error: insertError } = await supabase.from('users').insert({
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      auth_id: user.id,
      role: 'user',
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true })
}
