import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const cookieStore = await cookies() // ✅ add await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value ?? '',
        set: async () => {},
        remove: async () => {}
      }
    }
  )

  const { api_key, base_id, table_name } = await req.json()

  const {
    data: { user }
  } = await supabase.auth.getUser() // ✅ add await

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('integrations_airtable') // ✅ add await
    .upsert({
      user_id: user.id,
      api_key,
      base_id,
      table_name
    })

  if (error) {
    console.error('Airtable save error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
