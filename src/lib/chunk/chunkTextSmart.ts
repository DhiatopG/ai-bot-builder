import { countTokens } from '@/lib/utils/countTokens'
import { v4 as uuidv4 } from 'uuid'

const MAX_TOKENS_PER_CHUNK = 800
const MIN_TOKENS_PER_CHUNK = 200
const OVERLAP_TOKENS = 200

export function chunkTextSmart(text: string, botId: string): {
  chunk_id: string
  bot_id: string
  text: string
  tokens: number
  index: number
}[] {
  const sentences = text
    .split(/(?<=[.?!])\s+/) // Split by sentence boundaries
    .map(s => s.trim())
    .filter(Boolean)

  const chunks = []
  let currentChunk: string[] = []
  let currentTokens = 0
  let chunkIndex = 0

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence)

    // If sentence is too big, skip it
    if (sentenceTokens > MAX_TOKENS_PER_CHUNK) continue

    // If adding sentence will overflow max, finalize current chunk
    if (currentTokens + sentenceTokens > MAX_TOKENS_PER_CHUNK) {
      const chunkText = currentChunk.join(' ')
      const tokenCount = countTokens(chunkText)

      if (tokenCount >= MIN_TOKENS_PER_CHUNK) {
        chunks.push({
          chunk_id: uuidv4(),
          bot_id: botId,
          text: chunkText,
          tokens: tokenCount,
          index: chunkIndex++
        })
      }

      // Start next chunk with overlap
      const overlap = []
      let overlapTokens = 0
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const tok = countTokens(currentChunk[i])
        if (overlapTokens + tok > OVERLAP_TOKENS) break
        overlap.unshift(currentChunk[i])
        overlapTokens += tok
      }

      currentChunk = [...overlap]
      currentTokens = overlapTokens
    }

    currentChunk.push(sentence)
    currentTokens += sentenceTokens
  }

  // Push the last chunk
  const lastChunkText = currentChunk.join(' ')
  const lastTokenCount = countTokens(lastChunkText)
  if (lastTokenCount >= MIN_TOKENS_PER_CHUNK) {
    chunks.push({
      chunk_id: uuidv4(),
      bot_id: botId,
      text: lastChunkText,
      tokens: lastTokenCount,
      index: chunkIndex++
    })
  }

  return chunks
}
