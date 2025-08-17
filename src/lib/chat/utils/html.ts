import * as cheerio from 'cheerio';

export function cleanHtml(input: string): string {
  const $ = cheerio.load(input || '');
  $('script, style').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}
