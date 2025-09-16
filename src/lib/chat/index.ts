import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { openai } from './llm/client';
import { searchRelevantChunks } from '@/lib/vector/searchRelevantChunks';

import { detectIntent } from '@/lib/nlu/detectIntent';
import { extractEntities } from '@/lib/engine/state';
import { loadBizContext } from '@/lib/engine/context';
import { decideNextAction } from '@/lib/engine/nextStep';
import { buildSystemPrompt } from '@/lib/prompt/buildSystemPrompt';

import { cleanHtml } from './utils/html';
import { kbCoversQuestion } from './kb/coverage';
import {
  preview, hasBookingLanguage, stripEarlyBookingLanguage,
  capName, normalizeEmail, isEmail
} from './utils/text';
import {
  logHistory, hasDeliveredValueOnce, countCaptureAsks, lastCaptureIndex,
  lastNameAskIndex, declinedNameSinceAsk, canConsiderNameFromUser, getLastMeaningfulUserText,
  isLikelyCaptureInput
} from './utils/history';
import {
  isBadNameToken, looksLikeName, tryExtractInlineName, getProvisionalName
} from './utils/identity';
import { mkReqId } from './utils/ids';

import { respondAndLog } from './actions/respondAndLog';
import { handleBookingAction, computeBookingFlags } from './actions/booking';
import { handleMiscAction } from './actions/misc';
import { shouldOfferCaptureCTA, handlePostAnswerCapture } from './actions/leadCapture';
import { pickTemplate } from './templates/dentistry';
async function postLeadToIntegrations(
  req: Request,
  payload: { botId: string; name: string; email: string; message: string }
) {
  const originHeader = (req.headers as any).get?.('origin') || '';
  const hostHeader = (req.headers as any).get?.('host') || '';
  const base =
    process.env.PUBLIC_SITE_URL ||
    originHeader ||
    (hostHeader ? `http://${hostHeader}` : 'http://localhost:3000');

  try {
    const res = await fetch(`${base}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // /api/leads will ONLY forward name/email/message to integrations
      body: JSON.stringify({
        bot_id: payload.botId,
        name: payload.name,
        email: payload.email,
        message: payload.message,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[integrations] /api/leads non-200:', res.status, text?.slice(0, 300));
    } else if (DEBUG_CHAT_LEADS) {
      console.log('[integrations] /api/leads OK:', text?.slice(0, 300));
    }
  } catch (e) {
    console.error('[integrations] /api/leads fetch failed:', e);
  }
}

const DEBUG_CHAT_LEADS = true;

function inferTopicAndAvailability(text: string) {
  const t = String(text || '').toLowerCase();
  if (/\b(root canal|endodont)/i.test(t)) return { topic: 'root canal treatment', avail: 'a root canal appointment' };
  if (/\b(whiten|whitening|bleach|brighten)/i.test(t)) return { topic: 'our whitening services', avail: 'a whitening session' };
  if (/\b(invisalign|aligner|orthodont|braces)/i.test(t)) return { topic: 'our braces and aligner treatments', avail: 'a braces consultation' };
  if (/\b(implant)/i.test(t)) return { topic: 'dental implants', avail: 'an implants consultation' };
  if (/\b(crown|veneer|bridge)/.test(t)) return { topic: 'crowns and veneers', avail: 'a cosmetic consultation' };
  if (/\b(check(\s|-)?up|exam)/i.test(t)) return { topic: 'checkups', avail: 'a checkup' };
  if (/\b(clean|scal(e|ing)|polish|deep clean)/i.test(t)) return { topic: 'our cleaning services', avail: 'a cleaning' };
  if (/\b(emergency|toothache|severe pain|urgent)/i.test(t)) return { topic: 'emergency care', avail: 'an urgent appointment' };
  return { topic: 'our services', avail: 'an appointment' };
}

function inferServiceFromText(text: string | undefined) {
  const t = (text || '').toLowerCase();
  if (/\b(clean|cleaning|scale|scaling|polish|deep clean)\b/.test(t)) return 'cleaning';
  if (/\b(whiten|whitening|bleach|brighten)\b/.test(t)) return 'whitening';
  if (/\b(invisalign|aligner|braces|orthodont)\b/.test(t)) return 'braces';
  if (/\b(implant)\b/.test(t)) return 'implants';
  if (/\b(root canal|endodont)\b/.test(t)) return 'root canal';
  return undefined;
}

async function rewriteWithTone({
  systemPrompt, fullKnowledge, recentHistory, userText, draft
}: {
  systemPrompt: string;
  fullKnowledge: string;
  recentHistory: { role: 'user'|'assistant'; content: string }[];
  userText: string;
  draft: string;
}): Promise<string> {
  try {
    const system: ChatCompletionMessageParam = { role: 'system', content: systemPrompt };
    const knowledgeMsg: ChatCompletionMessageParam = { role: 'user', content: `Use the following information to answer questions:\n\n${fullKnowledge}` };
    const styleHint: ChatCompletionMessageParam = {
      role: 'assistant',
      content: "Rewrite the next line in our voice. Keep it concise (max 1 sentence). Don’t add extra options or links."
    };
    const draftMsg: ChatCompletionMessageParam = { role: 'assistant', content: draft };
    const userMsg: ChatCompletionMessageParam = { role: 'user', content: userText };

    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [system, knowledgeMsg, ...recentHistory as any, userMsg, styleHint, draftMsg],
      temperature: 0.2
    });
    return r.choices[0]?.message?.content?.trim() || draft;
  } catch {
    return draft;
  }
}

export async function orchestrateChat({
  req,
  body,
  supabase,
  admin
}: {
  req: Request;
  body: any;
  supabase: any;
  admin: any;
}) {
  const reqId = mkReqId();
  const {
    question,
    user_id: botId,
    history,
    conversation_id,
    user_auth_id,
    is_after_hours,
    visitor_name,
    visitor_email,
  } = body || {};

  if (!question || !botId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  console.log('[chat] in ←', { reqId, botId, conversation_id, q: String(question).slice(0,120) });

  const { data: bot } = await supabase
    .from('bots')
    .select('id, description, tone')
    .eq('id', botId)
    .single();

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 400 });
  }

  const { data: fileData } = await supabase
    .from('bot_knowledge_files')
    .select('content')
    .eq('bot_id', bot.id);

  const recentHistory = Array.isArray(history)
    ? history.map(({ role, content }: any) => ({ role, content }))
    : [];

  const userLast = String(question);
  const lastMeaningful = getLastMeaningfulUserText(recentHistory as any, userLast);
  const retrievalQuery = isLikelyCaptureInput(userLast) ? (lastMeaningful || userLast) : userLast;

  // === FIRST MESSAGE CAPTURE (meaningful only, after we have lastMeaningful) ===
  try {
    const looksLikePhone = (s: string) => /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
    const isLowWordCount = (s: string) => String(s || '').trim().split(/\s+/).length <= 2;

    const captureish =
      isLikelyCaptureInput(userLast) ||
      isEmail(userLast) ||
      looksLikePhone(userLast) ||
      isLowWordCount(userLast); // catches "yes", "ok", etc.

    const candidate = captureish ? (lastMeaningful || '') : userLast;
    const firstMsg = String(candidate).trim().slice(0, 500);

    console.log('[message] inputs', {
      conversation_id,
      userLastPreview: userLast.slice(0, 120),
      lastMeaningfulPreview: (lastMeaningful || '').slice(0, 120),
      captureish,
    });

    if (!conversation_id) {
      console.warn('[meesage] skipped: missing conversation_id');
    } else if (!firstMsg) {
      console.log('[message] skipped: no meaningful text this turn');
    } else {
      const { data: existing, error: findErr } = await admin
        .from('leads')
        .select('id, message')
        .eq('bot_id', botId)
        .eq('conversation_id', conversation_id)
        .limit(1);

      if (findErr) {
        console.error('[message] findErr:', findErr.message);
      } else if (!existing || existing.length === 0) {
        const { error: insErr } = await admin
          .from('leads')
          .upsert(
            { bot_id: botId, conversation_id, message: firstMsg, source: 'chat' },
            { onConflict: 'bot_id,conversation_id' }
          );

        if (insErr) {
          console.error('[message] insert/upsert error:', insErr.message);
          if (/column .*message/i.test(insErr.message || '')) {
            console.warn('[message] DB missing message column. Run: alter table public.leads add column if not exists message text;');
          }
        } else {
          console.log('[message] inserted', { botId, conversation_id, firstMsgPreview: firstMsg.slice(0, 120) });
        }
      } else if (existing[0] && !existing[0].message) {
        const { error: updErr } = await admin
          .from('leads')
          .update({ message: firstMsg })
          .eq('id', existing[0].id);

        if (updErr) {
          console.error('[message] backfill error:', updErr.message);
        } else {
          console.log('[message] backfilled', { id: existing[0].id, firstMsgPreview: firstMsg.slice(0, 120) });
        }
      } else {
        console.log('[message] already set; no-op');
      }
    }
  } catch (e) {
    console.warn('[message] threw:', e);
  }
  // === END FIRST MESSAGE CAPTURE ===

  const chunks: { text: string }[] = await searchRelevantChunks(bot.id, retrievalQuery);
  console.log('[chunks] query =', retrievalQuery);
  console.log('[chunks] found:', chunks.length);
  chunks.forEach((c, i) => console.log(`[chunk ${i + 1}]`, c.text.slice(0, 100).replace(/\s+/g, ' ') + '…'));

  const cleanedScraped = chunks.map((c) => c.text).join('\n\n---\n\n');
  const cleanedFiles = Array.isArray(fileData)
    ? fileData.map((f) => cleanHtml(f.content)).join('\n\n')
    : '';
  const fullKnowledge = [
    'Business Description:',
    bot.description || '',
    '',
    'Scraped Website Content:',
    cleanedScraped,
    '',
    'Uploaded Files:',
    cleanedFiles
  ].join('\n').slice(0, 150000);

  const kbHasCoverage = kbCoversQuestion(userLast, fullKnowledge, chunks);
  console.log('[chat] kbHasCoverage', kbHasCoverage);

  const textsBefore = recentHistory.map(({ content }) => content || '');
  const entitiesBefore = extractEntities(textsBefore);
  const beforeName = entitiesBefore.name && !isBadNameToken(entitiesBefore.name) ? entitiesBefore.name.trim() : null;
  const beforeEmailOrPhone = !!(entitiesBefore.email || entitiesBefore.phone);

  const allTexts = [...textsBefore, userLast];
  const lastAssistantText =
    recentHistory.slice().reverse().find(({ role }) => role === 'assistant')?.content || '';

  // ---- server-side lead field fallback (handles curly apostrophes) ----
  const askedNameSrv  = /what(?:’|')?s your name|what is your name|can i take your name/i.test(lastAssistantText || '')
  const askedEmailSrv = /best email|share (?:your )?email|your email|email to send/i.test(lastAssistantText || '')
  const emailReSrv    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const effectiveName =
    visitor_name ||
    (askedNameSrv && !emailReSrv.test(String(userLast).trim()) ? String(userLast).trim() : null)

  const effectiveEmail =
    visitor_email ||
    (askedEmailSrv && emailReSrv.test(String(userLast).trim()) ? String(userLast).trim() : null)

  console.log('[chat] effective lead fields', { effectiveName, effectiveEmail })

  let intent = detectIntent(userLast, { lastAssistantText });
  if (/\b(toothache|tooth ache|tooth hurts|tooth pain|severe pain|swelling|abscess|knocked(?:\s*out)?\s*tooth|broken tooth|chipped tooth|bleeding|emergency|urgent)\b/i.test(userLast)) {
    intent = 'emergency' as any;
  }
  console.log('[chat] intent', intent);

  const meaningfulUserText = getLastMeaningfulUserText(recentHistory as any, userLast);
  const intentFromHistory = detectIntent(meaningfulUserText || userLast, { lastAssistantText });
  const isLowSignalTurn = /^\W*$/.test(userLast.trim()) || userLast.trim().split(/\s+/).length === 1;
  const bookingWords = /\b(book|appointment|calendar|schedule|slot|reserve|time)\b/i;

  const intentForAction =
    (isLikelyCaptureInput(userLast) && !bookingWords.test(userLast))
      || isLowSignalTurn
      ? intentFromHistory
      : intent;

  const originHost = (() => {
    const origin = (req.headers as any).get?.('origin') || process.env.PUBLIC_SITE_URL || '';
    if (!origin) return ((req.headers as any).get?.('host') || 'localhost');
    try { return new URL(origin).hostname; } catch { return 'localhost'; }
  })();

  const biz = await loadBizContext({
    botId,
    isAfterHours: !!is_after_hours,
    originHost
  });

  const entities = extractEntities(allTexts);
  console.log('[chat] entities', { name: entities.name, email: entities.email, phone: entities.phone });

  const serviceHint = inferServiceFromText(meaningfulUserText || userLast);
  if (!entities.service && serviceHint) {
    (entities as any).service = serviceHint;
  }

  if (entities.name && !isBadNameToken(entities.name) && (entities.email || entities.phone)) {
  try {
    const updates: any = { source: 'chat' };
    if (effectiveName)  updates.name  = capName(effectiveName);
    if (effectiveEmail) updates.email = effectiveEmail;

    if (updates.name || updates.email) {
      const { error } = await admin
        .from('leads')
        .update(updates)
        .eq('bot_id', botId)
        .eq('conversation_id', conversation_id);

      if (error) {
        console.error('[leads update (partial)] error:', error.message, updates);
      } else {
        console.log('[leads update (partial) ok]', { bot_id: botId, conversation_id });
      }
    }
  } catch (e: any) {
    console.error('[leads update (partial) threw]:', e?.message || String(e));
  }
}


  const bookingFlags = computeBookingFlags({ userLast, lastAssistantText, intent: intentForAction });
  let action = decideNextAction(intentForAction, entities, biz, {
    bookingYes: bookingFlags.bookingYes,
    bookingNo: bookingFlags.bookingNo,
    softAck: bookingFlags.softAck,
    rawUserText: meaningfulUserText || userLast
  });

  if (!kbHasCoverage) {
    const text: string = pickTemplate(String(intentForAction || ''), biz);
    const lowIntentInfoLocal = ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction));
    if (lowIntentInfoLocal) {
      const assistantText: string = `${text}\n\nCan I take your name to tailor this for you?`;
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast: question, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
      );
    }
    const assistantText: string = text;
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast: question, assistantText, intent: String(intentForAction ?? '') },
      { answer: assistantText }
    );
  }

  if (intent === 'emergency' && (action?.type === 'freeform' || action?.type === 'ask')) {
    action = { type: 'confirm', message: 'I can help right away with urgent tooth pain. Want me to open our calendar for the soonest appointment?' } as any;
  }

  const contactInstruction = [
    'If the user asks for contact details, share ONLY these exact values, and say "not available" if a field is empty:',
    `- Email: ${biz.email || 'not available'}`,
    `- Phone: ${biz.phone || 'not available'}`,
    `- Location: ${biz.address || 'not available'}`
  ].join('\n');

  const calendarAlreadyShown =
    Array.isArray(history) &&
    history.some(({ content }: any) =>
      (typeof content === 'string' && /calendar opened here/i.test(content)) ||
      (typeof content === 'object' && content?.openCalendar === true)
    );

  const bookingCompleted = false;
  const toneInstruction =
    `${bot.tone ? `Use a ${String(bot.tone).toLowerCase()} tone.` : ''} ` +
    `Answer **only** using the Business Description, Scraped Website Content, and Uploaded Files above. ` +
    `If the information is not present, say you don’t have it in this bot’s knowledge base and suggest relevant topics instead. Do not invent or speculate.`;

  const isFirstTurn = !Array.isArray(recentHistory) || recentHistory.length === 0;
  const isOneWord = userLast.trim().split(/\s+/).length === 1;
  const lowSignal = isOneWord || /^\W*$/.test(userLast.trim()) || bookingFlags.softAck;
  const bookingFlowActive =
    calendarAlreadyShown ||
    intent === 'booking' ||
    intent === 'emergency' ||
    bookingFlags.assistantAskedToOpen ||
    bookingFlags.bookingYes;

  const afterHoursForPrompt =
    !biz.isOpenNow &&
    !bookingFlowActive &&
    !bookingFlags.bookingNo &&
    (
      (isFirstTurn && !lowSignal) ||
      intent === 'hours'
    );

  const saidYes = /\b(yes|yeah|yep|sure|ok|okay|please)\b/i.test(userLast);
  const saidNo  = /\b(no|nah|nope|not now|later|maybe)\b/i.test(userLast);

  const assistantOfferedAvailability =
    /(?:see|send|show).{0,30}availability|open (?:our|the) calendar|pick a time|choose a time|book now|see (?:available )?slots/i
    .test(lastAssistantText);

  if (assistantOfferedAvailability && saidYes) {
    action = { type: 'open_calendar', message: '' } as any;
  }

  const lastAskedName  = /your name|put this under your name|can i take your name|what'?s your name/i.test(lastAssistantText);
  const lastAskedEmail = /your email|keep you posted|share email|get your email|best email/i.test(lastAssistantText);

  const askedNameBefore  = Array.isArray(history) && history.some(({ content }: any) => /can i take your name|put this under your name|what'?s your name/i.test(content || ''));
  const askedEmailBefore = Array.isArray(history) && history.some(({ content }: any) => /keep you posted|share email|get your email|best email|your email/i.test(content || ''));

  const lowIntentInfo = ['general', 'services', 'pricing', 'hours', 'insurance', 'faq', 'unknown'].includes(String(intentForAction));

  const provisionalName = getProvisionalName(recentHistory as any, lastAssistantText, userLast);
  const inlineName = tryExtractInlineName(userLast);
  const canName = canConsiderNameFromUser(recentHistory as any, userLast);
  const resolvedName =
  (entities.name && !isBadNameToken(entities.name)) ? entities.name.trim()
: (inlineName && !isBadNameToken(inlineName))         ? inlineName.trim()
: (provisionalName && !isBadNameToken(provisionalName)) ? provisionalName.trim()
: (effectiveName && !isBadNameToken(effectiveName))   ? String(effectiveName).trim()
: null;

  const emailFromTurn = isEmail(userLast) ? normalizeEmail(userLast) : null;
  const combinedEmail = entities.email ? normalizeEmail(entities.email) : (emailFromTurn || null);




  if (DEBUG_CHAT_LEADS) {
    console.log('[chat] effective lead fields', { effectiveName, effectiveEmail })
  }

  // helpful capture logs
  console.log('[capture.flags]', {
    lastAssistantTextPreview: String(lastAssistantText || '').slice(0, 120),
    askedNameSrv, askedEmailSrv,
    saidYes, saidNo,
    lastAskedName, lastAskedEmail, askedNameBefore, askedEmailBefore,
    resolvedName,
    combinedEmail,
    nowHasName: !!resolvedName,
    nowHasEmailOrPhone: !!(combinedEmail || entities.phone),
  });

 try {
  if (effectiveName || effectiveEmail) {
    const updates: any = { source: 'chat' };
    if (effectiveName)  updates.name  = capName(effectiveName);
    if (effectiveEmail) updates.email = effectiveEmail;

    const { error } = await admin
      .from('leads')
      .update(updates)
      .eq('bot_id', botId)
      .eq('conversation_id', conversation_id);

    if (error) {
      console.error('[chat] leads update (partial) error:', error.message, updates);
    } else {
      console.log('[chat] leads update (partial) ok', { bot_id: botId, conversation_id });
    }
  }
} catch (e: any) {
  console.error('[chat] leads update (partial) threw:', e?.message || String(e));
}

  const inCapture =
    askedNameBefore || lastAskedName || askedEmailBefore || lastAskedEmail;

  const nowHasName = !!resolvedName;
  const nowHasEmailOrPhone = !!(combinedEmail || entities.phone);
  const _justCompletedNow = !(!!beforeName && beforeEmailOrPhone) && (nowHasName && nowHasEmailOrPhone);
  const alreadyConfirmed = Array.isArray(history) && history.some(({ content }: any) =>
  /all set, .*saved your email/i.test(String(content || ''))
);

// NEW: recognize the first “you’re all set” message as a prior acknowledgement
const _alreadyAcknowledged = Array.isArray(history) && history.some(({ content }: any) =>
  /you'?re all set/i.test(String(content || ''))
);
  const everBookingFlow =
    calendarAlreadyShown ||
    bookingFlowActive ||
    (Array.isArray(history) &&
      history.some(({ content }: any) =>
        /\b(calendar|appointment|schedule|book)\b/i.test(String(content || ''))
      ));
  const leadWasCompleteBefore = !!(beforeName && beforeEmailOrPhone);
  const lastNameAskIdx = lastNameAskIndex(recentHistory as any);
  const declinedNameRecently = declinedNameSinceAsk(recentHistory as any, lastNameAskIdx);
  const allowLeadCapture = !(alreadyConfirmed || leadWasCompleteBefore || (nowHasName && nowHasEmailOrPhone) || declinedNameRecently);

  const triageCapturePriority = (
    intent === 'emergency' &&
    allowLeadCapture &&
    !resolvedName &&
    !combinedEmail &&
    !everBookingFlow
  );

  console.log('[chat] decision', {
    intent,
    strongBookingNow: bookingFlags.strongBookingNow,
    calendarAlreadyShown,
    everBookingFlow: !!(Array.isArray(history) &&
      history.some(({ content }: any) => /\b(calendar|appointment|schedule|book)\b/i.test(String(content || '')))),
    haveName: !!entities.name,
    haveEmail: !!entities.email,
    action: action?.type
  });

  const _lastAskIdx = lastCaptureIndex(recentHistory as any);
  const _lastAskText = _lastAskIdx === -1 ? '' : String((recentHistory as any)[_lastAskIdx].content || '');
  const _askedNameLast  = /can i take your name|what'?s your name|put this under your name/i.test(_lastAskText);
  const _askedEmailLast = /your email|keep you posted|share email|get your email|best email/i.test(_lastAskText);

  if (_askedNameLast && (saidYes || saidNo)) {
    const assistantText = saidYes
      ? 'Great—what’s your name?'
      : 'No problem—let’s continue. What would you like to know next?';
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }

  if (
    _askedEmailLast &&
    (saidYes || saidNo) &&
    !alreadyConfirmed &&
    !nowHasEmailOrPhone
  ) {

    const assistantText = saidYes
      ? `Thanks${resolvedName ? `, ${capName(resolvedName)}` : ''}! What’s the best email to send details and next steps?`
      : 'All good—I’ll keep helping here.';
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }

  if (saidNo && (_askedNameLast || _askedEmailLast || askedNameBefore || askedEmailBefore)) {
    const assistantText = 'No problem—let’s continue. What would you like to know next?';
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText }
    );
  }

  if (
  (_askedEmailLast || lastAskedEmail || askedEmailBefore) &&
  isEmail(userLast) &&
  (alreadyConfirmed || nowHasEmailOrPhone)
) {
  // Helper: pick the FIRST meaningful user message in the convo
  const looksLikePhone = (s: string) => /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
  const isShortAck = (s: string) =>
    /\b(yes|yeah|yep|sure|ok|okay|please|no|nah|nope|thanks?|thank you|cheers)\b/i.test(String(s || '').trim());

  const chooseFirstMeaningful = (
    hist: { role: 'user' | 'assistant'; content: string }[],
    currentUserLast: string
  ) => {
    // 1) scan from the beginning for the first real user sentence
    for (const m of hist) {
      if (m.role !== 'user') continue;
      const t = String(m.content || '').trim();
      if (!t) continue;
      if (isEmail(t) || looksLikePhone(t) || isLikelyCaptureInput(t) || isShortAck(t)) continue;
      return t;
    }
    // 2) fallback: last meaningful before the most recent capture ask
    const idx = lastCaptureIndex(hist as any);
    if (idx !== -1) {
      const fb = getLastMeaningfulUserText(hist.slice(0, idx) as any, currentUserLast);
      if (fb && !isEmail(fb) && !looksLikePhone(fb) && !isLikelyCaptureInput(fb) && !isShortAck(fb)) {
        return fb.trim();
      }
    }
    // 3) final fallback: whatever we think is the last meaningful
    const last = getLastMeaningfulUserText(hist as any, currentUserLast);
    if (last && !isEmail(last) && !looksLikePhone(last) && !isLikelyCaptureInput(last) && !isShortAck(last)) {
      return last.trim();
    }
    return '';
  };

  // Build a safe message
  const safeMessage = chooseFirstMeaningful(recentHistory as any, userLast);

  // Upsert the lead with name, email, AND message
  try {
    const leadPayload: any = {
      bot_id: botId,
      conversation_id,
      source: 'chat',
      name: resolvedName ? capName(resolvedName) : null,
      email: normalizeEmail(userLast),
      message: safeMessage ? safeMessage.slice(0, 500) : null,
      user_id: user_auth_id || null,
    };
await postLeadToIntegrations(req, {
  botId,
  name: resolvedName ? capName(resolvedName) : '',
  email: normalizeEmail(userLast),   // the email the user just typed
  message: safeMessage || ''         // the first meaningful message
});

    const { error: leadErr } = await admin
      .from('leads')
      .upsert(leadPayload, { onConflict: 'bot_id,conversation_id' });

    if (leadErr) {
      console.error('[email-turn save lead] upsert error:', leadErr.message, leadPayload);
    } else {
      console.log('[email-turn save lead] saved', {
        conversation_id,
        message_preview: (leadPayload.message || '').slice(0, 120),
      });
    }
  } catch (e: any) {
    console.error('[email-turn save lead] threw:', e?.message || String(e));
  }
const assistantText = `Thanks${resolvedName ? `, ${capName(resolvedName)}` : ''}. We'll use this for support if needed.`;
return respondAndLog(
  admin,
  { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
  { answer: assistantText }
);

}
  

  if (triageCapturePriority) {
    if ((action as any)?.type === 'open_calendar' || (action as any)?.type === 'confirm') {
      const assistantText = 'I can help right away. To secure a slot for that tooth pain, can I take your name?';
      return respondAndLog(admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
      );
    }
  }

  if (
    allowLeadCapture &&
    !resolvedName &&
    !combinedEmail &&
    !everBookingFlow &&
    (((action as any)?.type === 'open_calendar') || ((action as any)?.type === 'confirm')) &&
    !bookingFlags.strongBookingNow
  ) {
    const assistantText = 'I can help right away. To secure a slot, can I take your name?';
    return respondAndLog(admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
    );
  }

  if (bookingFlags.strongBookingNow && ((action as any)?.type === 'confirm')) {
    action = { type: 'open_calendar', message: '' } as any;
  }

  if (
    inCapture &&
    ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction)) &&
    !everBookingFlow &&
    !bookingFlags.strongBookingNow &&
    !(nowHasName && nowHasEmailOrPhone) &&
    !(assistantOfferedAvailability && saidYes)
  ) {
    if (((action as any)?.type === 'open_calendar') || ((action as any)?.type === 'confirm')) {
      action = { type: 'freeform', message: '' } as any;
    }
  }

  if (
    ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction)) &&
    !everBookingFlow &&
    allowLeadCapture &&
    !combinedEmail &&
    (lastAskedName || askedNameBefore) &&
    canName
  ) {
    const maybeName = inlineName || (looksLikeName(userLast) ? userLast.trim() : null);
    if (maybeName && !isBadNameToken(maybeName)) {
      const assistantText = `Thanks, ${capName(maybeName)}. Would you like to share your email so I can send details and next steps?`;
      return respondAndLog(admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Yes' }, { id: 'lead_email_no', label: 'No' }] }
      );
    }
  }

  if (
    ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction)) &&
    !everBookingFlow &&
    allowLeadCapture &&
    !combinedEmail &&
    resolvedName &&
    !askedNameBefore &&
    !lastAskedName
  ) {
    const assistantText = `Thanks, ${capName(resolvedName)}. Would you like to share your email so I can send details and next steps?`;
    return respondAndLog(admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Yes' }, { id: 'lead_email_no', label: 'No' }] }
    );
  }

  if (['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction)) && !everBookingFlow && allowLeadCapture && !hasDeliveredValueOnce(recentHistory as any)) {
    action = { type: 'freeform', message: '' } as any;
  }

 let leadJustCompleted = false;
let leadPreface = '';

  const systemPrompt = buildSystemPrompt({
    detected_intent: intentForAction,
    toneInstruction,
    iframeInstruction: '',
    bookingFallbackInstruction: '',
    contactInstruction,
    noLinkUntilConfirmInstruction: '',
    suppressBookingAfterDoneInstruction: '',
    afterHours: afterHoursForPrompt,
    calendarAlreadyShown,
    bookingCompleted
  });

  const lowSignalAck = /\b(yes|yeah|yep|sure|ok|okay|please|more info|more information|tell me more|nothing|no thanks?|no thank you|that's all|all good|no more|nope|nah|i'?m good|im good)\b/i;
  const lowSignalKeywords = /\b(price|cost|fees?|hours?|address|location|directions?|book(ing)?|schedule|time|when|where|phone|email|website|link|info|details?)\b/i;

  function looksLikeShortNudge(t: string) {
    const s = (t || '').trim();
    if (!s) return false;
    if (/[?.!]/.test(s)) return false;
    const words = s.split(/\s+/);
    return words.length <= 2;
  }

  const captureIdx = lastCaptureIndex(recentHistory as any);
  const nameAskIdx = lastNameAskIndex(recentHistory as any);
  const captureRecently = captureIdx !== -1 && captureIdx >= nameAskIdx;

  let preCaptureMeaningful = '';
  if (captureRecently) {
    const beforeCapture = (recentHistory as any).slice(0, captureIdx);
    preCaptureMeaningful = getLastMeaningfulUserText(beforeCapture as any, userLast);
  }

  let effectiveUserText = userLast;

  const isLowSignalNow =
    isLikelyCaptureInput(userLast) ||
    lowSignalAck.test(userLast) ||
    lowSignalKeywords.test(userLast) ||
    looksLikeShortNudge(userLast);

  if (isLowSignalNow) {
    const basis =
      (captureRecently && preCaptureMeaningful) ||
      getLastMeaningfulUserText(recentHistory as any, userLast);

    if (basis) effectiveUserText = String(basis);
  }

  if (leadJustCompleted && isEmail(userLast)) {
    const lastReal = [...recentHistory].reverse().find(
      ({ role, content }) => role === 'user' && !isLikelyCaptureInput(String(content || ''))
    );
    if (lastReal?.content) effectiveUserText = String(lastReal.content);
  }

  if ((entities as any).service) {
    const svc = String((entities as any).service).toLowerCase();
    if (!effectiveUserText.toLowerCase().includes(svc)) {
      effectiveUserText = `[topic:${svc}] ${effectiveUserText}`;
    }
  }

  const isPureGratitude =
    /\b(thanks?|thank you|cheers|appreciate(?:\s+(?:it|that))?|much obliged|ta)\b/i.test(userLast) &&
    !/\b(book|schedule|appointment|calendar|slot|time|tomorrow|today)\b/i.test(userLast);

  if (isPureGratitude) {
    action = { type: 'freeform', message: '' } as any;

    const politeClose = await rewriteWithTone({
      systemPrompt,
      fullKnowledge,
      recentHistory,
      userText: userLast,
      draft: "You're very welcome—anything else I can help with?"
    });

    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText: politeClose, intent: String(intentForAction ?? '') },
      { answer: politeClose }
    );
  }

  if (((action as any)?.type === 'confirm') || ((action as any)?.type === 'open_calendar')) {
    return handleBookingAction({
      kind: (action as any).type,
      action,
      admin,
      ctx: { botId, conversation_id, user_auth_id, userLast, intent: String(intentForAction ?? intent ?? '') },
      biz,
      leadJustCompleted,
      leadPreface,
      rewriteWithTone: (d: string) => rewriteWithTone({
        systemPrompt, fullKnowledge, recentHistory, userText: effectiveUserText, draft: d
      })
    });
  }

  if (action.type === 'show_link' || action.type === 'handoff') {
    return handleMiscAction({
      kind: action.type,
      action,
      admin,
      ctx: { botId, conversation_id, user_auth_id, userLast, intent: String(intentForAction ?? intent ?? '') },
      leadJustCompleted,
      leadPreface,
      rewriteWithTone: (d: string) => rewriteWithTone({
        systemPrompt, fullKnowledge, recentHistory, userText: effectiveUserText, draft: d
      }),
      biz
    });
  }

  const system: ChatCompletionMessageParam = { role: 'system', content: systemPrompt };
  const knowledgeMsg: ChatCompletionMessageParam = { role: 'user', content: `Use the following information to answer questions:\n\n${fullKnowledge}` };

  const includeActionMsg =
    !((entities.email || entities.phone || isEmail(userLast)) && action.type === 'freeform') &&
    !/^\s*$/.test(String(action.message || ''));

  // Use the de-noised message so the model doesn't respond to the raw email
