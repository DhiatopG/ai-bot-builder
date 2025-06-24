import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('email', session.user.email)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase
    .from('bots')
    .select('id, created_at, user_id, urls, description, custom_qa, nocodb_api_url, nocodb_api_key, nocodb_table, bot_name, scraped_content, qa, logo_url, calendar_url')
    .order('created_at', { ascending: false })

  return NextResponse.json(data)
}
