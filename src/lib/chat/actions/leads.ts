// src/lib/chat/actions/leads.ts
import { capName, normalizeEmail, isEmail } from '../utils/text';
import { isLikelyCaptureInput, lastCaptureIndex, getLastMeaningfulUserText } from '../utils/history';

type LeadPayload = {
  bot_id: string;
  conversation_id: string;
  source: 'chat';
  name: string | null;
  email: string | null;
  message: string | null;
  user_id: string | null;
};

/** Post the lead to your /api/leads integrations endpoint (same logic you had inline). */
export async function postLeadToIntegrations(
  req: Request,
  payload: { botId: string; name: string; email: string; message: string }
) {
  const originHeader = (req.headers as any).get?.('origin') || '';
  const hostHeader = (req.headers as any).get?.('host') || '';
  const base =
    process.env.PUBLIC_SITE_URL ||
    originHeader ||
    (hostHeader ? `http://${hostHeader}` : 'http://localhost:3000');

  try {
    const res = await fetch(`${base}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: payload.botId,
        name: payload.name,
        email: payload.email,
        message: payload.message,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[integrations] /api/leads non-200:', res.status, text?.slice(0, 300));
    } else {
      console.log('[integrations] /api/leads OK:', text?.slice(0, 300));
    }
  } catch (e) {
    console.error('[integrations] /api/leads fetch failed:', e);
  }
}

/** Pick a safe, meaningful user message (not email/phone/one-word acks) to store with the lead. */
function chooseFirstMeaningful(
  history: { role: 'user' | 'assistant'; content: string }[],
  currentUserLast: string
) {
  const looksLikePhone = (s: string) => /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
  const isShortAck = (s: string) =>
    /\b(yes|yeah|yep|sure|ok|okay|please|no|nah|nope|thanks?|thank you|cheers)\b/i.test(
      String(s || '').trim()
    );

  // 1) first real user sentence from the start
  for (const m of history) {
    if (m.role !== 'user') continue;
    const t = String(m.content || '').trim();
    if (!t) continue;
    if (isEmail(t) || looksLikePhone(t) || isLikelyCaptureInput(t) || isShortAck(t)) continue;
    return t;
  }
  // 2) fallback: last meaningful before the most recent capture ask
  const idx = lastCaptureIndex(history as any);
  if (idx !== -1) {
    const fb = getLastMeaningfulUserText(history.slice(0, idx) as any, currentUserLast);
    if (fb && !isEmail(fb) && !looksLikePhone(fb) && !isLikelyCaptureInput(fb) && !isShortAck(fb)) {
      return fb.trim();
    }
  }
  // 3) final fallback: whatever we think is the last meaningful
  const last = getLastMeaningfulUserText(history as any, currentUserLast);
  if (last && !isEmail(last) && !looksLikePhone(last) && !isLikelyCaptureInput(last) && !isShortAck(last)) {
    return last.trim();
  }
  return '';
}

/**
 * Consolidated “email-turn” lead save:
 * - chooses a safe message
 * - upserts to `leads` (Supabase admin client)
 * - posts to /api/leads integrations
 */
export async function saveEmailTurnLead(opts: {
  admin: any;
  req: Request;
  botId: string;
  conversation_id: string;
  user_auth_id?: string | null;
  userLast: string; // the email the user just typed
  resolvedName?: string | null;
  recentHistory: { role: 'user' | 'assistant'; content: string }[];
}) {
  const {
    admin,
    req,
    botId,
    conversation_id,
    user_auth_id = null,
    userLast,
    resolvedName = null,
    recentHistory,
  } = opts;

  const safeMessage = chooseFirstMeaningful(recentHistory, userLast);

  const leadPayload: LeadPayload = {
    bot_id: botId,
    conversation_id,
    source: 'chat',
    name: resolvedName ? capName(resolvedName) : null,
    email: normalizeEmail(userLast),
    message: safeMessage ? safeMessage.slice(0, 500) : null,
    user_id: user_auth_id || null,
  };

  try {
    // post to external integrations
    await postLeadToIntegrations(req, {
      botId,
      name: leadPayload.name || '',
      email: leadPayload.email || '',
      message: leadPayload.message || '',
    });

    // upsert into DB
    const { error: leadErr } = await admin
      .from('leads')
      .upsert(leadPayload, { onConflict: 'bot_id,conversation_id' });

    if (leadErr) {
      console.error('[email-turn save lead] upsert error:', leadErr.message, leadPayload);
    } else {
      console.log('[email-turn save lead] saved', {
        conversation_id,
        message_preview: (leadPayload.message || '').slice(0, 120),
      });
    }
  } catch (e: any) {
    console.error('[email-turn save lead] threw:', e?.message || String(e));
  }
}
