import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { bot_id, webhook_url } = await req.json()

  const { error } = await supabase
    .from('integrations_zapier')
    .upsert({ bot_id, webhook_url }, { onConflict: 'bot_id' }) // ✅ fixed here

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const bot_id = searchParams.get('bot_id')

  if (!bot_id) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('integrations_zapier')
    .select('webhook_url')
    .eq('bot_id', bot_id)
    .maybeSingle() // 👈 This allows 0 or 1 result safely

  if (error) {
    console.error('GET /api/integrations/zapier error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || {}) // return empty object if no row
}
