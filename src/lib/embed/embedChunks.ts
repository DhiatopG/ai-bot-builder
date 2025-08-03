import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'
import { Database } from '@/lib/supabase/types' // adjust path if needed

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function embedChunks(chunks: {
  chunk_id: string
  bot_id: string
  text: string
  tokens: number
  index: number
}[]) {
  for (const chunk of chunks) {
    try {
      // Get the vector from OpenAI
      const embeddingRes = await openai.embeddings.create({
        input: chunk.text,
        model: 'text-embedding-3-small'
      })

      const embedding = embeddingRes.data[0].embedding

      // ✅ Convert embedding to string for storage
      const embeddingStr = JSON.stringify(embedding)

      // Store in Supabase
      const { error } = await supabase.from('chunks').insert({
        bot_id: chunk.bot_id,
        text: chunk.text,
        tokens: chunk.tokens,
        index: chunk.index,
        embedding: embeddingStr
      })

      if (error) {
        console.error(`❌ Failed to insert chunk ${chunk.chunk_id}`, error)
      } else {
        console.log(`✅ Embedded + stored chunk ${chunk.chunk_id}`)
      }
    } catch (err) {
      console.error(`❌ Embedding failed for chunk ${chunk.chunk_id}`, err)
    }
  }
}
