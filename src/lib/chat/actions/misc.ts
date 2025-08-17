import { respondAndLog } from './respondAndLog';

export async function handleMiscAction({
  kind,
  action,
  admin,
  ctx,
  leadJustCompleted,
  leadPreface,
  rewriteWithTone,
  biz
}: {
  kind: 'show_link' | 'handoff';
  action: any;
  admin: any;
  ctx: { botId: string; conversation_id: string; user_auth_id?: string | null; userLast: string; intent: string; };
  leadJustCompleted: boolean;
  leadPreface: string;
  rewriteWithTone: (d: string) => Promise<string>;
  biz: any;
}) {
  if (kind === 'show_link') {
    const url = action.url === 'BUSINESS_GOOGLE_MAPS_URL'
      ? (biz.mapsUrl || biz.address || '')
      : action.url;

    const text = await rewriteWithTone(action.message);
    const finalText = leadJustCompleted ? `${leadPreface}${text}` : text;
    return respondAndLog(admin, {
      botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
      userLast: ctx.userLast, assistantText: finalText, intent: String(ctx.intent ?? '')
    }, { answer: finalText, link: url });
  }

  // handoff
  const text = await rewriteWithTone(action.message);
  const finalText = leadJustCompleted ? `${leadPreface}${text}` : text;
  return respondAndLog(admin, {
    botId: ctx.botId, conversation_id: ctx.conversation_id, user_auth_id: ctx.user_auth_id,
    userLast: ctx.userLast, assistantText: finalText, intent: String(ctx.intent ?? '')
  }, { answer: finalText });
}
