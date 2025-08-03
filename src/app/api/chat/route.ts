import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { ratelimit } from '@/lib/rateLimiter'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import * as cheerio from 'cheerio'
import { searchRelevantChunks } from '@/lib/vector/searchRelevantChunks'

const toneDefinition = {
  friendly: 'warm, conversational, and approachable.',
  direct: 'clear, concise, and straight to the point.',
  bold: 'confident, persuasive, and energetic.',
  professional: 'formal, respectful, and business-like.',
  casual: 'relaxed, informal, and lighthearted.',
  inspirational: 'uplifting, motivational, and vision-driven.',
  playful: 'fun, energetic, and a bit cheeky.'
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function cleanHtml(input: string): string {
  const $ = cheerio.load(input || '')
  $('script, style').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous'

    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const cookieStore = await nextCookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: async (cookies) => {
            await Promise.all(cookies.map((cookie) => cookieStore.set(cookie)))
          },
        },
      }
    )

    let user = null
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) console.warn('⚠️ Supabase auth error (proceeding anyway):', error)
      user = data?.user || null
    } catch (e) {
      console.warn('⚠️ Supabase getUser() failed (probably public):', e)
      user = null
    }

    let body
    try {
      body = await req.json()
    } catch (err) {
      console.error('❌ Invalid JSON body:', err)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { 
      question, 
      user_id, 
      history, 
      conversation_id,
      user_auth_id 
    } = body || {}

    if (!question || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('------ DEBUG START ------')
    console.log('SESSION EMAIL:', user?.email || '[public]')
    console.log('REQUEST BODY:', body)
    console.log('user_id:', user_id)

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, description, tone')
      .eq('id', user_id)
      .single()

    console.log('BOT:', bot)
    console.log('QUERY ERROR:', botError)
    console.log('------ DEBUG END ------')

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 400 })
    }

    const { data: fileData, error: fileError } = await supabase
      .from('bot_knowledge_files')
      .select("content")
      .eq('bot_id', bot.id)

    if (fileError) {
      console.error('❌ File fetch error:', fileError)
    }

    const chunks: { text: string }[] = await searchRelevantChunks(bot.id, question)
    console.log("🔍 Chunks used in prompt:", chunks.map(c => c.text.slice(0, 80)))

    const cleanedScraped = chunks.map((c) => c.text).join('\n\n---\n\n')
    const cleanedFiles = Array.isArray(fileData)
      ? fileData.map((f) => cleanHtml(f.content)).join('\n\n')
      : ''

    const fullKnowledge = (
      [
        'Business Description:',
        bot.description || '',
        '',
        'Scraped Website Content:',
        cleanedScraped,
        '',
        'Uploaded Files:',
        cleanedFiles
      ].join('\n').slice(0, 150000)
    )
    
    const toneLabel = bot.tone?.toLowerCase().trim() as keyof typeof toneDefinition | undefined
    const toneInstruction = toneLabel && toneDefinition[toneLabel]
      ? `Use a ${toneLabel} tone when responding. Be ${toneDefinition[toneLabel]}`
      : ''

    const recentHistory = Array.isArray(history)
      ? history.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      : []

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `
You are the official AI assistant for this business. Always speak as if you're part of their team, using 'we', 'our', and 'us' — never refer to the business in the third person.

Only respond based on the knowledge provided to you — including the scraped website content, manually added Q&As, and any documents the business has uploaded. Never invent information, make assumptions, or offer opinions.

If the visitor asks a question related to services offered (like Meta ads, SEO, pricing, appointments, etc.), do the following:

Confirm politely whether it's something we can help with — based only on the provided content.

Ask a relevant follow-up to understand their needs (e.g. “Are you already running ads or just getting started?”).

If appropriate, guide them to the real contact method — like a contact form, calendar, or email — using the actual link provided in the knowledge.

If no contact method is available, ask how else you can assist. Do not make up contact info or use placeholders.

Never mention scraping, AI, bots, or tech unless the business explicitly stated it in their content.

Stay professional, friendly, and helpful — always invite the user to continue chatting inside the bot.

${toneInstruction}
`.trim()
      },
      {
        role: "user",
        content: `Use the following information to answer questions from potential customers:\n\n${fullKnowledge}`
      },
      ...recentHistory,
      {
        role: "user",
        content: question
      }
    ]

    try {
      const chat = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages
      })

      const finalReply = chat.choices[0].message.content || ''

      const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: async (cookies) => {
              await Promise.all(cookies.map((cookie) => cookieStore.set(cookie)))
            },
          },
        }
      )

      const botId = body.bot_id || body.user_id || ''
      
      const messagesToSave = [
        ...recentHistory.slice(-13),
        { role: 'user', content: question },
        { role: 'assistant', content: finalReply },
      ]

      await Promise.all(
        messagesToSave.map((msg) =>
          supabaseAdmin.from('chat_messages').insert({
            bot_id: botId,
            conversation_id: conversation_id,
            user_id: user_auth_id || null,
            role: msg.role,
            content: msg.content,
            created_at: new Date().toISOString()
          })
        )
      )

      return NextResponse.json({ answer: finalReply })
    } catch (err) {
      console.error('❌ OpenAI request failed:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('❌ Uncaught server error in POST /api/chat:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}