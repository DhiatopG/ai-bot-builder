import { NextResponse } from 'next/server';
import { ratelimit } from '@/lib/rateLimiter';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { orchestrateChat } from '@/lib/chat';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const supabase = await createServerClient();
  const admin = await createAdminClient();

  try {
    const result = await orchestrateChat({ req, body, supabase, admin });
    return result;
  } catch (err) {
    console.error('[api/chat FATAL]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