const userMsg: ChatCompletionMessageParam = { role: 'user', content: effectiveUserText || userLast };

  const messageList: ChatCompletionMessageParam[] = includeActionMsg
    ? [system, knowledgeMsg, ...(recentHistory as any), userMsg, { role: 'assistant', content: action.message }]
    : [system, knowledgeMsg, ...(recentHistory as any), userMsg];

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messageList,
    temperature: 0.3
  });

  console.log('[openai] usage', resp.usage || null, 'finish', resp.choices?.[0]?.finish_reason || null);

 let finalAnswer: string =
  resp.choices[0]?.message?.content?.trim() ?? String(action.message ?? '');
console.log(
  '[openai] answer preview:',
  (finalAnswer || '').replace(/\s+/g, ' ').slice(0, 200)
);

// Remove any leftover email-ack lines the model might add (only right after email capture)
if (isEmail(userLast) || leadJustCompleted) {
  finalAnswer = finalAnswer
    // common “we saved / all set / updates” lines
    .replace(/\bI(?:'|’)ll make a note of that email\.?\s*/i, '')
    .replace(/\bI(?: have|’ve) saved your email[^.!?]*[.!?]\s*/i, '')
    .replace(/\bAll set,[^.!?]*[.!?]\s*/i, '')
    .replace(/\bWe(?:’|')?ll send you the latest updates[^.!?]*[.!?]\s*/i, '')

    // NEW: “Thanks/Thank you for providing/sharing your email …”
    .replace(/\bThank(?:s| you)[^.!?]*(?:providing|sharing)\s+your email[^.!?]*[.!?]\s*/i, '')

    // NEW: “I’ll make sure to send you the details … to <email>”
    .replace(/\bI(?:'|’)?ll (?:make sure to )?send (?:you )?(?:the )?(?:details?|information|updates)[^.!?]*\bto\s+[^\s@]+@[^\s@]+\.[^\s@.]+[^.!?]*[.!?]\s*/i, '')
    .replace(/\bI will (?:make sure to )?send (?:you )?(?:the )?(?:details?|information|updates)[^.!?]*\bto\s+[^\s@]+@[^\s@]+\.[^\s@.]+[^.!?]*[.!?]\s*/i, '')

    // NEW: “I’ll/We’ll email you at <email> …”
    .replace(/\bI(?:'|’)?ll email you (?:at|on)\s+[^\s@]+@[^\s@]+\.[^\s@.]+[^.!?]*[.!?]\s*/i, '')
    .replace(/\bWe(?:'|’)?(?: will|’ll)? email you (?:at|on)\s+[^\s@]+@[^\s@]+\.[^\s@.]+[^.!?]*[.!?]\s*/i, '')

    .trim();
}
if (leadJustCompleted && finalAnswer) {
  finalAnswer = `${leadPreface}${finalAnswer}`;
}
  const assistantTurnsSoFar = recentHistory.filter(({ role }) => role === 'assistant').length;
  const earlyNoBooking = allowLeadCapture && assistantTurnsSoFar < 2;
  if (earlyNoBooking && !bookingFlags.strongBookingNow && hasBookingLanguage(finalAnswer)) {
    finalAnswer = stripEarlyBookingLanguage(finalAnswer).trim();
    if (!finalAnswer) {
      finalAnswer = await rewriteWithTone({
        systemPrompt, fullKnowledge, recentHistory, userText: effectiveUserText, draft: "Happy to help—what would you like to know?"
      });
    }
  }

 if (leadJustCompleted) {
  const lastReal = [...recentHistory].reverse().find(
    ({ role, content }) => role === 'user' && !isLikelyCaptureInput(String(content || ''))
  );
  const lastRealText = String(lastReal?.content || '').trim();
  const intentBeforeCapture = detectIntent(lastRealText || userLast, { lastAssistantText });

  try {
    logHistory('recentHistory window', recentHistory as any);

    const originalMessageRaw = getLastMeaningfulUserText(recentHistory as any, userLast);
    console.log('[leadComplete.original]', {
      userLast: preview(userLast),
      lastRealText: preview(lastRealText),
      originalMessagePreview: preview(originalMessageRaw),
      originalMessageLen: (originalMessageRaw || '').length,
      resolvedName: capName(resolvedName),
      combinedEmail: normalizeEmail(combinedEmail || ''),
      havePhone: !!entities.phone,
      recentHistoryLen: recentHistory.length,
    });

    // choose a safe, non-capture message to store
    const looksLikePhone = (s: string) => /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
    const originalMessage = (originalMessageRaw || '').trim();

    let reason = 'original meaningful';
    let safeMessage: string | null = originalMessage;

    if (
      !safeMessage ||
      isEmail(safeMessage) ||
      looksLikePhone(safeMessage) ||
      isLikelyCaptureInput(safeMessage)
    ) {
      const idx = lastCaptureIndex(recentHistory as any);
      const fallback =
        idx !== -1
          ? getLastMeaningfulUserText((recentHistory as any).slice(0, idx), userLast)
          : '';
      if (
        fallback &&
        !isEmail(fallback) &&
        !looksLikePhone(fallback) &&
        !isLikelyCaptureInput(fallback)
      ) {
        safeMessage = fallback.trim();
        reason = 'pre-capture fallback';
      } else {
        safeMessage = null;
        reason = 'none (would have been email/phone/capture)';
      }
    }

    console.log('[leadComplete.message] choice', {
      originalPreview: (originalMessage || '').slice(0, 120),
      chosenPreview: (safeMessage || '').slice(0, 120),
      reason,
    });

    const payload = {
      name: capName(resolvedName),
      email: normalizeEmail(combinedEmail!),
      phone: entities.phone || null,
      message: safeMessage ? safeMessage.slice(0, 500) : null, // sanitized
      bot_id: botId,
      conversation_id,
      user_id: user_auth_id || null,
      source: 'chat',
    };

    const { data: upserted, error: upsertErr } = await admin
      .from('leads')
      .upsert([payload], { onConflict: 'bot_id,conversation_id' })
      // ⬇⬇ remove the nonexistent `message` column from selects
      .select('id, created_at, email, bot_id, conversation_id, phone, user_id, message')
      .single();

    if (upsertErr) {
      console.error('[leadComplete] upsert error:', upsertErr.message);
    } else {
      console.log('[leadComplete] upsert OK', {
        id: upserted?.id,
        messagePreview: (payload.message || '').slice(0, 120),
      });

      const { data: verifyRows, error: verifyError } = await admin
        .from('leads')
        // ⬇⬇ also keep `message` out here
        .select('id, created_at, email, bot_id, phone, user_id, message')
        .eq('email', normalizeEmail(combinedEmail!))
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('[leadComplete] verify-after-upsert:', { verifyError, verifyRows });
      await postLeadToIntegrations(req, {
      botId,
      name: capName(resolvedName),
      email: normalizeEmail(combinedEmail!),
      message: payload.message || safeMessage || ''
    });
    
    }
  } catch (e) {
    console.error('[leadComplete] threw:', e);
  }

  const mentionsBooking =
    /\b(book|schedule|appointment|calendar|slot|time|tomorrow|today)\b/i.test(lastRealText);

  const shouldBookNow =
    intentBeforeCapture === 'emergency' || intentBeforeCapture === 'booking' || mentionsBooking;

  if (shouldBookNow) {
    return handleBookingAction({
      kind: 'open_calendar',
      action: { type: 'open_calendar', message: '' } as any,
      admin,
      ctx: { botId, conversation_id, user_auth_id, userLast, intent: String(intentForAction ?? '') },
      biz,
      leadJustCompleted: true,
      leadPreface,
      rewriteWithTone: (d: string) =>
        rewriteWithTone({ systemPrompt, fullKnowledge, recentHistory, userText: effectiveUserText, draft: d }),
    });
  }

  const basis = lastRealText || userLast;
const { avail } = inferTopicAndAvailability(basis);

if (finalAnswer) {
  finalAnswer = `${finalAnswer}\n\nBy the way, would you like me to send you our current availability for ${avail}?`;
} else {
  finalAnswer = `By the way, would you like me to send you our current availability for ${avail}?`;
}
// no return — fall through to the final respondAndLog below
}


  const captureAsks = countCaptureAsks(recentHistory as any);
  const lastAskIdx = lastCaptureIndex(recentHistory as any);
  const distanceSinceLastAsk = lastAskIdx === -1 ? Infinity : ((recentHistory as any).length - lastAskIdx);
  const canAskNow = captureAsks < 2 && distanceSinceLastAsk >= 6;

  if (allowLeadCapture && canAskNow && lowIntentInfo && !everBookingFlow) {
    if (!nowHasName) {
      const assistantText = `${finalAnswer}\n\nCan I take your name to tailor this for you?`;
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
      );
    }

    if (!nowHasEmailOrPhone) {
      const assistantText = `${finalAnswer}\n\nThanks${resolvedName ? `, ${capName(resolvedName)}` : ''}. Would you like to share your email so I can send details and next steps?`;
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Yes' }, { id: 'lead_email_no', label: 'No' }] }
      );
    }
  }

  if (shouldOfferCaptureCTA({ allowLeadCapture, canAskNow, everBookingFlow, lowIntentInfo })) {
    const r = await handlePostAnswerCapture({
      admin,
      botId,
      conversation_id,
      user_auth_id,
      userLast,
      intent: String(intentForAction ?? ''),
      finalAnswer,
      nowHasName,
      nowHasEmailOrPhone
    });
    if (r) return r;
  }

  return respondAndLog(admin,
    { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intentForAction ?? '') },
    { answer: finalAnswer }
  );
}
