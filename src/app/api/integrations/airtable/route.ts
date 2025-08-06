import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server' // ✅ Use shared helper

export async function POST(req: Request) {
  const supabase = await createServerClient() // ✅ No cookieStore needed

  const { api_key, base_id, table_name } = await req.json()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('integrations_airtable')
    .upsert({
      user_id: user.id,
      api_key,
      base_id,
      table_name,
    })

  if (error) {
    console.error('Airtable save error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
