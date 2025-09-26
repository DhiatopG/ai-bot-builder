import { rulesForIntent, GuardedAction } from './rules';
import type { BizContext } from './context';
import { stepIsSatisfied, Entities } from './state';

export type Signals = {
  bookingYes?: boolean;
  bookingNo?: boolean;
  softAck?: boolean;
  rawUserText?: string;
};

function inferTopic(intent: string, e: Entities): string {
  const svc = (e.service || '').toLowerCase().trim();
  if (svc) return svc;
  switch (intent) {
    case 'pricing': return 'pricing and what’s included';
    case 'emergency': return 'urgent care and pain relief';
    case 'hours': return 'today’s hours and earliest openings';
    case 'location': return 'directions and parking';
    case 'offer': return 'current promotions';
    case 'booking': return 'the treatment details';
    default: return 'treatments and prices';
  }
}

export function decideNextAction(
  intent: string,
  e: Entities,
  biz: BizContext,
  signals: Signals = {}
): GuardedAction {
  const pipeline = rulesForIntent(intent);

  const txt = (signals.rawUserText || '').trim();
  const isOneWord = txt.split(/\s+/).length === 1;

  // Detect contact typed *on this turn*
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt);
  const looksLikePhone = /^(?:\+?\d[\d\s().-]{6,}\d)$/.test(txt);
  const justProvidedLead = looksLikeEmail || looksLikePhone;

  const lowSignalBase =
    signals.softAck || isOneWord || txt === '' || /^\W+$/.test(txt);

  const nextStepIsConfirm = pipeline.find(
    (s) => (!s.when || s.when(biz, e)) && s.type === 'confirm'
  );

  const hasPendingAsk = pipeline.some(
    (s) => (!s.when || s.when(biz, e)) && s.type === 'ask' && !stepIsSatisfied(s.key as any, e)
  );

  // If the user just provided contact info, keep the same topic and continue smoothly.
  if (justProvidedLead) {
    const topic = inferTopic(intent, e);

    const txtLower = txt.toLowerCase();
    const userIsDone = /\b(nothing|no thanks?|no thank you|not now|that'?s all|all good|no more|nope|nah|i'?m good|im good)\b/.test(
      txtLower
    );
    if (userIsDone) {
      return { type: 'freeform', message: `All set—I’m here if you need anything else.` };
    }

    if ((intent === 'pricing' || intent === 'booking') && (biz as any)?.booking?.url) {
      return {
        type: 'show_link',
        url: (biz as any).booking.url,
        message: `Thanks! I’ve got your details. Want to pick a time now for ${e?.service || 'your visit'}?`
      } as any;
    }

    if (intent === 'pricing') {
      return {
        type: 'freeform',
        message: `Thanks! I’ve saved your details. Do you want a breakdown of what’s included and the differences for ${e?.service || 'this treatment'}, or should I check available times?`
      };
    }
    if (intent === 'hours') {
      return {
        type: 'freeform',
        message: `Thanks! I’ve saved your details. Want me to check today’s hours and the earliest openings for ${e?.service || 'your visit'}?`
      };
    }
    if (intent === 'location') {
      return {
        type: 'freeform',
        message: `Thanks! I’ve saved your details. Do you need directions or parking info for your ${e?.service || 'appointment'}?`
      };
    }
    if (intent === 'offer') {
      return {
        type: 'freeform',
        message: `Thanks! I’ve saved your details. Would you like the current promotions relevant to ${e?.service || 'your treatment'}?`
      };
    }
    if (intent === 'booking') {
      return {
        type: 'freeform',
        message: `Thanks! I’ve saved your details. Would you like me to pull up available times for ${e?.service || 'your visit'}?`
      };
    }

    return {
      type: 'freeform',
      message: `Thanks! I’ve saved your details. What else would you like to know about ${topic}?`
    };
  }

  const lowSignal = lowSignalBase && !justProvidedLead;
  if (lowSignal && !nextStepIsConfirm && !hasPendingAsk) {
    return { type: 'freeform', message: '' };
  }

  // Walk the pipeline
  for (const step of pipeline) {
    if (step.when && !step.when(biz, e)) continue;

    if (step.type === 'ask') {
      if (stepIsSatisfied(step.key, e)) continue;
      return step;
    }

    if (step.type === 'confirm') {
      if (signals.bookingNo) {
        const topic = inferTopic(intent, e);
        if (intent === 'pricing') {
          return {
            type: 'freeform',
            message: `No problem—happy to break down ${topic}. Anything specific you’re comparing or curious about?`
          };
        }
        if (intent === 'booking' || intent === 'emergency') {
          return {
            type: 'freeform',
            message: `All good—we can talk through ${topic} first. What would you like to know?`
          };
        }
        return {
          type: 'freeform',
          message: `Got it. What else would you like to know about ${topic}?`
        };
      }
      if (!signals.bookingYes) {
        return step;
      }
      continue;
    }

    // First matching non-ask/non-confirm step wins
    return step;
  }

  // Fallback
  return { type: 'freeform', message: '' };
}
