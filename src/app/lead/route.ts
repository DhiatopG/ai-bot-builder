import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }

  const { data: botData, error } = await supabase
    .from('bots')
    .select('nocodb_api_token, nocodb_table_id')
    .eq('user_id', user_id)
    .single()

  if (error || !botData) {
    return NextResponse.json({ error: 'NocoDB config not found' }, { status: 400 })
  }

  const { nocodb_api_token, nocodb_table_id } = botData

  const nocoRes = await fetch(`https://app.nocodb.com/api/v2/tables/${nocodb_table_id}/records`, {
    headers: { 'xc-token': nocodb_api_token }
  })

  const result = await nocoRes.json()

  if (!nocoRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch leads', details: result }, { status: 500 })
  }

  return NextResponse.json(result)
}
