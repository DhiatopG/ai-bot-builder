const DEBUG_CHAT_LEADS = true;

export function logHistory(label: string, items: { role: string; content: string }[]) {
  if (!DEBUG_CHAT_LEADS) return;
  const last = items.slice(-6).map((m, i) => ({
    i: items.length - 6 + i,
    role: m.role,
    content: String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  }));
  console.log(`[chat] ${label} last-6:`, last);
}

export function isGreeting(s: string) {
  const t = String(s || '').toLowerCase().trim();
  if (/how can i help (you|ya) today\??$/.test(t)) return true;
  if (/^(hi|hello|hey)\b.*$/.test(t) && t.length <= 60 && /help.*today\??$/.test(t)) return true;
  if (/^welcome\b/.test(t)) return true;
  return false;
}

export function isCapturePromptText(s: string) {
  const t = String(s || '').toLowerCase();
  return /can i take your name|what'?s your name|your email|best email|keep you posted|share email|all set, .*saved your email/.test(t);
}

export function hasDeliveredValueOnce(history: { role: string; content: string }[]) {
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    const prev = history[i - 1];
    if (prev?.role !== 'user') continue;
    const c = String(m.content || '').trim();
    if (!c) continue;
    if (isGreeting(c)) continue;
    if (isCapturePromptText(c)) continue;
    if (/calendar opened here/i.test(c)) continue;
    return true;
  }
  return false;
}

// === SIMPLE 3-STEP ASK CONTROLS (count + cooldown via history) ===
export function countCaptureAsks(history: { role: string; content: string }[]) {
  return history.filter((m) => m.role === 'assistant' && isCapturePromptText(String(m.content || ''))).length;
}

export function lastCaptureIndex(history: { role: string; content: string }[]) {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === 'assistant' && isCapturePromptText(String(m.content || ''))) return i;
  }
  return -1;
}

export function lastNameAskIndex(history: { role: string; content: string }[]) {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === 'assistant' && /your name|put this under your name|can i take your name|what'?s your name/i.test(String(m.content || ''))) {
      return i;
    }
  }
  return -1;
}

export function declinedNameSinceAsk(history: { role: string; content: string }[], askIdx: number) {
  if (askIdx === -1) return false;
  for (let j = askIdx + 1; j < history.length; j++) {
    const m = history[j];
    if (m.role === 'assistant') break;
    if (m.role === 'user' && /\b(no|nah|nope|not now|later|maybe)\b/i.test(String(m.content || ''))) {
      return true;
    }
  }
  return false;
}

export function canConsiderNameFromUser(history: { role: string; content: string }[], userLast: string) {
  const askIdx = lastNameAskIndex(history);
  if (askIdx === -1) {
    return /\b(my\s+name\s+is|name\s*[:=]|i['’]m|i am|this is)\b/i.test(userLast);
  }
  const distance = history.length - askIdx;
  if (distance > 2) return false;
  if (declinedNameSinceAsk(history, askIdx)) return false;
  return true;
}

export function isLikelyCaptureInput(s: string) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (/\b(yes|yeah|yep|ok|okay|no|nah|nope|please|thanks|thank you)\b/i.test(t)) return true;
  return false;
}

export function getLastMeaningfulUserText(historyList: { role: string; content: string }[], lastInput: string) {
  const combined = [...historyList, { role: 'user', content: lastInput }];
  for (let i = combined.length - 1; i >= 0; i--) {
    const m = combined[i];
    const c = String(m?.content ?? '').trim();
    if (m.role === 'user' && c && !isLikelyCaptureInput(c)) return c;
  }
  return '';
}

// --- Hybrid mode helpers (append at the end of history.ts) ---

export type Turn = { role: 'user' | 'assistant'; content: string };
export type ChatHistory = Turn[];

/** Return the last K turns (user/assistant), newest last. */
export function lastKTurns(history: ChatHistory, k = 8): ChatHistory {
  const h = Array.isArray(history) ? history : [];
  return h.slice(Math.max(0, h.length - k));
}

/** Super-cheap inline summary for adding brief context to the system prompt. */
export function summarizeHistoryInline(history: ChatHistory, maxChars = 900): string {
  const text = (Array.isArray(history) ? history : [])
    .map((t) => (t.role === 'user' ? `User: ${t.content}` : `Assistant: ${t.content}`))
    .join('\n')
    .slice(-maxChars);
  return text;
}
