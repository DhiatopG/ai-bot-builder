import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { bot_id } = body;

  if (!bot_id || typeof bot_id !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid bot_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('bots')
    .delete()
    .eq('id', bot_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
