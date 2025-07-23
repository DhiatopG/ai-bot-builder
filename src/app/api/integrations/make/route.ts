// src/app/api/integrations/make/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bot_id, webhook_url } = await req.json()

  // 🔍 Check if it’s the first time for this user + bot_id
  const { data: existing, error: fetchError } = await supabase
    .from('integrations_make')
    .select('id')
    .eq('bot_id', bot_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // ⚡ Upsert the webhook
  const { error: upsertError } = await supabase
    .from('integrations_make')
    .upsert(
      {
        bot_id,
        webhook_url,
        user_id: user.id,
      },
      { onConflict: 'user_id,bot_id' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // ✅ Send test webhook only on first insert
  if (!existing) {
    try {
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id,
          user_id: user.id,
          lead: {
            name: 'Sample User',
            email: 'sample@email.com',
            phone: '+1000000000',
            message: 'This is a test payload from in60second'
          }
        })
      })
    } catch (err) {
      console.error('Failed to send test webhook:', err)
    }
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const bot_id = searchParams.get('bot_id')

  if (!bot_id) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('integrations_make')
    .select('webhook_url')
    .eq('bot_id', bot_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || {})
}
