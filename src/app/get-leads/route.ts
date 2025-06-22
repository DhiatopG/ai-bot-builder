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
    .select('nocodb_api_token, nocodb_table_id')
    .eq('user_id', user_id)
    .single()

  if (error || !botData) {
    return NextResponse.json({ error: 'Bot NocoDB config not found.' }, { status: 400 })
  }

  const { nocodb_api_token, nocodb_table_id } = botData

  const nocoRes = await fetch(`https://app.nocodb.com/api/v2/tables/${nocodb_table_id}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': nocodb_api_token,
    },
    body: JSON.stringify({
      Name: name,
      Email: email,
      user_id: user_id
    })
  })

  const nocoData = await nocoRes.json()

  if (!nocoRes.ok) {
    return NextResponse.json({ error: 'Failed to send to NocoDB.', details: nocoData }, { status: 500 })
  }

  return NextResponse.json({ success: true, nocoData })
}
