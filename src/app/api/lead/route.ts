import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force Node runtime so console logs always show in dev
export const runtime = 'nodejs'

// 🔧 Turn verbose logging on/off from one place
const DEBUG_LEADS = true

// Prefer private SUPABASE_URL; fall back to NEXT_PUBLIC_ if needed
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) console.error('❌ SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is NOT set')
if (!SUPABASE_SERVICE_ROLE_KEY) console.error('❌ SUPABASE_SERVICE_ROLE_KEY is NOT set')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

export async function POST(req: Request) {
  // --- Startup sanity logs
  const url = SUPABASE_URL || ''
  const projectRef = url.split('https://')[1]?.split('.supabase.co')[0]
  DEBUG_LEADS && console.log('🧭 SUPABASE_URL =', url, ' | Project ref =', projectRef)

  const body = await req.json()
  DEBUG_LEADS && console.log('📥 [/api/lead] Incoming body:', body)

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
    msgPreview: msg.slice(0, 120),
  })

  const queryBotId = bot_id.toString().trim()
  DEBUG_LEADS && console.log('🔍 Searching for bot_id:', `"${queryBotId}"`)

  // --- BEFORE snapshot: what (if anything) already exists for this (bot_id,email)?
  // ⚠️ Use 'leads' (not 'public.leads') or you may hit relation "public.public.leads" does not exist
  const { data: beforeRows, error: beforeErr } = await supabase
    .from('leads')
    .select('id, created_at, email, bot_id, message, phone, user_id')
    .eq('email', emailNormalized)
    .eq('bot_id', queryBotId)
    .order('created_at', { ascending: false })
    .limit(1)

  DEBUG_LEADS && console.log('🕵️ BEFORE upsert row:', { beforeErr, beforeRows })

  // ---- Airtable integration (optional) ----
  try {
    const { data: airtableConfig, error: airtableError } = await supabase
      .from('integrations_airtable')
      .select('api_key, base_id, table_name')
      .eq('bot_id', queryBotId)
      .maybeSingle()

    if (airtableError?.code === '42P01') {
      // table missing is fine in multi-tenant setups
      DEBUG_LEADS && console.log('ℹ️ integrations_airtable table not found; skipping Airtable.')
    } else if (airtableError) {
      console.error('❌ Error fetching Airtable config:', airtableError)
    } else if (airtableConfig) {
      const { api_key, base_id, table_name } = airtableConfig
      const airtableUrl = `https://api.airtable.com/v0/${base_id}/${table_name}`

      DEBUG_LEADS && console.log('📤 Sending to Airtable:', {
        airtableUrl,
        body: {
          Name: name,
          Email: emailNormalized,
          
          Phone: phone || '',
          message: msg || '',
        },
      })

      try {
        const airtableRes = await fetch(airtableUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              Name: name,
              Email: emailNormalized,
              
              Phone: phone || '',
              message: msg || '',
            },
          }),
        })
        const airtableData = await airtableRes.json()
        if (!airtableRes.ok) console.log('❌ Airtable error:', airtableData)
        else DEBUG_LEADS && console.log('✅ Lead sent to Airtable:', airtableData)
      } catch (e) {
        console.error('❌ Airtable threw:', e)
      }
    }
  } catch (e) {
    console.error('❌ Airtable block threw:', e)
  }

  // ===========================
  //      Make.com integration
  // ===========================
  let makeUrl: string | null = null
  let makeKey: string | null = null
  let makeSource: 'bot' | 'user-default' | 'env' | 'none' = 'none'

  try {
    // 1) per-bot
    const { data: makeConfig, error: makeError } = await supabase
      .from('integrations_make')
      .select('webhook_url, make_api_key')
      .eq('bot_id', queryBotId)
      .maybeSingle()

    if (makeError?.code === '42P01') {
      DEBUG_LEADS && console.log('ℹ️ integrations_make table not found; skipping bot-level Make.')
    } else if (makeError) {
      console.error('❌ Error fetching Make config (bot):', makeError)
    } else if (makeConfig?.webhook_url) {
      makeUrl = makeConfig.webhook_url
      makeKey = makeConfig.make_api_key ?? null
      makeSource = 'bot'
    }

    // 2) per-user default (only if bot-level missing)
    if (!makeUrl) {
      const { data: botOwner, error: botOwnerErr } = await supabase
        .from('bots')
        .select('user_id')
        .eq('id', queryBotId)
        .single()

      if (botOwnerErr?.code === '42P01') {
        DEBUG_LEADS && console.log('ℹ️ bots table not found; skipping Make user-default resolution.')
      } else if (botOwnerErr) {
        console.error("❌ Failed to fetch bot's user_id for Make default:", botOwnerErr)
      } else if (botOwner?.user_id) {
        const { data: makeDefault, error: makeDefaultErr } = await supabase
          .from('integrations_make_defaults')
          .select('webhook_url, make_api_key')
          .eq('user_id', botOwner.user_id)
          .maybeSingle()

        if (makeDefaultErr?.code === '42P01') {
          DEBUG_LEADS && console.log('ℹ️ integrations_make_defaults not found; skipping.')
        } else if (makeDefaultErr) {
          console.error('❌ Error fetching Make default (user):', makeDefaultErr)
        } else if (makeDefault?.webhook_url) {
          makeUrl = makeDefault.webhook_url
          makeKey = makeDefault.make_api_key ?? null
          makeSource = 'user-default'
        }
      }
    }

    // 3) env fallback
    if (!makeUrl && process.env.MAKE_WEBHOOK_URL_DEFAULT) {
      makeUrl = process.env.MAKE_WEBHOOK_URL_DEFAULT
      makeKey = process.env.MAKE_API_KEY_DEFAULT ?? null
      makeSource = 'env'
    }

    DEBUG_LEADS && console.log('🧩 Make resolution:', {
      resolved: !!makeUrl,
      source: makeSource,
      hasKey: !!makeKey,
    })

    if (makeUrl) {
      const makePayload = {
        bot_id,
        lead: {
          name,
          email: emailNormalized,
          phone: phone || '',
          message: msg || '',
        },
      }

      const makeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (makeKey) makeHeaders['x-make-apikey'] = makeKey

      try {
        const makeRes = await fetch(makeUrl, {
          method: 'POST',
          headers: makeHeaders,
          body: JSON.stringify(makePayload),
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
      DEBUG_LEADS && console.log('ℹ️ No Make webhook configured for this bot/user/env.')
    }
  } catch (e) {
    console.error('❌ Make block threw:', e)
  }

  // ===========================
  //        Zapier integration
  // ===========================
  let zapierUrl: string | null = null
  let zapierSource: 'bot' | 'user-default' | 'env' | 'none' = 'none'
  let zapierAuthHeader: string | null = process.env.ZAPIER_AUTH_HEADER_DEFAULT || null // optional

  try {
    // 1) per-bot
    const { data: zBot, error: zErr } = await supabase
      .from('integrations_zapier')
      .select('webhook_url')
      .eq('bot_id', queryBotId)
      .maybeSingle()

    if (zErr?.code === '42P01') {
      DEBUG_LEADS && console.log('ℹ️ integrations_zapier table not found; skipping bot-level Zapier.')
    } else if (zErr) {
      console.error('❌ Error fetching Zapier config (bot):', zErr)
    } else if (zBot?.webhook_url) {
      zapierUrl = zBot.webhook_url
      zapierSource = 'bot'
    }

    // 2) per-user default (only if bot-level missing)
    if (!zapierUrl) {
      const { data: botOwner, error: botOwnerErr } = await supabase
        .from('bots')
        .select('user_id')
        .eq('id', queryBotId)
        .single()

      if (botOwnerErr?.code === '42P01') {
        DEBUG_LEADS && console.log('ℹ️ bots table not found; skipping Zapier user-default resolution.')
      } else if (botOwnerErr) {
        console.error("❌ Failed to fetch bot's user_id for Zapier default:", botOwnerErr)
      } else if (botOwner?.user_id) {
        const { data: zDefault, error: zDefaultErr } = await supabase
          .from('integrations_zapier_defaults')
          .select('webhook_url')
          .eq('user_id', botOwner.user_id)
          .maybeSingle()

        if (zDefaultErr?.code === '42P01') {
          DEBUG_LEADS && console.log('ℹ️ integrations_zapier_defaults not found; skipping.')
        } else if (zDefaultErr) {
          console.error('❌ Error fetching Zapier default (user):', zDefaultErr)
        } else if (zDefault?.webhook_url) {
          zapierUrl = zDefault.webhook_url
          zapierSource = 'user-default'
        }
      }
    }

    // 3) env fallback
    if (!zapierUrl && process.env.ZAPIER_WEBHOOK_URL_DEFAULT) {
      zapierUrl = process.env.ZAPIER_WEBHOOK_URL_DEFAULT
      zapierSource = 'env'
    }

    DEBUG_LEADS && console.log('🧩 Zapier resolution:', {
      resolved: !!zapierUrl,
      source: zapierSource,
      hasAuthHeader: !!zapierAuthHeader,
    })

    if (zapierUrl) {
      const zapierPayload = {
        bot_id,
        event: 'lead.created',
        lead: {
          name,
          email: emailNormalized,
          phone: phone || '',
          message: msg || '',
        },
      }

      const zapHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      // Optional single header from env (common pattern for Zapier "Catch Hook + Auth" setups)
      if (zapierAuthHeader) {
        // Expecting format like: "Authorization: Bearer XYZ" OR "X-Hook-Token: abc123"
        const [k, ...rest] = zapierAuthHeader.split(':')
        const v = rest.join(':').trim()
        if (k && v) zapHeaders[k.trim()] = v
      }

      try {
        const zRes = await fetch(zapierUrl, {
          method: 'POST',
          headers: zapHeaders,
          body: JSON.stringify(zapierPayload),
        })
        const zText = await zRes.text()
        if (!zRes.ok) {
          console.error('❌ Zapier webhook responded with non-200:', zRes.status)
          console.error('❌ Zapier webhook error response:', zText)
        } else {
          DEBUG_LEADS && console.log('✅ Zapier webhook success response:', zText.slice(0, 300))
        }
      } catch (err) {
        console.error('❌ Error calling Zapier webhook:', err)
      }
    } else {
      DEBUG_LEADS && console.log('ℹ️ No Zapier webhook configured for this bot/user/env.')
    }
  } catch (e) {
    console.error('❌ Zapier block threw:', e)
  }

  // ✅ Get bot's user_id (for linking the lead)
  let botUserId: string | null = null
  try {
    const { data: botData, error: botError } = await supabase
      .from('bots')
      .select('user_id')
      .eq('id', queryBotId)
      .single()

    if (botError?.code === '42P01') {
      DEBUG_LEADS && console.log('ℹ️ bots table not found; will insert null user_id for lead.')
    } else if (botError || !botData) {
      console.error("❌ Failed to fetch bot's user_id:", botError)
    } else {
      botUserId = botData.user_id
      DEBUG_LEADS && console.log('👤 Bot user_id =', botUserId)
    }
  } catch (e) {
    console.error('❌ Fetch bot user block threw:', e)
  }

  // ---- Save to Supabase leads table (UPSERT to avoid duplicates) ----
  // ⚠️ Critical: do NOT overwrite message with an empty string during upsert.
  const payload: any = {
    name,
    email: emailNormalized,
    bot_id,
    user_id: botUserId,
    phone: phone || null,
  }
  if (msg) payload.message = msg // only include message when we actually have one

  DEBUG_LEADS && console.log('📝 UPSERT payload keys:', Object.keys(payload), 'payload=', payload)

  const { data: inserted, error: upsertError } = await supabase
    .from('leads') // <-- fixed
    .upsert([payload], { onConflict: 'bot_id,email' })
    .select('id, created_at, name, email, bot_id, user_id, phone, message')
    .single()

  DEBUG_LEADS && console.log('📤 UPSERT result:', { upsertError, inserted })

  if (upsertError) {
    return NextResponse.json(
      {
        error: 'Lead saved to integrations but failed to upsert into Supabase.',
        details: upsertError,
      },
      { status: 500 }
    )
  }

  // 🔍 AFTER snapshot: read it back as the UI would
  const { data: verifyRows, error: verifyError } = await supabase
    .from('leads') // <-- fixed
    .select('id, created_at, email, bot_id, message, phone, user_id')
    .eq('email', emailNormalized)
    .eq('bot_id', bot_id)
    .order('created_at', { ascending: false })
    .limit(1)

  DEBUG_LEADS && console.log('🧪 AFTER read-back:', { verifyError, verifyRows })
  DEBUG_LEADS && console.log('✅ Lead saved to Supabase (final):', inserted)

  return NextResponse.json({ success: true, id: inserted?.id })
}
