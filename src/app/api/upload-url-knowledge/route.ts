import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { bot_id, url } = await req.json()

  if (!bot_id || !url) {
    return NextResponse.json({ error: 'Missing bot_id or url' }, { status: 400 })
  }

  try {
    const response = await fetch(url)
    const html = await response.text()
    const $ = cheerio.load(html)
    const text = $('body').text().replace(/\s+/g, ' ').trim()

    const { data, error } = await supabase.from('bot_knowledge_files').insert([
      {
        bot_id,
        filename: url,
        content: text,
      },
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch or process the URL' }, { status: 500 })
  }
}
