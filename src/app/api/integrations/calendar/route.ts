import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // don't cache this route

// Server-only admin client (bypasses RLS safely on the server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

/**
 * GET /api/integrations/calendar?botId=...
 * Returns the current provider (from bots.calendar_provider) and whether a secret exists.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const botId = searchParams.get('botId')
    if (!botId) {
      return NextResponse.json({ ok: false, error: 'botId required' }, { status: 400 })
    }

    // Read provider from `bots` (default to 'calendly' if null)
    const { data: bot, error: botErr } = await supabase
      .from('bots')
      .select('calendar_provider')
      .eq('id', botId)
      .maybeSingle()

    if (botErr) throw botErr

    // Do we have any saved secret for this bot?
    const { count, error: countErr } = await supabase
      .from('integrations_calendar')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', botId)

    if (countErr) throw countErr

    return NextResponse.json({
      ok: true,
      data: {
        calendar_provider: bot?.calendar_provider ?? 'calendly',
        has_secret: (count ?? 0) > 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 400 })
  }
}

/**
 * POST /api/integrations/calendar
 * Body: { botId: string, provider: string, secret: string }
 * Upserts the webhook secret for (bot_id, provider).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const botId: string | undefined = body?.botId
    const provider: string | undefined = body?.provider
    const secret: string | undefined = body?.secret

    if (!botId) throw new Error('botId required')
    if (!provider) throw new Error('provider required')
    if (!secret) throw new Error('secret required')

    // Optional: normalize provider keys
    const p = String(provider).toLowerCase()

    // Upsert requires a unique constraint on (bot_id, provider)
    // CREATE UNIQUE INDEX IF NOT EXISTS integrations_calendar_bot_provider_uidx
    //   ON public.integrations_calendar (bot_id, provider);
    const { error } = await supabase
      .from('integrations_calendar')
      .upsert(
        { bot_id: botId, provider: p, webhook_secret: secret },
        { onConflict: 'bot_id,provider' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'error' }, { status: 400 })
  }
}
