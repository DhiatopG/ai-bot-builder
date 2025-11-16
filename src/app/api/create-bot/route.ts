import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import * as cheerio from 'cheerio';
import { scrapeBlogContent } from '@/lib/scrapeBlogContent';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MAX_PAGES = 10;
const MAX_DEPTH = 2;
const FETCH_TIMEOUT_MS = 12000;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const DISALLOWED_PATH_PARTS = [/login/i, /signup|register/i, /cart|checkout/i, /wp-admin/i, /account/i];

function normalizeUrl(raw: string, base?: string) {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) return null;
    if (DISALLOWED_PATH_PARTS.some(rx => rx.test(u.pathname))) return null;
    u.hash = '';
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!/^utm_|^fbclid$|^gclid$|^ref$/i.test(k)) keep.set(k, v);
    }
    u.search = keep.toString() ? `?${keep}` : '';
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'in60second-scraper/1.0',
        'Accept-Language': 'en-US,en;q=0.8',
        ...(init?.headers || {}),
      },
      ...init,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function scrapeWebsiteContent(url: string): Promise<string> {
  const start = normalizeUrl(url);
  if (!start) return '';

  const baseOrigin = new URL(start).origin;
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: start, depth: 0 }];
  let combinedText = '';

  const isBinary = (u: string) =>
    /\.(pdf|docx?|zip|rar|csv|xlsx?|pptx?|exe|mp4|mov|avi|webm|png|jpe?g|gif|svg|webp)$/i.test(u);
  const isScrapable = (u: string) => !isBinary(u);

  while (queue.length && visited.size < MAX_PAGES) {
    const next = queue.shift()!;
    if (visited.has(next.url) || next.depth > MAX_DEPTH) continue;
    visited.add(next.url);

    try {
      const res = await fetchWithTimeout(next.url);
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      ['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header'].forEach(s => $(s).remove());

      const text = $('body').text().replace(/\s+/g, ' ').trim();
      if (text) combinedText += text + '\n';

      $('a[href]').each((_, el) => {
        const raw = $(el).attr('href');
        if (!raw) return;
        if (raw.startsWith('mailto:') || raw.startsWith('tel:')) return;

        const full = normalizeUrl(raw, baseOrigin);
        if (!full || !full.startsWith(baseOrigin) || !isScrapable(full)) return;
        if (!visited.has(full)) queue.push({ url: full, depth: next.depth + 1 });
      });
    } catch (err) {
      console.error('Scrape failed:', next.url, err);
    }
  }

  return combinedText.slice(0, 150000);
}

function isBlogLike(u: string) {
  try {
    const { pathname } = new URL(u);
    return /\/(blog|posts?|news|stories|updates|insights)\b/i.test(pathname);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { botName, businessInfo, qaPairs, logoUrl } = body || {};

    // === ONLY REQUIRE: botName + at least one URL ===
    const urls = Array.isArray(businessInfo?.urls)
      ? businessInfo.urls.filter((u: string) => !!u?.trim())
      : [];

    if (!botName?.trim() || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bot name and at least one website URL are required' },
        { status: 400 }
      );
    }
    // ================================================

    let scrapedText = '';

    for (const url of urls) {
      try {
        let content = '';

        if (isBlogLike(url)) {
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

    // 🔍 Auto-analyze tone from scraped content (guarded)
    let detectedTone: string | null = null;
    try {
      if (cleanedScraped.length >= 80) {
        const tonePrompt = `
Pick one label: friendly | direct | bold | professional | casual | inspirational | playful.
Return only the label, no extra text.

Content:
${cleanedScraped.slice(0, 4800)}
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
      } else {
        detectedTone = 'professional';
      }
      console.log('🧠 Detected Tone:', detectedTone);
    } catch (toneErr) {
      console.error('❌ Tone detection failed:', toneErr);
    }

    const botData: any = {
      user_id: user.id,
      bot_name: botName.trim(),
      description: businessInfo?.description ?? '', // optional
      urls: urls.join('\n'),
      scraped_content: cleanedScraped,
      qa: Array.isArray(qaPairs) ? qaPairs : [],   // optional
      logo_url: logoUrl || null,
    };

    if (detectedTone) {
      botData.tone = detectedTone;
    }

    const { data: newBot, error } = await supabase
      .from('bots')
      .insert([botData])
      .select('id')
      .single();

    if (error) {
      console.error('INSERT ERROR:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!newBot?.id) {
      return NextResponse.json({ success: false, error: 'Failed to create bot' }, { status: 500 });
    }

    try {
      const calendarUrl = `/book?botId=${newBot.id}&embed=1`;
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

    try {
      const proto = req.headers.get('x-forwarded-proto') ?? 'https';
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      const baseUrl = host ? `${proto}://${host}` : '';

      if (baseUrl) {
        const embedRes = await fetch(`${baseUrl}/api/embed-chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_id: newBot.id }),
        });
        console.log('📡 Embed-chunks response:', await embedRes.text());
      } else {
        console.warn('⚠️ Could not resolve baseUrl for embed-chunks call.');
      }
    } catch (embedErr) {
      console.error('❌ Failed to call /api/embed-chunks:', embedErr);
    }

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
