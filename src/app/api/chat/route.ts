// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { ratelimit } from '@/lib/rateLimiter';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { orchestrateChat } from '@/lib/chat';

const ORIGIN = 'https://www.in60second.net';

// ---------- CORS helpers ----------
function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ORIGIN);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Vary', 'Origin');
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', ORIGIN);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type, authorization, x-requested-with');
  res.headers.set('Vary', 'Origin');
  return res;
}

// ---------- POST /api/chat ----------
export async function POST(req: Request) {
  // 1) Rate limit early
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return withCors(NextResponse.json({ error: 'Too many requests' }, { status: 429 }));
  }

  // 2) Parse JSON body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }));
  }

  // 3) --- Normalize incoming payload to a single internal shape ---
  // Accept many identifiers; standardize to bot_id
  let bot_id: string | undefined =
    body.bot_id ??
    body.botId ??
    body.bot?.id ??
    body.context?.bot_id ??
    body.context?.botId ??
    body.payload?.bot_id ??
    body.payload?.botId ??
    body.user_id; // some clients send user_id as the bot UUID

  if (typeof bot_id === 'string') bot_id = bot_id.trim();

  // Accept many message shapes; standardize to messages[]
  const singleMessage: string | undefined =
    body.message ??
    body.question ??
    body.text ??
    body.input ??
    body.prompt ??
    body.query ??
    body.user_message ??
    body.content;

  // Normalize provided messages array (supports multiple styles)
  let messages: Array<{ role: string; content: string }> | undefined;
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    messages = body.messages
      .map((m: any) => {
        if (typeof m === 'string') return { role: 'user', content: String(m) };
        if (m && typeof m === 'object') {
          if (m.role && m.content) return { role: String(m.role), content: String(m.content) };
          if (m.type === 'text' && m.text) return { role: 'user', content: String(m.text) };
        }
        return null;
      })
      .filter(Boolean) as Array<{ role: string; content: string }>;
  }

  // Optional history turns (assistant/system/user), keep order
  let history: Array<{ role: string; content: string }> | undefined;
  if (Array.isArray(body.history) && body.history.length > 0) {
    history = body.history
      .map((h: any) => {
        if (h && typeof h === 'object' && h.content) {
          const role = typeof h.role === 'string' ? h.role : 'assistant';
          return { role, content: String(h.content) };
        }
        return null;
      })
      .filter(Boolean) as Array<{ role: string; content: string }>;
  }

  // Build canonical messages[]
  const normalizedMessages: Array<{ role: string; content: string }> = [];
  if (history?.length) normalizedMessages.push(...history);
  if (messages?.length) {
    normalizedMessages.push(...messages);
  } else if (typeof singleMessage === 'string' && singleMessage.trim()) {
    normalizedMessages.push({ role: 'user', content: singleMessage.trim() });
  }

  // Canonical envelope used internally
  const normalized = {
    bot_id,
    messages: normalizedMessages,
    conversation_id: body.conversation_id ?? body.conversationId ?? body.session_id ?? body.sessionId,
    meta: {
      ...(body.meta ?? {}),
      is_after_hours: body.is_after_hours ?? body.meta?.is_after_hours,
      weekday: body.weekday ?? body.meta?.weekday,
      ua: body.meta?.ua ?? req.headers.get('user-agent') ?? undefined,
      debug: body.debug ?? body.meta?.debug ?? false,
      origin: ORIGIN,
    },
    // keep original for reference
    _raw: body,
  };

  // 4) Tiny compatibility shim for your orchestrator (expects user_id + question)
  const latestUserText =
    (normalized.messages.length ? normalized.messages[normalized.messages.length - 1]?.content : '') ||
    body.message ||
    body.question ||
    body.text ||
    '';

  const bodyCompat = {
    ...normalized,
    user_id: body.user_id ?? normalized.bot_id, // orchestrator reads user_id as bot id
    question: body.question ?? String(latestUserText || '').trim(),
    history: history ?? undefined, // keep if client sent it (your orchestrator uses it)
  };

  if (!bodyCompat.user_id || !bodyCompat.question) {
    // Keep a clear error to help callers
    return withCors(
      NextResponse.json(
        { error: 'Missing required fields: bot_id/user_id and message/question' },
        { status: 400 },
      ),
    );
  }

  // 5) Create clients & call orchestrator
  const supabase = await createServerClient();
  const admin = await createAdminClient();

  try {
    const resp = await orchestrateChat({
      req,
      body: bodyCompat, // pass the compat payload your orchestrator expects
      supabase,
      admin,
    });

    if (resp instanceof NextResponse) {
      return withCors(resp);
    }
    return withCors(NextResponse.json(resp, { status: 200 }));
  } catch (err) {
    console.error('[api/chat FATAL]', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
