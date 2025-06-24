import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const bot_id = searchParams.get('bot_id')

  if (!bot_id) {
    return NextResponse.json({ error: 'Missing bot_id' }, { status: 400 })
  }

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('id', bot_id)
    .eq('user_email', session.user.email)
    .single()

  if (botError || !bot) {
    return NextResponse.json({ error: 'Unauthorized bot access' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('bot_knowledge_files')
    .select('file_name, file_path, uploaded_at')
    .eq('bot_id', bot_id)
    .order('uploaded_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ files: data })
}
