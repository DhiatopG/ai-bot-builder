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

export type Entities = {
  // Always present (empty arrays when nothing matched) so TS never complains.
  timeLike: string[];
  service: string[];
};

type DetectOpts = {
  lastAssistantText?: string; // optional context to elevate intent on affirmation
};

const SERVICE_WORDS = [
  // dentistry examples (adjust for your vertical)
  'clean', 'cleaning', 'scale', 'scaling', 'polish', 'polishing',
  'whitening', 'filling', 'fillings', 'root canal', 'implant', 'implants',
  'crown', 'veneers', 'braces', 'invisalign', 'retainer', 'extraction',
  'checkup', 'check-up', 'consult', 'consultation',
];

const OFFER_WORDS = ['offer', 'deal', 'discount', 'promotion', 'special'];
const PRICE_WORDS = ['price', 'pricing', 'cost', 'how much', 'fee', 'payment', 'quote', 'estimate'];
const HOUR_WORDS  = ['hour', 'hours', 'open', 'close', 'closing', 'opening', 'today'];
const LOC_WORDS   = ['where', 'address', 'location', 'near', 'nearby', 'map', 'direction', 'directions'];

const AFFIRM_WORDS =
  /\b(yes|yeah|yep|sure|ok|okay|sounds good|please|go ahead|do it|confirm|let'?s|proceed)\b/i;

/** Extract time-like expressions (days, “tomorrow”, HH:MM am/pm, etc.) */
function extractTimeLikes(text: string): string[] {
  const parts: string[] = [];
  const patterns: RegExp[] = [
    /\b(tom+or+ow|tomorrow|today|this week|next week)\b/gi,
    /\b(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/gi,
    /\b(?:at\s*)?\d{1,2}(?::\d{2})?\s?(am|pm)\b/gi,
    /\b(\d{1,2}\s?(?:am|pm))\b/gi,
    /\b(\d{1,2}[:.]\d{2})\b/gi,
    /\b(next|this)\s+(morning|afternoon|evening|weekend)\b/gi,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) parts.push(...m);
  }
  return Array.from(new Set(parts));
}

/** Extract simple service keywords */
function extractServices(text: string): string[] {
  const found = SERVICE_WORDS.filter(w => text.includes(w));
  return Array.from(new Set(found));
}

export function detectIntent(userText: string, opts: DetectOpts = {}): Intent {
  const tRaw = String(userText || '');
  const t = tRaw.toLowerCase().trim();

  const entities: Entities = {
    timeLike: extractTimeLikes(t),
    service: extractServices(t),
  };

  const hasTimeLike = entities.timeLike.length > 0;

  // --- base keyword detection ---
  if (/(book|booking|schedule|appointment|availability|slot|reserve)/i.test(t) || hasTimeLike) {
    return 'booking';
  }
  if (/(emergency|urgent|pain|toothache|broken|chipped|swollen|bleeding|same[- ]day)/i.test(t)) {
    return 'emergency';
  }
  if (PRICE_WORDS.some(w => t.includes(w))) return 'pricing';
  if (HOUR_WORDS.some(w => t.includes(w))) return 'hours';
  if (LOC_WORDS.some(w => t.includes(w))) return 'location';
  if (OFFER_WORDS.some(w => t.includes(w))) return 'offer';

  // --- affirmation override with context ---
  const userAffirmation = AFFIRM_WORDS.test(t);

  if (opts.lastAssistantText) {
    const a = opts.lastAssistantText.toLowerCase();

    // Did the assistant offer booking or a consult?
    const assistantOfferedBooking =
      /\b(book|schedule|appointment|calendar|pick(?:\s+a)?\s+time|choose\s+a\s+time|select\s+(?:a\s+)?(time|date)|reserve\s+(?:a\s+)?(slot|time)|set\s+up\s+(?:a\s+)?(consultation|visit|appointment)|arrange\s+(?:a\s+)?(time|visit)|get\s+you\s+(in|scheduled)|proceed)\b/i
        .test(a);

    // If they gave a time and the assistant was discussing timing, treat as booking.
    const assistantAskedTiming =
      /\b(calendar|time|date|consultation|appointment|pick|choose|select|schedule)\b/i.test(a);

    if (userAffirmation && assistantOfferedBooking) return 'booking';
    if (hasTimeLike && assistantAskedTiming) return 'booking';
  }

  // If they mention a known service without other strong signals, treat as FAQ about that service.
  if (entities.service.length) return 'faq';

  // default: FAQ unless it's too short
  return t.length > 2 ? 'faq' : 'unknown';
}

// Optional: tiny helper you can use elsewhere to expose entities if needed
export function analyzeText(userText: string): { intent: Intent; entities: Entities } {
  const t = String(userText || '').toLowerCase();
  const entities: Entities = {
    timeLike: extractTimeLikes(t),
    service: extractServices(t),
  };
  return { intent: detectIntent(t), entities };
}
