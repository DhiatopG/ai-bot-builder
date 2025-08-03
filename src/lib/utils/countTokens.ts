import { encoding_for_model, get_encoding } from 'tiktoken'

let enc: ReturnType<typeof encoding_for_model>

try {
  enc = encoding_for_model('gpt-4o')
} catch {
  enc = get_encoding('cl100k_base')
}

export function countTokens(text: string): number {
  if (!text) return 0
  return enc.encode(text).length
}
