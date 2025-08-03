import { scrapeBlogContent } from '@/lib/scrapeBlogContent'

export async function POST(req: Request) {
  const { url, botId } = await req.json()

  if (!url || !botId) {
    return Response.json({ success: false, error: 'Missing url or botId' }, { status: 400 })
  }

  const scraped = await scrapeBlogContent(url)

  if (!scraped.success) {
    return Response.json({ success: false, error: 'No blog content found' }, { status: 404 })
  }

  return Response.json({ ...scraped })
}
