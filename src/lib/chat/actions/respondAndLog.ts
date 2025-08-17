import { NextResponse } from 'next/server';

export async function respondAndLog(
  adminClient: any,
  {
    botId,
    conversation_id,
    user_auth_id,
    userLast,
    assistantText,
    intent
  }: {
    botId: string;
    conversation_id: string;
    user_auth_id?: string | null;
    userLast: string;
    assistantText: string;
    intent?: string | null;
  },
  payload: Record<string, any>
) {
  const now = new Date().toISOString();

  const rows = [
    { bot_id: botId, conversation_id, user_id: user_auth_id || null, role: 'user',      content: userLast,    intent: intent ?? null, created_at: now },
    { bot_id: botId, conversation_id, user_id: user_auth_id || null, role: 'assistant', content: assistantText,                            created_at: now },
  ];

  const { error: insertErr, data: insertData } = await adminClient
    .from('chat_messages')
    .insert(rows)
    .select('id, bot_id, conversation_id, role, intent, created_at');

  if (insertErr) {
    console.error('[chat] chat_messages insert error:', {
      code: insertErr.code,
      details: insertErr.details,
      hint: insertErr.hint,
      message: insertErr.message,
    }, { rows });
  } else {
    console.log('[chat] chat_messages insert ok:', insertData);
  }

  console.log('[chat] out →', JSON.stringify(payload).slice(0, 400));
  return NextResponse.json(payload);
}
