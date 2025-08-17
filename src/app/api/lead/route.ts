import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force Node runtime so console logs always show in dev
export const runtime = 'nodejs'

// 🔧 Turn verbose logging on/off from one place
const DEBUG_LEADS = true

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side key (safe on server only)
)

export async function POST(req: Request) {
  // --- Startup sanity logs
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) console.error('❌ NEXT_PUBLIC_SUPABASE_URL is NOT set')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('❌ SUPABASE_SERVICE_ROLE_KEY is NOT set')

  const body = await req.json()
  DEBUG_LEADS && console.log('📥 [/api/leads] Incoming body:', body)

  // Show exactly which project we write to
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const projectRef = url.split('https://')[1]?.split('.supabase.co')[0]
  DEBUG_LEADS && console.log('🧭 SUPABASE_URL =', url, ' | Project ref =', projectRef)

  const { bot_id, name, email, phone, message } = body

  if (!bot_id || !name || !email) {
    DEBUG_LEADS && console.log('❌ Missing one or more fields:', { bot_id, name, email })
    return NextResponse.json({ error: 'Missing name, email, or bot_id' }, { status: 400 })
  }

  // 🔽 normalize email so it aligns with UNIQUE(bot_id,email)
  const emailNormalized = String(email).trim().toLowerCase()
  // 🔽 normalize message; may be empty when the turn was just an email/name
  const msg = typeof message === 'string' ? message.trim() : ''
  DEBUG_LEADS && console.log('🔎 normalized inputs:', {
    emailNormalized,
    msgLen: msg.length,
    msgPreview: msg.slice(0, 120)
  })

  const queryBotId = bot_id.toString().trim()
  DEBUG_LEADS && console.log('🔍 Searching for bot_id:', `"${queryBotId}"`)

  // --- BEFORE snapshot: what (if anything) already exists for this (bot_id,email)?
  const { data: beforeRows, error: beforeErr } = await supabase
    .from('public.leads')
    .select('id, created_at, email, bot_id, message, phone, user_id')
    .eq('email', emailNormalized)
    .eq('bot_id', queryBotId)
    .order('created_at', { ascending: false })
    .limit(1)

  DEBUG_LEADS && console.log('🕵️ BEFORE upsert row:', { beforeErr, beforeRows })

  // ---- Airtable integration ----
  const { data: airtableConfig, error: airtableError } = await supabase
    .from('integrations_airtable')
    .select('api_key, base_id, table_name')
    .eq('bot_id', queryBotId)
    .maybeSingle()

  if (airtableError) {
    console.error('❌ Error fetching Airtable config:', airtableError)
  }

  if (airtableConfig) {
    try {
      const { api_key, base_id, table_name } = airtableConfig
      const airtableUrl = `https://api.airtable.com/v0/${base_id}/${table_name}`

      DEBUG_LEADS && console.log('📤 Sending to Airtable:', {
        airtableUrl,
        body: { Name: name, Email: emailNormalized, BotID: bot_id }
      })

      const airtableRes = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: { Name: name, Email: emailNormalized, BotID: bot_id }
        })
      })

      const airtableData = await airtableRes.json()
      if (!airtableRes.ok) console.log('❌ Airtable error:', airtableData)
      else DEBUG_LEADS && console.log('✅ Lead sent to Airtable:', airtableData)
    } catch (e) {
      console.error('❌ Airtable threw:', e)
    }
  }

  // ---- Make.com integration ----
  const { data: makeConfig, error: makeError } = await supabase
    .from('integrations_make')
    .select('webhook_url, make_api_key')
    .eq('bot_id', queryBotId)
    .maybeSingle()

  if (makeError) console.error('❌ Error fetching Make config:', makeError)
  DEBUG_LEADS && console.log('🔁 Make config result:', makeConfig)

  if (makeConfig?.webhook_url) {
    const makePayload = {
      bot_id,
      lead: {
        name,
        email: emailNormalized,
        phone: phone || '',
        message: msg || '' // ok to be empty for external webhook
      }
    }

    const makeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (makeConfig.make_api_key) makeHeaders['x-make-apikey'] = makeConfig.make_api_key

    try {
      const makeRes = await fetch(makeConfig.webhook_url, {
        method: 'POST',
        headers: makeHeaders,
        body: JSON.stringify(makePayload)
      })
      const responseText = await makeRes.text()
      if (!makeRes.ok) {
        console.error('❌ Make webhook responded with non-200:', makeRes.status)
        console.error('❌ Make webhook error response:', responseText)
      } else {
        DEBUG_LEADS && console.log('✅ Make webhook success response:', responseText.slice(0, 300))
      }
    } catch (err) {
      console.error('❌ Error calling Make webhook:', err)
    }
  } else {
    DEBUG_LEADS && console.log('ℹ️ No Make webhook configured for this bot.')
  }

  // ✅ Get bot's user_id (for linking the lead)
  const { data: botData, error: botError } = await supabase
    .from('bots')
    .select('user_id')
    .eq('id', queryBotId)
    .single()

  if (botError || !botData) {
    console.error("❌ Failed to fetch bot's user_id:", botError)
  } else {
    DEBUG_LEADS && console.log('👤 Bot user_id =', botData.user_id)
  }

  // ---- Save to Supabase leads table (UPSERT to avoid duplicates) ----
  // ⚠️ Critical: do NOT overwrite message with an empty string during upsert.
  const payload: any = {
    name,
    email: emailNormalized,
    bot_id,
    user_id: botData?.user_id || null,
    phone: phone || null
  }
  if (msg) payload.message = msg // only include message when we actually have one
  DEBUG_LEADS && console.log('📝 UPSERT payload keys:', Object.keys(payload), 'payload=', payload)

  const { data: inserted, error: upsertError } = await supabase
    .from('public.leads')
    .upsert([payload], { onConflict: 'bot_id,email' })
    .select('id, created_at, name, email, bot_id, user_id, phone, message')
    .single()

  DEBUG_LEADS && console.log('📤 UPSERT result:', { upsertError, inserted })

  if (upsertError) {
    return NextResponse.json({
      error: 'Lead saved to integrations but failed to upsert into Supabase.',
      details: upsertError
    }, { status: 500 })
  }

  // 🔍 AFTER snapshot: read it back as the UI would
  const { data: verifyRows, error: verifyError } = await supabase
    .from('public.leads')
    .select('id, created_at, email, bot_id, message, phone, user_id')
    .eq('email', emailNormalized)
    .eq('bot_id', bot_id)
    .order('created_at', { ascending: false })
    .limit(1)

  DEBUG_LEADS && console.log('🧪 AFTER read-back:', { verifyError, verifyRows })

  DEBUG_LEADS && console.log('✅ Lead saved to Supabase (final):', inserted)
  return NextResponse.json({ success: true, id: inserted?.id })
}
