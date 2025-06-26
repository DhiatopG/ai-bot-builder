import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  const bot_id = formData.get('bot_id') as string

  if (!file || !bot_id) {
    return NextResponse.json({ error: 'Missing file or bot_id' }, { status: 400 })
  }

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('id', bot_id)
    .eq('user_email', user.email)
    .single()

  if (botError || !bot) {
    return NextResponse.json({ error: 'Unauthorized bot access' }, { status: 403 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  if (!['application/pdf', 'text/plain'].includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${uuidv4()}-${file.name}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('knowledge-base')
    .upload(filename, buffer, {
      contentType: file.type
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { error: insertError } = await supabase.from('bot_knowledge_files').insert([
    {
      bot_id,
      file_name: file.name,
      file_path: uploadData?.path,
      file_type: file.type,
      uploaded_at: new Date().toISOString()
    }
  ])

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
