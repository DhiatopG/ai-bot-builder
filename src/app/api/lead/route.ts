import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { user_id, name, email } = await req.json()

  const { data: botData, error } = await supabase
    .from('bots')
    .select('nocodb_api_url, nocodb_api_key, nocodb_table')
    .eq('id', user_id)
    .single()

  if (error || !botData) {
    return NextResponse.json({ error: 'Bot config not found.' }, { status: 400 })
  }

  const { nocodb_api_url, nocodb_api_key, nocodb_table } = botData

  const res = await fetch(`${nocodb_api_url}/tables/${nocodb_table}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': nocodb_api_key
    },
    body: JSON.stringify({
      Name: name,
      Email: email,
      user_id
    })
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to save lead.', details: data }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
