// /src/app/api/bots/[id]/info/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type BotInfoPayload = {
  contact_email?: string
  contact_phone?: string
  contact_form_url?: string
  location?: string
  offer_1_title?: string; offer_1_url?: string
  offer_2_title?: string; offer_2_url?: string
  offer_3_title?: string; offer_3_url?: string
  offer_4_title?: string; offer_4_url?: string
  offer_5_title?: string; offer_5_url?: string
}

const ALLOWED: (keyof BotInfoPayload)[] = [
  'contact_email','contact_phone','contact_form_url','location',
  'offer_1_title','offer_1_url','offer_2_title','offer_2_url',
  'offer_3_title','offer_3_url','offer_4_title','offer_4_url',
  'offer_5_title','offer_5_url',
]

export const dynamic = 'force-dynamic'

async function getClients() {
  const supabase = await createServerClient()     // your async server client
  const admin = createAdminClient()               // sync service-role client
  return { supabase, admin }
}

async function requireOwner(botId: string) {
  const { supabase, admin } = await getClients()

  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) }

  const { data: bot, error } = await supabase
    .from('bots')
    .select('id,user_id')
    .eq('id', botId)
    .single()

  if (error || !bot) return { error: NextResponse.json({ error: 'bot_not_found' }, { status: 404 }) }
  if (bot.user_id !== user.id) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }

  return { supabase, admin, bot }
}

// 👇 Next 15: params is a Promise — await it first
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireOwner(id)
  if ('error' in guard) return guard.error
  const { admin, bot } = guard

  const { data, error } = await admin
    .from('bot_info')
    .select('*')
    .eq('bot_id', bot.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? null }, { status: 200 })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const guard = await requireOwner(id)
  if ('error' in guard) return guard.error
  const { admin, bot } = guard

  let body: Partial<BotInfoPayload> = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const clean: Record<string, string | null> = { bot_id: bot.id }
  for (const k of ALLOWED) clean[k] = typeof body[k] === 'string' ? (body[k] as string) : null

  const { error } = await admin.from('bot_info').upsert(clean) // bypasses RLS
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
