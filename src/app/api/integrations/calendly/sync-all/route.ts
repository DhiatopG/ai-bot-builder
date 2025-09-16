// src/app/api/integrations/calendly/sync-all/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('integrations_calendar')
    .select('bot_id')
    .eq('provider','calendly')
  if (error) return NextResponse.json({ error }, { status: 500 })

  let ok = 0, failed = 0
  for (const row of data || []) {
    try {
      const r = await fetch(`${BASE}/api/integrations/calendly/sync?botId=${row.bot_id}`)
      if (r.ok) ok++; else failed++
    } catch { failed++ }
  }
  return NextResponse.json({ ok, failed })
}
