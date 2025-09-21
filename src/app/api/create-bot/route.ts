import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';
import { scrapeBlogContent } from '@/lib/scrapeBlogContent';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function scrapeWebsiteContent(url: string): Promise<string> {
  const visited = new Set<string>();
  const base = new URL(url).origin;
  const queue = [url];
  let combinedText = '';

  const isPdf = (u: string) => u.toLowerCase().endsWith('.pdf');
  const isScrapable = (u: string) =>
    !/\.(pdf|doc|docx|zip|rar|csv|xlsx|ppt|exe)$/i.test(u);

  while (queue.length && visited.size < 10) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const res = await fetch(currentUrl);
      const contentType = res.headers.get('content-type') || '';
      if (isPdf(currentUrl) && contentType.includes('application/pdf')) continue;
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      combinedText += text + '\n';

      $('a[href^="/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const fullUrl = new URL(href, base).toString();
          if (fullUrl.startsWith(base) && !visited.has(fullUrl) && isScrapable(fullUrl)) {
            queue.push(fullUrl);
          }
        }
      });
    } catch (err) {
      console.error('Scrape failed:', currentUrl, err);
    }
  }

  return combinedText.slice(0, 150000);
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();

    // ✅ Get logged-in user from session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { botName, businessInfo, qaPairs, logoUrl } = body || {};

    if (!botName || !businessInfo?.description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const urls = Array.isArray(businessInfo.urls) ? businessInfo.urls : [];
    let scrapedText = '';

    for (const url of urls) {
      try {
        let content = '';
        const isBlogLike =
          url.includes('/blog') ||
          url.includes('/post') ||
          url.includes('/news') ||
          url.includes('/stories') ||
          url.includes('/updates') ||
          url.match(/\b(blog|post|news|story|article|update|entry|insights)\b/i);

        if (isBlogLike) {
          console.log(`🔍 Using blog scraper for: ${url}`);
          const result = await scrapeBlogContent(url);
          content = typeof result === 'string' ? result : result.text;
        } else {
          console.log(`🌐 Using cheerio website scraper for: ${url}`);
          content = await scrapeWebsiteContent(url);
          if (content.trim().length < 200) {
            console.log(`⚠️ Fallback to Puppeteer for weak content: ${url}`);
            const fallback = await scrapeBlogContent(url);
            if (
              typeof fallback === 'object' &&
              fallback.text &&
              fallback.text !== 'No blog content found.'
            ) {
              content = fallback.text;
            }
          }
        }

        if (!content || content.trim().length < 20) {
          content = 'No blog content found.';
        }

        console.log(`✅ Scraped ${url}: ${content.length} characters`);
        scrapedText += content + '\n\n';
      } catch (err) {
        console.error('❌ Failed scraping URL:', url, err);
      }
    }

    const cleanedScraped = scrapedText.trim().slice(0, 150000);

    // 🔍 Auto-analyze tone from scraped content
    let detectedTone: string | null = null;
    try {
      const tonePrompt = `
Based on the following content, what is the overall communication tone used by the business?
Choose only one label from this list: "friendly", "direct", "bold", "professional", "casual", "inspirational", "playful".
Return just the label — no explanation.

Content:
${cleanedScraped.slice(0, 5000)}
      `.trim();

      const toneResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a tone classification assistant.' },
          { role: 'user', content: tonePrompt },
        ],
      });

      detectedTone =
        toneResponse.choices[0]?.message.content?.toLowerCase().trim() || null;
      console.log('🧠 Detected Tone:', detectedTone);
    } catch (toneErr) {
      console.error('❌ Tone detection failed:', toneErr);
    }

    const botData: any = {
      user_id: user.id, // ✅ tied to authenticated user
      bot_name: botName,
      description: businessInfo.description,
      urls: urls.join('\n'),
      scraped_content: cleanedScraped,
      qa: Array.isArray(qaPairs) ? qaPairs : [],
      logo_url: logoUrl || null,
    };

    if (detectedTone) {
      botData.tone = detectedTone;
    }

    const { data: insertedBots, error } = await supabase
      .from('bots')
      .insert([botData])
      .select('id');

    if (error) {
      console.error('INSERT ERROR:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const newBot = insertedBots?.[0];

    if (!newBot?.id) {
      return NextResponse.json({ success: false, error: 'Failed to create bot' }, { status: 500 });
    }

    // ⭐ Auto-set per-bot booking URL in `public.bots`
    try {
      const calendarUrl = `/book?botId=${newBot.id}&embed=1`; // match your DB format
      const { error: updErr } = await supabase
        .from('bots')
        .update({ calendar_url: calendarUrl })
        .eq('id', newBot.id);

      if (updErr) {
        console.error('BOTS calendar_url update error:', updErr.message);
      } else {
        console.log('✅ bots.calendar_url set:', calendarUrl);
      }
    } catch (e) {
      console.error('❌ BOTS calendar_url update exception:', e);
    }

    // (Optional) kick off embedding
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const embedRes = await fetch(`${baseUrl}/api/embed-chunks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: newBot.id }),
      });
      console.log('📡 Embed-chunks response:', await embedRes.text());
    } catch (embedErr) {
      console.error('❌ Failed to call /api/embed-chunks:', embedErr);
    }

    // Return bot id & calendar_url so the client can show it immediately
    return NextResponse.json({
      success: true,
      bot_id: newBot.id,
      calendar_url: `/book?botId=${newBot.id}&embed=1`,
    });
  } catch (err: any) {
    console.error('❌ FULL ERROR:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
