import { NextResponse } from 'next/server';
import { ratelimit } from '@/lib/rateLimiter';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { orchestrateChat } from '@/lib/chat';

const ORIGIN = 'https://www.in60second.net';

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ORIGIN);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Vary', 'Origin');
  return res;
}

export async function OPTIONS() {
  // CORS preflight
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', ORIGIN);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type, authorization, x-requested-with');
  res.headers.set('Vary', 'Origin');
  return res;
}

export async function POST(req: Request) {
  // Basic rate limit
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return withCors(NextResponse.json({ error: 'Too many requests' }, { status: 429 }));
  }

  // Parse JSON safely
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }));
  }

  // Accept multiple payload shapes from web/mobile clients
  const botId =
    body.botId ||
    body.bot_id ||
    body.bot ||
    body?.meta?.botId ||
    body?.context?.botId;

  const message =
    body.message ||
    body.text ||
    (Array.isArray(body.messages) ? body.messages.at(-1)?.content : undefined);

  if (!botId || !message) {
    return withCors(NextResponse.json({ error: 'Missing required fields' }, { status: 400 }));
  }

  // Normalize for your orchestrator
  const normalizedBody = { ...body, botId, message };

  const supabase = await createServerClient();
  const admin = await createAdminClient();

  try {
    const resp = await orchestrateChat({ req, body: normalizedBody, supabase, admin });

    // Ensure CORS headers even if orchestrator already returns a NextResponse
    if (resp instanceof NextResponse) {
      return withCors(resp);
    }
    return withCors(NextResponse.json(resp, { status: 200 }));
  } catch (err) {
    console.error('[api/chat FATAL]', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
