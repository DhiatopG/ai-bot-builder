// src/lib/chat/cancel/flow.ts
import { respondAndLog } from '../actions/respondAndLog';
import {
  looksLikeCancelCTA,
  parseCancelId,
  apiBaseFromEnv,
  userWantsCancel,
} from './helpers';

/**
 * Cancel flow: do NOT collect contact info.
 * Goal: push the booking iframe right away so the user can manage/cancel.
 */

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

  // Always pass a string to respondAndLog (fixes TS: string | undefined)
  const convId: string = String(conversation_id ?? '');

  const apptId = parseCancelId(userLast);
  if (!apptId) {
    const assistantText = 'Opening your appointment manager…';
    // Push iframe immediately
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'Manage my appointment' }] }
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
      : 'I tried to cancel but something went wrong. Opening the calendar so you can manage it right away.';

    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'Open calendar' }] }
    );
  } catch {
    const assistantText =
      'I couldn’t reach the cancel endpoint just now. Opening the calendar so you can manage it right away.';
    return respondAndLog(
      admin,
      { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
      { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'Open calendar' }] }
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
}: {
  admin: any;
  botId: string;
  conversation_id?: string;
  user_auth_id?: string | null;
  userLast: string;
}) {
  if (!userWantsCancel(userLast)) return null;

  // No contact collection: push iframe immediately
  const convId: string = String(conversation_id ?? '');
  const assistantText = 'Sure — use the calendar below to cancel or reschedule.';
  return respondAndLog(
    admin,
    { botId, conversation_id: convId, user_auth_id, userLast, assistantText, intent: 'cancel' },
    { answer: assistantText, ctas: [{ id: 'open_calendar_now', label: 'Open calendar' }] }
  );
}

// ------------- 3) Continuation: user sent contact after our prompt -------------
// We no longer prompt for contact, so this becomes a no-op.
export async function maybeContinueCancelWithEmail({
  // Intentionally unused — prefix with "_" to satisfy no-unused-vars rule
  admin: _admin,
  botId: _botId,
  conversation_id: _conversation_id,
  user_auth_id: _user_auth_id,
  userLast: _userLast,
  lastAssistantText: _lastAssistantText,
}: {
  admin: any;
  botId: string;
  conversation_id?: string;
  user_auth_id?: string | null;
  userLast: string;
  lastAssistantText: string;
}) {
  // Since we don't ask for email/phone anymore, do nothing.
  return null;
}
