import puppeteer from 'puppeteer'

export async function scrapeBlogContent(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true }) // ✅ FIXED: use boolean, not "new"
  const page = await browser.newPage()

  await page.goto(url, { waitUntil: 'networkidle2' })

  const content = await page.evaluate(() => {
    const articles = document.querySelectorAll('article, .blog-post, .post, .entry-content')
    return Array.from(articles)
      .map(el => (el as HTMLElement).innerText) // ✅ FIXED: cast to HTMLElement
      .join('\n\n')
  })

  await browser.close()
  return content
}
