export function looksLikeShortNudge(t: string) {
  const s = (t || '').trim();
  if (!s) return false;
  if (/[?.!]/.test(s)) return false;
  const words = s.split(/\s+/);
  return words.length <= 2;
}

export const lowSignalAck = /\b(yes|yeah|yep|sure|ok|okay|please|more info|more information|tell me more|nothing|no thanks?|no thank you|that'?s all|all good|no more|nope|nah|i'?m good|im good)\b/i;

export const lowSignalKeywords = /\b(price|cost|fees?|hours?|address|location|directions?|book(ing)?|schedule|time|when|where|phone|email|website|link|info|details?)\b/i;

export function isLowSignalInput(userLast: string, isLikelyCaptureInput?: (t: string) => boolean) {
  return Boolean(
    (isLikelyCaptureInput && isLikelyCaptureInput(userLast)) ||
      lowSignalAck.test(userLast) ||
      lowSignalKeywords.test(userLast) ||
      looksLikeShortNudge(userLast)
  );
}
