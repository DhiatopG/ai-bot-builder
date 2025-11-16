// src/lib/chat/actions/booking.ts
import { respondAndLog } from './respondAndLog';

export function computeBookingFlags({
  userLast,
  lastAssistantText,
  intent,
}: {
  userLast: string;
  lastAssistantText: string;
  intent: string;
}) {
  // Treat booking/reschedule/cancel the same
  const bookingLike = ['booking', 'reschedule', 'cancel'].includes(String(intent));

  const assistantAskedToOpen =
    /\b(want me to|shall i|should i|do you want (me )?to|would you (like|prefer)( me)? to|would you like to|want to)\b/i.test(
      lastAssistantText
    ) &&
    /\b(calendar|book|schedule|appointment|consultation|pick a time|choose a time|proceed|reschedule|cancel)\b/i.test(
      lastAssistantText
    );

  const userAskedToOpen =
    /\b(open|show|give|get)\b.*\b(calendar)\b/i.test(userLast) ||
    /\b(book|schedule|resched(?:ule|u+le)?|cancel)\b.*\b(appointment|slot|time|tomorrow|today|\b\d{1,2}\s*(:\d{2})?\b)/i.test(
      userLast
    ) ||
    /\b(calendar|appointment|consultation|reschedule|cancel)\b/i.test(userLast);

  const bookingNo =
    (assistantAskedToOpen || /\b(schedule|book|appointment|consultation|reschedule|cancel)\b/i.test(lastAssistantText)) &&
    /\b(no|not now|later|maybe|nah|cancel)\b/i.test(userLast);

  const softAck = /\b(ok(ay)?|sounds good|got it|understood|great|cool|fine|alright|all right|right|noted|thanks|thank you|ah i see|i see|hmm|mm)\b/i.test(
    userLast.trim()
  );

  const impliedYesToBooking =
    bookingLike && /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|do it)\b/i.test(userLast);

  const bookingYes =
    (assistantAskedToOpen &&
      /\b(yes|yeah|yep|sure|ok|okay|sounds good|please|go ahead|do it)\b/i.test(userLast)) ||
    userAskedToOpen ||
    impliedYesToBooking;

  // Strong “do it now” if any booking-like intent or explicit ask
  const strongBookingNow = bookingLike || bookingYes || userAskedToOpen;

  return { assistantAskedToOpen, userAskedToOpen, bookingNo, softAck, bookingYes, strongBookingNow };
}

export async function handleBookingAction({
  kind,
  action,
  admin,
  ctx,
  biz,
  leadJustCompleted,
  leadPreface,
  rewriteWithTone,
}: {
  kind: 'confirm' | 'open_calendar';
  action: any;
  admin: any;
  ctx: {
    botId: string;
    conversation_id: string;
    user_auth_id?: string | null;
    userLast: string;
    intent: string;
  };
  biz: any;
  leadJustCompleted: boolean;
  leadPreface: string;
  rewriteWithTone: (d: string) => Promise<string>;
}) {
  if (kind === 'confirm') {
    const ctaText = await rewriteWithTone(action.message);
    const finalConfirm = leadJustCompleted ? `${leadPreface}${ctaText}` : ctaText;
    return respondAndLog(
      admin,
      {
        botId: ctx.botId,
        conversation_id: ctx.conversation_id,
        user_auth_id: ctx.user_auth_id,
        userLast: ctx.userLast,
        assistantText: finalConfirm,
        intent: String(ctx.intent ?? ''),
      },
      {
        answer: finalConfirm,
        ctas: [
          { id: 'booking_yes', label: action.yes || 'Yes' },
          { id: 'booking_no', label: action.no || 'No' },
        ],
      }
    );
  }

  // open_calendar (SILENT)
  if (biz.bookingProvider === 'iframe' && biz.bookingIframe) {
    // Optionally append mode=?booking|reschedule|cancel for your embed page
    const iframeUrl = (() => {
      try {
        const u = new URL(biz.bookingIframe as string);
        // don't double-append if already present
        if (!u.searchParams.has('mode') && ['booking', 'reschedule', 'cancel'].includes(String(ctx.intent))) {
          u.searchParams.set('mode', String(ctx.intent));
        }
        return u.toString();
      } catch {
        return biz.bookingIframe as string;
      }
    })();

    const assistantText = '\u200B'; // zero-width space → no visible text
    return respondAndLog(
      admin,
      {
        botId: ctx.botId,
        conversation_id: ctx.conversation_id,
        user_auth_id: ctx.user_auth_id,
        userLast: ctx.userLast,
        assistantText,
        intent: String(ctx.intent ?? ''),
      },
      {
        answer: '\u200B', // keep UI from showing fallback text
        iframe: iframeUrl,
        embed_outcome: 'iframe',
        embed_provider: (() => {
          try {
            return new URL(iframeUrl!).hostname;
          } catch {
            return '';
          }
        })(),
        // Tell UI to skip lead capture on this turn
        suppress_lead_capture: true,
      }
    );
  }

  if (biz.bookingProvider === 'link' && biz.bookingUrl) {
    // stay silent while providing the calendar link payload
    const linkUrl = (() => {
      try {
        const u = new URL(biz.bookingUrl as string);
        if (!u.searchParams.has('mode') && ['booking', 'reschedule', 'cancel'].includes(String(ctx.intent))) {
          u.searchParams.set('mode', String(ctx.intent));
        }
        return u.toString();
      } catch {
        return biz.bookingUrl as string;
      }
    })();

    const assistantText = '\u200B';
    return respondAndLog(
      admin,
      {
        botId: ctx.botId,
        conversation_id: ctx.conversation_id,
        user_auth_id: ctx.user_auth_id,
        userLast: ctx.userLast,
        assistantText,
        intent: String(ctx.intent ?? ''),
      },
      {
        answer: '\u200B', // no visible assistant copy
        calendar_link: linkUrl,
        embed_outcome: 'link',
        embed_provider: (() => {
          try {
            return new URL(linkUrl!).hostname;
          } catch {
            return '';
          }
        })(),
        // Tell UI to skip lead capture on this turn
        suppress_lead_capture: true,
      }
    );
  }

  // fallback (not opening calendar)
  const fallback = await rewriteWithTone("I can help you schedule. What's a good time for you?");
  const finalFallback = leadJustCompleted ? `${leadPreface}${fallback}` : fallback;
  return respondAndLog(
    admin,
    {
      botId: ctx.botId,
      conversation_id: ctx.conversation_id,
      user_auth_id: ctx.user_auth_id,
      userLast: ctx.userLast,
      assistantText: finalFallback,
      intent: String(ctx.intent ?? ''),
    },
    { answer: finalFallback }
  );
}
