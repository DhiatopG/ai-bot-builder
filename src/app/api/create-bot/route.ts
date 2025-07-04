import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔒 Must use service role to upload to storage
)

async function scrapeWebsiteContent(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    const html = await res.text()
    const matches = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyContent = matches ? matches[1] : html
    const textOnly = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return textOnly.slice(0, 4000)
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, botName, businessInfo, qaPairs, logoUrl } = body

    const urls = businessInfo.urls || []
    let scrapedText = ''

    for (const url of urls) {
      const content = await scrapeWebsiteContent(url)
      scrapedText += content + '\n'
    }

    const finalLogoUrl = logoUrl || null

    const botData = {
      user_id: userId,
      bot_name: botName,
      description: businessInfo.description,
      urls: urls.join('\n'),
      scraped_content: scrapedText,
      qa: qaPairs,
      logo_url: finalLogoUrl
    }

    const { error } = await supabase.from('bots').insert([botData])

    if (error) {
      console.error('INSERT ERROR:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('❌ FULL ERROR:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
