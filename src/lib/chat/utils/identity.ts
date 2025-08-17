import { normalizeEmail } from './text';

export function isBadNameToken(text: string) {
  return /\b(yes|yeah|yep|ok|okay|please|no|nah|nope|not now|later|maybe|thanks|thank you)\b/i.test(String(text || '').trim());
}
export function looksLikeName(text: string) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/[?!.]/.test(s)) return false;
  if (/\b(when|how|what|where|who|why|which|can|could|would|should|cost|price|book|schedule|today|tomorrow|clean|came)\b/i.test(s)) return false;
  const parts = s.split(/\s+/);
  if (parts.length === 0 || parts.length > 3) return false;
  if (!parts.every(w => /^[\p{L}][\p{L}'-]{1,19}$/u.test(w))) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(s)) || isBadNameToken(s)) return false;
  return true;
}
export function tryExtractInlineName(text: string): string | null {
  const s = String(text || '').trim();
  const m =
    s.match(/\b(?:my\s+name\s+is|name\s*[:=]\s*|i['’]m|i am|it's|it is|this is)\s+([\p{L}][\p{L}' -]{1,40})\b/iu) ||
    s.match(/^(?:yes|yeah|yep|sure|ok(?:ay)?)\s*,?\s+([\p{L}][\p{L}' -]{1,40})\s*$/iu) ||
    s.match(/\bis\s+([A-Z][\p{L}' -]{1,40})\b/u);
  const cand = m?.[1]?.trim();
  return cand && looksLikeName(cand) ? cand : null;
}
export function getProvisionalName(history: { role: string; content: string }[], lastAssistantText: string, userLast: string) {
  const askedNameRe = /your name|put this under your name|can i take your name|what'?s your name/i;
  if (askedNameRe.test(lastAssistantText)) {
    const inline = tryExtractInlineName(userLast);
    if (inline) return inline;
  }
  for (let i = history.length - 2; i >= 0; i--) {
    const a = history[i];
    const u = history[i + 1];
    if (a?.role === 'assistant' && askedNameRe.test(String(a?.content || '')) && u?.role === 'user' && looksLikeName(String(u?.content || ''))) {
      return String(u.content).trim();
    }
  }
  return null;
}
