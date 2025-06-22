import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { url, description, questions, answers } = await req.json();

  const { data, error } = await supabase
    .from('bots')
    .update({
      url,
      description,
      questions,
      answers
    })
    .order('created_at', { ascending: false }) // optional
    .limit(1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
