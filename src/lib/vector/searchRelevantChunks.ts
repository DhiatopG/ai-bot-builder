import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'
import type { Database } from '@/lib/supabase/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function searchRelevantChunks(botId: string, question: string, topK = 5) {
  try {
    // 1. Get embedding for the user's question
    const embeddingRes = await openai.embeddings.create({
      input: question,
      model: 'text-embedding-3-small'
    })

    const queryEmbedding = JSON.stringify(embeddingRes.data[0].embedding)

    // 2. Search Supabase `chunks` table for nearest matches (cosine similarity)
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: topK,
      input_bot_id: botId
    })

    if (error) {
      console.error('❌ Error searching chunks:', error)
      return []
    }

    return data // array of matched chunks
  } catch (err) {
    console.error('❌ Embedding or search failed:', err)
    return []
  }
}
