import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server' // ✅ use your shared helper

export async function POST(req: Request) {
  const supabase = await createServerClient()

  const { bot_id } = await req.json()

  if (!bot_id) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  const { data: config, error } = await supabase
    .from('integrations_zapier')
    .select('webhook_url')
    .eq('bot_id', bot_id)
    .maybeSingle()

  if (error || !config?.webhook_url) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        bot_id,
        lead: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+0000000000',
          message: 'Test message from Zapier integration.',
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'Zapier responded with error', text }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send request' }, { status: 500 })
  }
}
