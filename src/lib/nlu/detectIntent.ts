// src/lib/nlu/detectIntent.ts

// Lightweight, fast intent detection. Tune keywords as you go.
export type Intent =
  | 'booking'
  | 'pricing'
  | 'emergency'
  | 'hours'
  | 'location'
  | 'offer'
  | 'faq'
  | 'unknown';

type DetectOpts = {
  lastAssistantText?: string; // optional context to elevate intent on affirmation
};

export function detectIntent(userText: string, opts: DetectOpts = {}): Intent {
  const tRaw = String(userText || '');
  const t = tRaw.toLowerCase().trim();

  // Helper: time-like phrases imply booking when we're already talking about scheduling
  const hasTimeLike =
    /\b(tom+or+ow|tomorrow|today|this week|next week|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i.test(t) ||
    /\b(?:at\s*)?\d{1,2}(?::\d{2})?\s?(am|pm)\b/i.test(t);

  // --- base keyword detection ---
  if (/(book|booking|schedule|appointment|availability|slot|reserve)/i.test(t) || hasTimeLike) {
    return 'booking';
  }
  if (/(emergency|urgent|pain|toothache|broken|chipped|swollen|bleeding|same[- ]day)/i.test(t)) return 'emergency';
  if (/(price|cost|how much|fee|payment|quote|estimate)/i.test(t)) return 'pricing';
  if (/(hour|open|close|closing|opening|today)/i.test(t)) return 'hours';
  if (/(where|address|location|near|map|direction)/i.test(t)) return 'location';
  if (/(offer|deal|discount|promotion|special)/i.test(t)) return 'offer';

  // --- affirmation override with context ---
  // If user says yes/ok/proceed right after the assistant offered booking/consultation, treat as booking.
  const userAffirmation = /\b(yes|yeah|yep|sure|ok|okay|sounds good|please|go ahead|do it|confirm|let'?s|proceed)\b/i.test(t);

  if (opts.lastAssistantText) {
    const a = opts.lastAssistantText.toLowerCase();

    // Did the assistant offer booking or a consult?
    const assistantOfferedBooking =
      /\b(book|schedule|appointment|calendar|pick(?:\s+a)?\s+time|choose\s+a\s+time|select\s+(?:a\s+)?(time|date)|reserve\s+(?:a\s+)?(slot|time)|set\s+up\s+(?:a\s+)?(consultation|visit|appointment)|arrange\s+(?:a\s+)?(time|visit)|get\s+you\s+(in|scheduled)|proceed)\b/i.test(a);

    // If they gave a time and the assistant was discussing timing, treat as booking.
    const assistantAskedTiming =
      /\b(calendar|time|date|consultation|appointment|pick|choose|select|schedule)\b/i.test(a);

    if (userAffirmation && assistantOfferedBooking) return 'booking';
    if (hasTimeLike && assistantAskedTiming) return 'booking';
  }

  // default: FAQ unless it's too short
  return t.length > 2 ? 'faq' : 'unknown';
}
