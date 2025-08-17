export function preview(s: unknown, n = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export function normalizeEmail(text: string) {
  return String(text || '').trim().replace(/\s+/g, '');
}
export function isEmail(text: string) {
  const s = normalizeEmail(text);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function capName(s: string | null | undefined) {
  const t = String(s || '').trim();
  if (!t) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function isClarifyingQuestionReply(s: string) {
  const t = String(s || '').trim();
  if (!t) return false;
  return /\?/.test(t) ||
         /\b(could you|can you|would you|what|which|when|where|how|tell me more|please describe|give me more detail|are you|is it)\b/i.test(t);
}

export function hasBookingLanguage(s: string) {
  const t = String(s || '').toLowerCase();
  return /\b(book|schedule|appointment|calendar|pick a time|choose a time)\b/.test(t);
}
export function stripEarlyBookingLanguage(s: string) {
  const parts = String(s || '').split(/(?<=[.!?])\s+/);
  return parts.filter(p => !hasBookingLanguage(p)).join(' ');
}
