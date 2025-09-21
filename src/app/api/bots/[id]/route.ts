// src/app/api/bots/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // must be set in .env.local
  { auth: { persistSession: false } }
)

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }  // Next.js 15: params is async
) {
  const { id } = await ctx.params
  const debug = new URL(req.url).searchParams.get('debug') === '1'

  const { data: bot, error } = await supabase
    .from('bots')
    .select('id, bot_name')                  // only real columns
    .eq('id', id)
    .single()

  if (error || !bot) {
    const payload = { ok: false, error: 'BOT_NOT_FOUND', detail: error?.message, id }
    return NextResponse.json(debug ? { ...payload, debug: true } : payload, { status: 404 })
  }
  const payload = { ok: true, bot }
  return NextResponse.json(debug ? { ...payload, debug: true } : payload)
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const body = await req.json()
  const { airtable_api_key, airtable_base_id, airtable_table_name } = body

  const { error } = await supabase
    .from('bots')
    .update({ airtable_api_key, airtable_base_id, airtable_table_name })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
