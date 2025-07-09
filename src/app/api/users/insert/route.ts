import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { email, name, auth_id } = body

  console.log('[InsertUserAPI] 🚀 Received:', { email, name, auth_id })

  if (!email || !auth_id) {
    console.error('[InsertUserAPI] ❌ Missing fields')
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const source = req.headers.get('X-Origin')
  console.log('[InsertUserAPI] 📥 Request source:', source || 'Unknown')

  // Check if user already exists (quoted for safety)
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .or(`email.eq."${email}",auth_id.eq."${auth_id}"`)
    .maybeSingle()

  console.log('[InsertUserAPI] 🔍 Existing check result:', { existingUser, checkError })

  if (checkError) {
    console.error('[InsertUserAPI] ❌ Error during existence check:', checkError.message)
    return NextResponse.json({ error: 'Failed user check' }, { status: 500 })
  }

  if (existingUser) {
    console.log('[InsertUserAPI] ✅ User already exists:', existingUser.id)
    return NextResponse.json({ message: 'User exists' }, { status: 200 })
  }

  // Insert new user
  console.log('[InsertUserAPI] 🛠 Attempting insert for:', { email, auth_id })

  const { error: insertError } = await supabase.from('users').insert({
    email,
    name,
    uuid: auth_id,
    auth_id,
    role: 'user',
  })

  if (insertError) {
    console.error('[InsertUserAPI] ❌ Insert failed:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  console.log('[InsertUserAPI] ✅ User created successfully:', email)
  return NextResponse.json({ success: true }, { status: 200 })
}
