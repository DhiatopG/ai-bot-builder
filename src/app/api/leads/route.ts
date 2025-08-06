import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  // Get all bots owned by this user
  const { data: bots, error: botError } = await supabase
    .from('bots')
    .select('id')
    .eq('user_id', user_id)

  if (botError || !bots) {
    return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 })
  }

  const botIds = bots.map((b) => b.id)

  // Fetch all leads linked to those bots
  const { data: leads, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .in('bot_id', botIds)
    .order('created_at', { ascending: false })

  if (leadError) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  return NextResponse.json({ leads })
}
