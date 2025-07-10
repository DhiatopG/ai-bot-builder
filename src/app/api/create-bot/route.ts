import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { scrapeBlogContent } from '@/lib/scrapeBlogContent' // ✅ added import

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔒 Must use service role to upload to storage
)

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

      if (isPdf(currentUrl) && contentType.includes('application/pdf')) {
        continue
      }

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
    let body
    try {
      body = await req.json()
    } catch (err) {
      console.error('❌ Invalid JSON:', err)
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { userId, botName, businessInfo, qaPairs, logoUrl } = body || {}

    if (!userId || !botName || !businessInfo?.description) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const urls = Array.isArray(businessInfo.urls) ? businessInfo.urls : []
    let scrapedText = ''

    for (const url of urls) {
      try {
        let content = '' // ✅ added logic
        if (url.includes('/blog') || url.includes('/post')) {
          content = await scrapeBlogContent(url)
        } else {
          content = await scrapeWebsiteContent(url)
        }
        scrapedText += content + '\n'
      } catch (err) {
        console.error('❌ Failed scraping URL:', url, err)
      }
    }

    const finalLogoUrl = logoUrl || null
    const finalQaPairs = Array.isArray(qaPairs) ? qaPairs : []

    const botData = {
      user_id: userId,
      bot_name: botName,
      description: businessInfo.description,
      urls: urls.join('\n'),
      scraped_content: scrapedText.slice(0, 150000),
      qa: finalQaPairs,
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
