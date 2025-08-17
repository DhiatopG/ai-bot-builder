import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'   // ✅ admin so RLS won’t block

export async function POST(req: Request) {
  const admin = await createAdminClient()
  const body = await req.json().catch(() => ({} as any))
  const { user_id, bot_id } = body as { user_id?: string; bot_id?: string }

  if (!user_id && !bot_id) {
    return NextResponse.json({ error: 'Provide user_id or bot_id' }, { status: 400 })
  }

  try {
    let leadsRes

    if (bot_id) {
      // Per-bot view
      leadsRes = await admin
        .from('leads')
        .select('*')
        .eq('bot_id', bot_id)
        .order('created_at', { ascending: false })
    } else {
      // Per-user view: get all bot IDs then fetch leads
      const { data: bots, error: botErr } = await admin
        .from('bots')
        .select('id')
        .eq('user_id', user_id!)

      if (botErr) {
        return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 })
      }

      const botIds = (bots || []).map(b => b.id)
      leadsRes = await admin
        .from('leads')
        .select('*')
        .in('bot_id', botIds.length ? botIds : ['__none__'])
        .order('created_at', { ascending: false })
    }

    if (leadsRes.error) {
      return NextResponse.json({ error: leadsRes.error.message }, { status: 500 })
    }

    return NextResponse.json({ leads: leadsRes.data || [] })
  } catch (_e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  
}
