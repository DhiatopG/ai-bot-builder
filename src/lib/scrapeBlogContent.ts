import puppeteer from 'puppeteer'

export async function scrapeBlogContent(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

  // Scroll until no more height changes (lazy load all posts)
  let previousHeight = 0
  for (let i = 0; i < 20; i++) {
    const newHeight = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight)
      return document.body.scrollHeight
    })
    if (newHeight === previousHeight) break
    previousHeight = newHeight
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Extract blog post links
  const blogPostLinks: string[] = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'))
    const hrefs = anchors
      .map(a => a.href.trim())
      .filter(href =>
        href &&
        !href.includes('#') &&
        /(blog|post|article|entry)/i.test(href) &&
        !/(category|tag|archive|author|page=|utm_|\/(categories|tags|authors)\b)/i.test(href)
      )
    return Array.from(new Set(hrefs))
  })

  console.log(`🔗 Found ${blogPostLinks.length} blog links`)

  const fullContents: string[] = []
  const seenHashes = new Set<string>()

  for (const postUrl of blogPostLinks) {
    if (fullContents.join('\n\n---\n\n').length >= 150000) break

    try {
      const postPage = await browser.newPage()
      await postPage.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 })

      const { title, content } = await postPage.evaluate(() => {
        const getText = (selector: string) =>
          Array.from(document.querySelectorAll(selector))
            .map(el => (el as HTMLElement).innerText.trim())
            .filter(Boolean)
            .join('\n')

        const cleanText = (text: string) => {
          const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(line =>
              line.length > 10 &&
              !/^(likes?|views?|comments?|share|posted|by|author|subscribe|read more|all posts|minutes to read|©|related articles)$/i.test(line)
            )
          const seen = new Set<string>()
          return lines
            .filter(line => {
              if (seen.has(line.toLowerCase())) return false
              seen.add(line.toLowerCase())
              return true
            })
            .join('\n')
            .replace(/\n{2,}/g, '\n\n')
            .trim()
        }

        const titleEl =
          document.querySelector('h1, .post-title, .entry-title')?.textContent?.trim() || ''

        const contentSelectors = [
          'article',
          '.rich-text',
          '.post-content',
          'div[class*="content"]',
          'div[class*="blog"]'
        ]

        let raw = ''
        for (const sel of contentSelectors) {
          const block = getText(sel)
          if (block.length > 200) {
            raw = block
            break
          }
        }

        return {
          title: cleanText(titleEl),
          content: cleanText(raw)
        }
      })

      await postPage.close()

      const combined = `${title}\n\n${content}`.trim()

      // Skip empty or exact duplicate entries
      const hash = Buffer.from(combined.toLowerCase()).toString('base64').slice(0, 40)
      if (combined && !seenHashes.has(hash)) {
        seenHashes.add(hash)
        fullContents.push(combined)
        console.log(`📝 Scraped: ${postUrl} (${combined.length} characters)`)
      } else {
        console.log(`⚠️ Skipped duplicate or empty: ${postUrl}`)
      }
    } catch (err) {
      console.error(`❌ Failed scraping ${postUrl}`, err)
    }
  }

  await browser.close()

  const result = fullContents
    .join('\n\n---\n\n')
    .trim()
    .slice(0, 150000)

  console.log(`✅ Scraped ${fullContents.length} blog posts`)
  console.log(`🧠 Total scraped characters: ${result.length}`)

  return result || 'No blog content found.'
}
