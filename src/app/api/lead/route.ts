// src/app/api/lead/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()
  console.log("📥 Incoming request body:", body)

  const { bot_id, name, email } = body

  if (!bot_id || !name || !email) {
    console.log("❌ Missing one or more fields:", { bot_id, name, email })
    return NextResponse.json({ error: 'Missing name, email, or bot_id' }, { status: 400 })
  }

  const queryBotId = bot_id.toString().trim()
  console.log("🔍 Searching for bot_id:", `"${queryBotId}"`)

  // ---- Airtable integration ----
  const { data: airtableConfig, error: airtableError } = await supabase
    .from('integrations_airtable')
    .select('api_key, base_id, table_name')
    .eq('bot_id', queryBotId)
    .limit(1)
    .single()

  if (airtableError) {
    console.error("❌ Error fetching Airtable config:", airtableError)
  }

  if (airtableConfig) {
    const { api_key, base_id, table_name } = airtableConfig
    const airtableUrl = `https://api.airtable.com/v0/${base_id}/${table_name}`

    console.log("📤 Sending to Airtable:", {
      airtableUrl,
      body: { Name: name, Email: email, BotID: bot_id }
    })

    const airtableRes = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Name: name,
          Email: email,
          BotID: bot_id
        }
      })
    })

    const airtableData = await airtableRes.json()

    if (!airtableRes.ok) {
      console.log("❌ Airtable error:", airtableData)
    } else {
      console.log("✅ Lead sent to Airtable:", airtableData)
    }
  }

  // ---- Make.com integration ----
  const { data: makeConfig, error: makeError } = await supabase
    .from('integrations_make')
    .select('webhook_url')
    .eq('bot_id', queryBotId)
    .limit(1)
    .single()

  console.log("🔁 Make config result:", makeConfig, makeError)

  if (makeConfig?.webhook_url) {
    console.log("📤 Sending to Make webhook:", makeConfig.webhook_url)

    try {
      const makeRes = await fetch(makeConfig.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          bot_id,
          timestamp: new Date().toISOString()
        })
      })

      if (!makeRes.ok) {
        const errorText = await makeRes.text()
        console.error("❌ Make webhook error:", errorText)
      } else {
        console.log("✅ Lead sent to Make webhook.")
      }
    } catch (err) {
      console.error("❌ Error calling Make webhook:", err)
    }
  } else {
    console.log("ℹ️ No Make webhook configured for this bot.")
  }

  // ---- Save to Supabase leads table ----
  const { error: insertError } = await supabase.from('leads').insert([
    {
      name,
      email,
      bot_id
    }
  ])

  if (insertError) {
    console.log("⚠️ Supabase insert error:", insertError)
    return NextResponse.json({
      error: 'Lead saved to integrations but failed to insert into Supabase.',
      details: insertError
    }, { status: 500 })
  }

  console.log("✅ Lead saved to Supabase.")
  return NextResponse.json({ success: true })
}
