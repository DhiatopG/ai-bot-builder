import { respondAndLog } from './respondAndLog';

export function shouldOfferCaptureCTA({
  allowLeadCapture,
  canAskNow,
  everBookingFlow,
  lowIntentInfo
}: {
  allowLeadCapture: boolean;
  canAskNow: boolean;
  everBookingFlow: boolean;
  lowIntentInfo: boolean;
}) {
  return allowLeadCapture && canAskNow && !everBookingFlow && lowIntentInfo;
}

export async function handlePostAnswerCapture({
  admin,
  botId,
  conversation_id,
  user_auth_id,
  userLast,
  intent,
  finalAnswer,
  nowHasName,
  nowHasEmailOrPhone
}: {
  admin: any;
  botId: string;
  conversation_id: string;
  user_auth_id?: string | null;
  userLast: string;
  intent: string;
  finalAnswer: string;
  nowHasName: boolean;
  nowHasEmailOrPhone: boolean;
}) {
  if (!nowHasName) {
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intent ?? '') },
      {
        answer: finalAnswer,
        cta_prompt: 'Can I take your name to tailor this for you?',
        ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }]
      }
    );
  }
  if (!nowHasEmailOrPhone) {
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intent ?? '') },
      {
        answer: finalAnswer,
        cta_prompt: 'Would you like to share your email so I can send details and next steps?',
        ctas: [{ id: 'lead_email_yes', label: 'Yes' }, { id: 'lead_email_no', label: 'No' }]
      }
    );
  }
  return null;
}
