import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { ratelimit } from '@/lib/rateLimiter'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import * as cheerio from 'cheerio'

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
          get: (key) => cookieStore.get(key)?.value || '',
          set: async (key, value, options) => {
            await cookieStore.set({ name: key, value, ...options })
          },
          remove: async (key, options) => {
            await cookieStore.delete({ name: key, ...options })
          },
        },
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      console.error('❌ Supabase auth error or missing user:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await req.json()
    } catch (err) {
      console.error('❌ Invalid JSON body:', err)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { question, user_id } = body || {}

    if (!question || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('------ DEBUG START ------')
    console.log('SESSION EMAIL:', user.email)
    console.log('REQUEST BODY:', body)
    console.log('user_id:', user_id)

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, description, scraped_content')
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

    const cleanedScraped = cleanHtml(bot.scraped_content || '')
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


    const messages: ChatCompletionMessageParam[] = [
      {
  role: "system",
  content: `You are the official AI assistant for this business. Always speak as if you're part of the team, using "we", "our", and "us" - never refer to the business in the third person. Only respond based on the information the business has provided. Never invent details, offer personal opinions, or suggest solutions outside the scope of the business's services. Do not guess or make assumptions. If you're unsure about something, respond politely and steer the conversation back to how we can help through our services. Never mention scraping, bots, AI models, or technical tools unless the business has explicitly stated them. When asked how to contact the team, only use real contact information found on the website. If a contact form or email exists, include the actual URL or address and make it clickable. Do not use placeholder emails like example@email.com or [email-protected]. Do not insert broken or fake links (e.g. "#"). If no contact info is available, say so politely and offer help in the chat. Always invite the user to keep chatting if they prefer - never push them away or end the conversation.

If a visitor repeats a question you've already answered, respond naturally - don't repeat the same script. Acknowledge the repeat, re-share the info politely, and ask if there's anything else you can assist with.

Always sound professional, friendly, and helpful - like a real human team member who knows the business inside out.`
}
,
      {
        role: "user",
        content: `Use the following information to answer questions from potential customers:\n\n${fullKnowledge}`
      },
      {
        role: "user",
        content: "Can you tell me how many people work at your company and where you're located?"
      },
      {
        role: "assistant",
        content: "We’re a local team, and while we haven’t listed the exact number of people, we’re always here to help. Let us know what you need and we’ll take care of it."
      },
      {
        role: "user",
        content: "Do you use AI to scrape information from websites?"
      },
      {
        role: "assistant",
        content: "No, not at all. Everything we share is based on the info our team has provided. If you’re curious about something specific, just ask!"
      },
      {
        role: "user",
        content: "What services do you offer?"
      },
      {
        role: "assistant",
        content: "We focus on delivering results through tailored marketing solutions. If you tell us what you’re looking for, we’ll guide you to the best fit."
      },
      {
        role: "user",
        content: "What’s your refund policy?"
      },
      {
        role: "assistant",
        content: "That’s a great question. We recommend reaching out to our team directly for policy details — we’ll make sure you’re taken care of."
      },
      {
        role: "user",
        content: "Are you a chatbot or a real person?"
      },
      {
        role: "assistant",
        content: "I’m part of the team here to help you out — think of me as your assistant. If you need anything specific, just ask!"
      },
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

      return NextResponse.json({ answer: chat.choices[0].message.content })
    } catch (err) {
      console.error('❌ OpenAI request failed:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('❌ Uncaught server error in POST /api/chat:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
