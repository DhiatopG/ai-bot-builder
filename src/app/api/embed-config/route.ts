import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bot_id = searchParams.get('bot_id')
  if (!bot_id) return NextResponse.json({ error: 'missing bot_id' }, { status: 400 })

  const supabase = await createServerClient()

  // Only select logo_url since that column exists in your table
  const { data, error } = await supabase
    .from('bots')
    .select('logo_url')          // ← keep this minimal
    .eq('id', bot_id)
    .single()

  if (error || !data) {
    return NextResponse.json({}) // embed falls back to blue icon
  }

  // Infer the rest: show logo if we have one
  const cfg = {
    logo_url: data.logo_url || null,
    bubble_style: data.logo_url ? 'logo' : 'icon',
    logo_ring: true, // default ring for light logos
  }

  const res = NextResponse.json(cfg)
  res.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  return res
}
