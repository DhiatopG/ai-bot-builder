import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { scrapeBlogContent } from '@/lib/scrapeBlogContent'
import { OpenAI } from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

async function scrapeWebsiteContent(url: string): Promise<string> {
  const visited = new Set<string>()
  const base = new URL(url).origin
  const queue = [url]
  let combinedText = ''

  const isPdf = (u: string) => u.toLowerCase().endsWith('.pdf')
  const isScrapable = (u: string) => {
    return !/\.(pdf|doc|docx|zip|rar|csv|xlsx|ppt|exe)$/i.test(u)
  }

  while (queue.length && visited.size < 10) {
    const currentUrl = queue.shift()
    if (!currentUrl || visited.has(currentUrl)) continue
    visited.add(currentUrl)

    try {
      const res = await fetch(currentUrl)
      const contentType = res.headers.get('content-type') || ''
      if (isPdf(currentUrl) && contentType.includes('application/pdf')) continue
      if (!contentType.includes('text/html')) continue

      const html = await res.text()
      const $ = cheerio.load(html)
      const text = $('body').text().replace(/\s+/g, ' ').trim()
      combinedText += text + '\n'

      $('a[href^="/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
          const fullUrl = new URL(href, base).toString()
          if (
            fullUrl.startsWith(base) &&
            !visited.has(fullUrl) &&
            isScrapable(fullUrl)
          ) {
            queue.push(fullUrl)
          }
        }
      })
    } catch (err) {
      console.error('Scrape failed:', currentUrl, err)
    }
  }

  return combinedText.slice(0, 150000)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, botName, businessInfo, qaPairs, logoUrl } = body || {}

    if (!userId || !botName || !businessInfo?.description) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const urls = Array.isArray(businessInfo.urls) ? businessInfo.urls : []
    let scrapedText = ''

    for (const url of urls) {
      try {
        let content = ''
        const isBlogLike = (
          url.includes('/blog') ||
          url.includes('/post') ||
          url.includes('/news') ||
          url.includes('/stories') ||
          url.includes('/updates') ||
          url.match(/\b(blog|post|news|story|article|update|entry|insights)\b/i)
        )

        if (isBlogLike) {
          console.log(`🔍 Using blog scraper for: ${url}`)
          content = await scrapeBlogContent(url)
        } else {
          console.log(`🌐 Using cheerio website scraper for: ${url}`)
          content = await scrapeWebsiteContent(url)
          if (content.trim().length < 200) {
            console.log(`⚠️ Fallback to Puppeteer for weak content: ${url}`)
            const fallback = await scrapeBlogContent(url)
            if (fallback && fallback !== 'No blog content found.') {
              content = fallback
            }
          }
        }

        if (!content || content.trim().length < 20) {
          content = 'No blog content found.'
        }

        console.log(`✅ Scraped ${url}: ${content.length} characters`)
        scrapedText += content + '\n\n'
      } catch (err) {
        console.error('❌ Failed scraping URL:', url, err)
      }
    }

    const cleanedScraped = scrapedText.trim().slice(0, 150000)

    // 🔍 Auto-analyze tone from scraped content
    let detectedTone: string | null = null
    try {
      const tonePrompt = `
Based on the following content, what is the overall communication tone used by the business?
Choose only one label from this list: "friendly", "direct", "bold", "professional", "casual", "inspirational", "playful".
Return just the label — no explanation.

Content:
${cleanedScraped.slice(0, 5000)}
      `.trim()

      const toneResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a tone classification assistant.' },
          { role: 'user', content: tonePrompt }
        ]
      })

      detectedTone = toneResponse.choices[0]?.message.content?.toLowerCase().trim() || null
      console.log('🧠 Detected Tone:', detectedTone)
    } catch (toneErr) {
      console.error('❌ Tone detection failed:', toneErr)
    }

    const finalLogoUrl = logoUrl || null
    const finalQaPairs = Array.isArray(qaPairs) ? qaPairs : []

    const botData: any = {
      user_id: userId,
      bot_name: botName,
      description: businessInfo.description,
      urls: urls.join('\n'),
      scraped_content: cleanedScraped,
      qa: finalQaPairs,
      logo_url: finalLogoUrl
    }

    if (detectedTone) {
      botData.tone = detectedTone
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
