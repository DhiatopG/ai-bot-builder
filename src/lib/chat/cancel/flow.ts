// src/lib/chat/cancel/flow.ts
import { normalizeEmail } from '../utils/text';
import { respondAndLog } from '../actions/respondAndLog';
import {
  looksLikeCancelCTA,
  parseCancelId,
  apiBaseFromEnv,
  userWantsCancel,
  formatCancelCtas,
  looksLikePhone,
} from './helpers';

// ------------- 1) Early CTA handler: "cancel_appt:<UUID>" -------------
export async function handleCancelCTA({
  req,
  admin,
  botId,
  conversation_id,
  user_auth_id,
  userLast,
}: {
  req: Request;
  admin: any;
  botId: string;
  conversation_id?: string;
  user_auth_id?: string | null;
  userLast: string;
}) {
  if (!looksLikeCancelCTA(userLast)) return null;

  const convId = conversation_id ?? '';
  const apptId = parseCancelId(userLast);
  if (!apptId) {
    const assistantText = 'Which appointment would you like to cancel?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText }
    );
  }

  const API_BASE = apiBaseFromEnv(req);
  try {
    const r = await fetch(`${API_BASE}/api/appointments/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appointment_id: apptId, actor: 'bot' }),
    });
    const ok = r.ok;
    const assistantText = ok
      ? 'All set — your appointment has been canceled. Want to see new times?'
      : 'I tried to cancel but something went wrong. Want me to show available times instead?';

    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  } catch {
    const assistantText =
      'I couldn’t reach the cancel endpoint just now. Want me to show available times instead?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  }
}

// ------------- 2) Fast path: user asks to cancel -------------
export async function maybeOfferCancelButtons({
  admin,
  botId,
  conversation_id,
  user_auth_id,
  userLast,
  entities,
  visitor_email,
}: {
  admin: any;
  botId: string;
  conversation_id?: string;
  user_auth_id?: string | null;
  userLast: string;
  entities?: any;
  visitor_email?: string | null;
}) {
  if (!userWantsCancel(userLast)) return null;

  const convId = conversation_id ?? '';
  const email = entities?.email ? normalizeEmail(entities.email) : (visitor_email ? normalizeEmail(visitor_email) : null);
  const phone = entities?.phone || (looksLikePhone(userLast) ? userLast : null);

  if (!email && !phone) {
    const assistantText = 'I can help. What email or phone did you use to book?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText }
    );
  }

  const nowIso = new Date().toISOString();
  const orCond = [email ? `invitee_email.eq.${email}` : '', phone ? `invitee_phone.eq.${phone}` : '']
    .filter(Boolean)
    .join(',');
  const { data: appts, error: err } = await admin
    .from('appointments')
    .select('id, starts_at, timezone, status')
    .eq('bot_id', botId)
    .in('status', ['booked', 'confirmed'])
    .or(orCond)
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(5);

  if (err) {
    const assistantText =
      'I couldn’t look up your appointment just now. Want me to show available times instead?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  }

  if (!appts || appts.length === 0) {
    const assistantText =
      'I didn’t find any upcoming appointments under that contact. Want me to show available times instead?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  }

  const ctas = formatCancelCtas(appts);
  const assistantText = 'Which appointment would you like to cancel?';
  return respondAndLog(
    admin,
    { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
    { answer: assistantText, ctas }
  );
}

// ------------- 3) Continuation: user sent email after our prompt -------------
export async function maybeContinueCancelWithEmail({
  admin,
  botId,
  conversation_id,
  user_auth_id,
  userLast,
  lastAssistantText,
}: {
  admin: any;
  botId: string;
  conversation_id?: string;
  user_auth_id?: string | null;
  userLast: string;
  lastAssistantText: string;
}) {
  // Only trigger if we literally asked for contact to cancel
  const weAskedForContact = /what email or phone did you use to book\??/i.test(lastAssistantText || '');
  if (!weAskedForContact) return null;

  const convId = conversation_id ?? '';
  const email = normalizeEmail(userLast);
  const phone = looksLikePhone(userLast) ? userLast : null;
  if (!email && !phone) return null;

  const nowIso = new Date().toISOString();
  const orCond = [email ? `invitee_email.eq.${email}` : '', phone ? `invitee_phone.eq.${phone}` : '']
    .filter(Boolean)
    .join(',');
  const { data: appts, error: err } = await admin
    .from('appointments')
    .select('id, starts_at, timezone, status')
    .eq('bot_id', botId)
    .in('status', ['booked', 'confirmed'])
    .or(orCond)
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(5);

  if (err) {
    const assistantText =
      'I couldn’t look up your appointment just now. Want me to show available times instead?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  }

  if (!appts || appts.length === 0) {
    const assistantText =
      'I didn’t find any upcoming appointments under that contact. Want me to show available times instead?';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'See available times' }] }
    );
  }

  const ctas = formatCancelCtas(appts);
  const assistantText = 'Which appointment would you like to cancel?';
  return respondAndLog(
    admin,
    { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
    { answer: assistantText, ctas }
  );
}
