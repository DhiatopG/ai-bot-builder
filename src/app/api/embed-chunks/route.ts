import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { bot_id } = body

    if (!bot_id) {
      return NextResponse.json({ success: false, error: 'Missing bot_id' }, { status: 400 })
    }

    // Get scraped content
    const { data: bot, error: fetchError } = await supabase
      .from('bots')
      .select('scraped_content')
      .eq('id', bot_id)
      .single()

    if (fetchError || !bot?.scraped_content) {
      return NextResponse.json({ success: false, error: 'Bot not found or has no scraped content' }, { status: 404 })
    }

    const text = bot.scraped_content.slice(0, 150000)

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    })
    const chunks = await splitter.createDocuments([text])

    console.log(`🧩 Generated ${chunks.length} chunks for bot ${bot_id}`)

    const inputs = chunks.map(c => c.pageContent)
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputs
    })

    const embeddings = embeddingRes.data.map(item => item.embedding)

    const chunksToInsert = chunks.map((chunk, i) => ({
      id: uuidv4(),
      bot_id,
      text: chunk.pageContent,
      content: chunk.pageContent,
      tokens: chunk.pageContent.split(/\s+/).length,
      index: i,
      embedding: embeddings[i],
      created_at: new Date().toISOString()
    }))

    console.log('📦 Inserting first 2 chunks:', chunksToInsert.slice(0, 2))

    const { error: insertError } = await supabase
      .from('chunks')
      .insert(chunksToInsert)

    if (insertError) {
      console.error('❌ Insert chunks failed:', insertError.message)
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err: any) {
    console.error('❌ Embedding error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
