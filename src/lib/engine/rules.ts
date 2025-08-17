import type { BizContext } from './context';
import type { Entities } from './state';

export type EngineAction =
  | { type: 'ask'; key: 'name'|'email'|'phone'|'service'; message: string }
  | { type: 'confirm'; key: 'booking_confirm'; message: string; yes?: string; no?: string }
  | { type: 'open_calendar'; message: string }
  | { type: 'show_link'; url: string; message: string }
  | { type: 'freeform'; message: string }
  | { type: 'handoff'; message: string };

export type GuardedAction = EngineAction & { when?: (_biz: BizContext, _e: Entities) => boolean };

const blocks = {
  askService: () =>
    <GuardedAction[]>[
      { type: 'ask', key: 'service', message: "What are you looking for today (e.g., cleaning, whitening)?" }
    ],

  collectLeadBasic: () =>
    <GuardedAction[]>[
      { type: 'ask', key: 'name',  message: "What name should I put on this?" },
      { type: 'ask', key: 'email', message: "What’s the best email for a quick confirmation?" },
    ],

  collectPhone: () =>
    <GuardedAction[]>[
      { type: 'ask', key: 'phone', message: "And a phone number in case we need to reach you?" }
    ],

  confirmBooking: () =>
    <GuardedAction[]>[
      {
        type: 'confirm',
        key: 'booking_confirm',
        message: "Want me to open the calendar so you can pick a time?",
        yes: "Yes, show times",
        no: "Not now",
        when: (biz) => biz.isOpenNow === true
      },
      {
        type: 'confirm',
        key: 'booking_confirm',
        message: "We’re closed right now, but I can line it up. Want me to open the calendar so you can choose a time?",
        yes: "Yes, show times",
        no: "Not now",
        when: (biz) => biz.isOpenNow === false
      }
    ],

  openCalendar: () =>
    <GuardedAction[]>[
      { type: 'open_calendar', message: "Great—here’s the calendar." }
    ],

  pricingFollowup: () =>
    <GuardedAction[]>[
      { type: 'freeform', message: "Typical ranges depend on the case. I can share a quick estimate and help you book." }
    ],
};

export function rulesForIntent(intent: string): GuardedAction[] {
  switch (intent) {
    case 'booking':
    case 'emergency':
      return [
        ...blocks.confirmBooking(),
        ...blocks.openCalendar(),
        ...blocks.askService(),
        ...blocks.collectLeadBasic(),
        ...blocks.collectPhone(),
      ];

    case 'pricing':
      return [
        ...blocks.pricingFollowup(),
        ...blocks.confirmBooking(),
        ...blocks.askService(),
        ...blocks.openCalendar(),
        ...blocks.collectLeadBasic(),
        ...blocks.collectPhone(),
      ];

    case 'hours':
      return [
        { type: 'freeform', message: "Here are today’s hours. If you want, I can pull up available times for a quick visit." },
      ];

    case 'location':
      return [
        { type: 'show_link', url: 'BUSINESS_GOOGLE_MAPS_URL', message: "Here’s our address and directions:" }
      ];

    case 'offer':
      return [
        { type: 'freeform', message: "Here are our current promotions and how to claim them." },
        ...blocks.confirmBooking(),
        ...blocks.askService(),
        ...blocks.openCalendar(),
        ...blocks.collectLeadBasic(),
        ...blocks.collectPhone(),
      ];

    case 'faq':
    default:
      return [
        { type: 'freeform', message: "Ask me anything and I’ll help. If you’d like, I can show available times too." }
      ];
  }
}
