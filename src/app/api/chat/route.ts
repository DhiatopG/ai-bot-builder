import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { ratelimit } from '@/lib/rateLimiter'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
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
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { question, user_id } = body

  // ✅ DEBUG LOGGING
  console.log('------ DEBUG START ------')
  console.log('SESSION EMAIL:', user.email)
  console.log('REQUEST BODY:', body)
  console.log('user_id:', user_id)

  const { data: bot, error } = await supabase
    .from('bots')
    .select('id, description, scraped_content')
    .eq('id', user_id)
    .single()

  console.log('BOT:', bot)
  console.log('QUERY ERROR:', error)
  console.log('------ DEBUG END ------')

  if (error || !bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 400 })
  }

  const { data: fileData } = await supabase
    .from('bot_knowledge_files')
    .select('file_text')
    .eq('bot_id', bot.id)

  const fileKnowledge = fileData?.map((f) => f.file_text).join('\n\n') || ''

  const fullKnowledge = `
Business Description:
${bot.description || ''}

Scraped Website Content:
${bot.scraped_content || ''}

Uploaded Files:
${fileKnowledge}
`

  const prompt = `
You are a helpful assistant for a business. Use the following info to answer questions from potential customers:

${fullKnowledge}

Q: ${question}
A:
`

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    })

    return NextResponse.json({ answer: chat.choices[0].message.content })
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
