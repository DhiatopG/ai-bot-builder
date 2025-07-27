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

  if (!bot_id || !webhook_url) {
    return NextResponse.json({ error: 'Missing bot_id or webhook_url' }, { status: 400 })
  }

  // 🔍 Check if a record already exists for this user+bot
  const { data: existing, error: fetchError } = await supabase
    .from('integrations_make')
    .select('id')
    .eq('bot_id', bot_id)
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('🧪 Make existing check:', existing)

  if (fetchError) {
    console.error('❌ Failed to fetch existing Make integration:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch existing integration.' }, { status: 500 })
  }

  // ⚡ Upsert Make webhook config
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
    console.error('❌ Upsert error:', upsertError)
    return NextResponse.json({ error: 'Failed to save Make integration.' }, { status: 500 })
  }

  // ✅ Optional test webhook if this is a new insert
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
      console.log('✅ Test webhook sent to Make')
    } catch (err) {
      console.error('❌ Failed to send test webhook:', err)
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
    console.error('❌ Failed to fetch webhook:', error)
    return NextResponse.json({ error: 'Failed to load Make webhook.' }, { status: 500 })
  }

  return NextResponse.json(data || {})
}
