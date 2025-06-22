import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function GET() {
  const { data: bots, error: botError } = await supabase.from('bots').select('id')
  if (botError) return NextResponse.json({ error: botError.message }, { status: 500 })

  for (const bot of bots) {
    const { data: messages } = await supabase
      .from('conversations')
      .select('question')
      .eq('bot_id', bot.id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    const questions = messages?.map((msg) => msg.question).join('\n') || ''

    if (!questions) continue

    const prompt = `Summarize today's most important or frequently asked questions from these messages:\n${questions}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = completion.choices[0].message.content

    await supabase.from('daily_summaries').insert({
      bot_id: bot.id,
      summary,
      date: new Date().toISOString().slice(0, 10),
    })
  }

  return NextResponse.json({ success: true })
}
