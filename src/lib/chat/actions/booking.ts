import { respondAndLog } from './respondAndLog';

export function computeBookingFlags({ userLast, lastAssistantText, intent }: {
  userLast: string; lastAssistantText: string; intent: string;
}) {
  const assistantAskedToOpen =
    /\b(want me to|shall i|should i|do you want (me )?to|would you (like|prefer)( me)? to|would you like to|want to)\b/i.test(lastAssistantText) &&
    /\b(calendar|book|schedule|appointment|consultation|pick a time|choose a time|proceed)\b/i.test(lastAssistantText);

  const userAskedToOpen =
    /\b(open|show|give|get)\b.*\b(calendar)\b/i.test(userLast) ||
    /\b(book|schedule)\b.*\b(appointment|slot|time|tomorrow|today|\b\d{1,2}\s*(:\d{2})?\b)/i.test(userLast) ||
    /\b(calendar|appointment|consultation)\b/i.test(userLast);

  const bookingNo =
    (assistantAskedToOpen ||
      /\b(schedule|book|appointment|consultation)\b/i.test(lastAssistantText)) &&
    /\b(no|not now|later|maybe|nah|cancel)\b/i.test(userLast);

  const softAck = /\b(ok(ay)?|sounds good|got it|understood|great|cool|fine|alright|all right|right|noted|thanks|thank you|ah i see|i see|hmm|mm)\b/i
    .test(userLast.trim());

  const impliedYesToBooking = intent === 'booking' &&
    /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|do it)\b/i.test(userLast);

  const bookingYes =
    (assistantAskedToOpen &&
      /\b(yes|yeah|yep|sure|ok|okay|sounds good|please|go ahead|do it)\b/i.test(userLast)) ||
    userAskedToOpen ||
    impliedYesToBooking;

  const strongBookingNow = (intent === 'booking') || bookingYes || userAskedToOpen;

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
  rewriteWithTone
}: {
  kind: 'confirm' | 'open_calendar';
  action: any;
  admin: any;
  ctx: { botId: string; conversation_id: string; user_auth_id?: string | null; userLast: string; intent: string; };
  biz: any;
  leadJustCompleted: boolean;
  leadPreface: string;
  rewriteWithTone: (d: string) => Promise<string>;
}) {
  if (kind === 'confirm') {
    const ctaText = await rewriteWithTone(action.message);
    const finalConfirm = leadJustCompleted ? `${leadPreface}${ctaText}` : ctaText;
    return respondAndLog(admin, {
      botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
      userLast: ctx.userLast, assistantText: finalConfirm, intent: String(ctx.intent ?? '')
    }, {
      answer: finalConfirm,
      ctas: [
        { id: 'booking_yes', label: action.yes || 'Yes' },
        { id: 'booking_no',  label: action.no  || 'No' }
      ]
    });
  }

  // open_calendar
  if (biz.bookingProvider === 'iframe' && biz.bookingIframe) {
    const assistantText = ' ';
    return respondAndLog(admin, {
      botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
      userLast: ctx.userLast, assistantText, intent: String(ctx.intent ?? '')
    }, {
      answer: ' ',
      iframe: biz.bookingIframe,
      embed_outcome: 'iframe',
      embed_provider: (() => { try { return new URL(biz.bookingIframe!).hostname } catch { return '' } })()
    });
  }
  if (biz.bookingProvider === 'link' && biz.bookingUrl) {
    const leadIn = await rewriteWithTone('You can book directly here:');
    const finalLeadIn = leadJustCompleted ? `${leadPreface}${leadIn}` : leadIn;
    return respondAndLog(admin, {
      botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
      userLast: ctx.userLast, assistantText: finalLeadIn, intent: String(ctx.intent ?? '')
    }, {
      answer: finalLeadIn,
      calendar_link: biz.bookingUrl,
      embed_outcome: 'link',
      embed_provider: (() => { try { return new URL(biz.bookingUrl!).hostname } catch { return '' } })()
    });
  }
  const fallback = await rewriteWithTone("I can help you schedule. What's a good time for you?");
  const finalFallback = leadJustCompleted ? `${leadPreface}${fallback}` : fallback;
  return respondAndLog(admin, {
    botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
    userLast: ctx.userLast, assistantText: finalFallback, intent: String(ctx.intent ?? '')
  }, { answer: finalFallback });
}
