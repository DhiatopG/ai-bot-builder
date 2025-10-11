// src/lib/chat/actions/leads.ts

import { respondAndLog } from './respondAndLog';
import {
  hasDeliveredValueOnce,
  countCaptureAsks,
  lastCaptureIndex,
  lastNameAskIndex,
  declinedNameSinceAsk,
  type ChatHistory,
} from '../utils/history';

// ---------- Helpers (pure) ----------
function recentlyAskedCapture(history: ChatHistory | undefined, cooldownTurns = 4) {
  if (!history?.length) return false;
  const lastIdx = lastCaptureIndex(history);
  if (lastIdx === -1) return false;
  const distance = history.length - 1 - lastIdx;
  return distance >= 0 && distance < cooldownTurns;
}

function userJustDeclined(userLast: string) {
  return /\b(no|nah|nope|skip|not now|later|maybe)\b/i.test(String(userLast || ''));
}

function shouldSuppressNameAsk(history?: ChatHistory, maxAsks = 2, cooldownTurns = 4) {
  if (!history?.length) return false;
  const askedCount = countCaptureAsks(history);
  if (askedCount >= maxAsks) return true;

  const nameAskIdx = lastNameAskIndex(history);
  if (declinedNameSinceAsk(history, nameAskIdx)) return true;

  return recentlyAskedCapture(history, cooldownTurns);
}

function shouldSuppressEmailAsk(history?: ChatHistory, maxAsks = 2, cooldownTurns = 4) {
  if (!history?.length) return false;
  const askedCount = countCaptureAsks(history);
  if (askedCount >= maxAsks) return true;
  return recentlyAskedCapture(history, cooldownTurns);
}

// ---------- Public API (kept compatible) ----------
export function shouldOfferCaptureCTA({
  allowLeadCapture,
  canAskNow,
  everBookingFlow,
  lowIntentInfo,
  // Optional extras — safe defaults keep old call sites working
  history,
}: {
  allowLeadCapture: boolean;
  canAskNow: boolean;
  everBookingFlow: boolean;
  lowIntentInfo: boolean;
  history?: ChatHistory;
}) {
  // original guard
  const base = allowLeadCapture && canAskNow && !everBookingFlow && lowIntentInfo;
  if (!base) return false;

  // Don’t ask until we’ve given some value at least once
  if (history && !hasDeliveredValueOnce(history)) return false;

  // Simple cooldown: if we asked very recently, wait
  if (history && recentlyAskedCapture(history)) return false;

  return true;
}

export async function handlePostAnswerCapture({
  admin,
  botId,
  conversation_id,
  user_auth_id,
  userLast,
  intent,
  finalAnswer,
  nowHasName,
  nowHasEmailOrPhone,
  // Optional context for smarter throttling
  history,
}: {
  admin: any;
  botId: string;
  conversation_id: string;
  user_auth_id?: string | null;
  userLast: string;
  intent: string;
  finalAnswer: string;
  nowHasName: boolean;
  nowHasEmailOrPhone: boolean;
  history?: ChatHistory;
}) {
  // If user just declined, don’t ask again this turn.
  const declinedNow = userJustDeclined(userLast);

  // 1) Ask for NAME (only if we don’t already have it)
  if (!nowHasName) {
    if (!declinedNow && !shouldSuppressNameAsk(history)) {
      return respondAndLog(
        admin,
        {
          botId,
          conversation_id,
          user_auth_id,
          userLast,
          assistantText: finalAnswer,
          intent: String(intent ?? ''),
        },
        {
          answer: finalAnswer,
          cta_prompt: 'Can I take your name to tailor this for you?',
          ctas: [
            { id: 'lead_name_yes', label: 'Yes' },
            { id: 'lead_name_no', label: 'No' },
          ],
        }
      );
    }

    // Suppressed → just return the answer (no CTA)
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intent ?? '') },
      { answer: finalAnswer }
    );
  }

  // 2) Ask for EMAIL/PHONE (only if name exists but no contact yet)
  if (!nowHasEmailOrPhone) {
    if (!declinedNow && !shouldSuppressEmailAsk(history)) {
      return respondAndLog(
        admin,
        {
          botId,
          conversation_id,
          user_auth_id,
          userLast,
          assistantText: finalAnswer,
          intent: String(intent ?? ''),
        },
        {
          answer: finalAnswer,
          cta_prompt: 'Would you like to share your email so I can send details and next steps?',
          ctas: [
            { id: 'lead_email_yes', label: 'Yes' },
            { id: 'lead_email_no', label: 'No' },
          ],
        }
      );
    }

    // Suppressed → just return the answer (no CTA)
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intent ?? '') },
      { answer: finalAnswer }
    );
  }

  // 3) Nothing to ask — return null so caller can continue.
  return null;
}
