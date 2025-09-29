// src/lib/chat/index.ts  — thin orchestrator (~190 lines)
import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { openai } from './llm/client';
import { searchRelevantChunks } from '@/lib/vector/searchRelevantChunks';

import { detectIntent } from '@/lib/nlu/detectIntent';
import { extractEntities } from '@/lib/engine/state';
import { loadBizContext } from '@/lib/engine/context';
import { decideNextAction } from '@/lib/engine/nextStep';
import { buildSystemPrompt } from '@/lib/prompt/buildSystemPrompt';

import { kbCoversQuestion } from './kb/coverage';
import { pickTemplate } from './templates/dentistry';

import { respondAndLog } from './actions/respondAndLog';
import { handleBookingAction, computeBookingFlags } from './actions/booking';
import { handleMiscAction } from './actions/misc';
import { saveEmailTurnLead } from './actions/leads';

import {
  getLastMeaningfulUserText,
  isLikelyCaptureInput,
  lastCaptureIndex,
  lastNameAskIndex,
  declinedNameSinceAsk,
} from './utils/history';
import { isBadNameToken, tryExtractInlineName, getProvisionalName } from './utils/identity';
import { capName, normalizeEmail, isEmail, hasBookingLanguage, stripEarlyBookingLanguage } from './utils/text';
import { mkReqId } from './utils/ids';
import { cleanHtml } from './utils/html';

// NEW — cancel flow
import { handleCancelCTA, maybeOfferCancelButtons, maybeContinueCancelWithEmail } from './cancel/flow';

const DEBUG_CHAT = true; // flip to false to silence
function dbg(reqId: string, label: string, payload: Record<string, any>) {
  if (!DEBUG_CHAT) return;
  try {
    console.debug(
      `[chat][dbg] ${reqId} ${label} →`,
      JSON.stringify(payload, (_k, v) => {
        // avoid logging whole knowledge/file blobs
        if (typeof v === 'string' && v.length > 300) return v.slice(0, 300) + '…';
        return v;
      })
    );
  } catch {
    void 0; // satisfy no-empty
  }
}

// --- tiny local helpers to keep imports stable ---
function assembleKnowledge(bot: any, chunks: { text: string }[], files?: { content: string }[]) {
  const cleanedScraped = chunks.map(c => c.text).join('\n\n---\n\n');
  const cleanedFiles = Array.isArray(files) ? files.map(f => cleanHtml(f.content)).join('\n\n') : '';
  return [
    'Business Description:', bot.description || '',
    '', 'Scraped Website Content:', cleanedScraped,
    '', 'Uploaded Files:', cleanedFiles
  ].join('\n').slice(0, 150000);
}

function inferServiceFromText(text?: string) {
  const t = String(text || '').toLowerCase();
  if (/\b(clean|cleaning|scale|scaling|polish|deep clean)\b/.test(t)) return 'cleaning';
  if (/\b(whiten|whitening|bleach|brighten)\b/.test(t)) return 'whitening';
  if (/\b(invisalign|aligner|braces|orthodont)\b/.test(t)) return 'braces';
  if (/\b(implant)\b/.test(t)) return 'implants';
  if (/\b(root canal|endodont)\b/.test(t)) return 'root canal';
  return undefined;
}

// avoid treating CTA phrases like "Yes, show times" as a name
function isLikelyRealName(s?: string) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/\b(show times|not now|yes|no|book|schedule|open (?:the )?calendar)\b/i.test(t)) return false;
  if (!/^[a-z][a-z .'-]{1,40}$/i.test(t)) return false; // fixed hyphen escape
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (new Set(words).size === 1 && words.length > 1) return false;
  return true;
}

export async function orchestrateChat({
  req, body, supabase, admin
}: { req: Request; body: any; supabase: any; admin: any; }) {
  const reqId = mkReqId();
  console.debug('[chat]', reqId, 'start');

  const {
    question, user_id: botId, history, conversation_id, user_auth_id,
    is_after_hours, visitor_name, visitor_email,
  } = body || {};

  if (!question || !botId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // bot + files
  const { data: bot } = await supabase.from('bots').select('id, description, tone').eq('id', botId).single();
  if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 400 });
  const { data: fileData } = await supabase.from('bot_knowledge_files').select('content').eq('bot_id', bot.id);

  // history + retrieval query
  const recentHistory: { role: 'user'|'assistant'; content: string }[] =
    Array.isArray(history) ? history.map(({ role, content }: any) => ({ role, content })) : [];
  const userLast = String(question);

  // NEW — handle a cancel button click like "cancel_appt:<UUID>" (runs before any LLM work)
  {
    const early = await handleCancelCTA({ req, admin, botId, conversation_id, user_auth_id, userLast });
    if (early) return early;
  }

  const lastMeaningful = getLastMeaningfulUserText(recentHistory as any, userLast);
  const retrievalQuery = isLikelyCaptureInput(userLast) ? (lastMeaningful || userLast) : userLast;

  // first-message capture
  try {
    const looksLikePhone = (s: string) => /\+?\d[\d\s().-]{5,}/.test(String(s || ''));
    const isLowWordCount = (s: string) => String(s || '').trim().split(/\s+/).length <= 2;
    const captureish = isLikelyCaptureInput(userLast) || isEmail(userLast) || looksLikePhone(userLast) || isLowWordCount(userLast);
    const candidate = captureish ? (lastMeaningful || '') : userLast;
    const firstMsg = String(candidate).trim().slice(0, 500);
    if (conversation_id && firstMsg) {
      const { data: existing } = await admin
        .from('leads').select('id, message').eq('bot_id', botId).eq('conversation_id', conversation_id).limit(1);
      if (!existing || existing.length === 0) {
        await admin.from('leads').upsert(
          { bot_id: botId, conversation_id, message: firstMsg, source: 'chat' },
          { onConflict: 'bot_id,conversation_id' }
        );
      } else if (existing[0] && !existing[0].message) {
        await admin.from('leads').update({ message: firstMsg }).eq('id', existing[0].id);
      }
    }
  } catch (e: any) {
    console.warn('[chat]', reqId, 'lead first-message capture skipped:', e?.message || e);
  }

  // RAG + coverage
  const chunks: { text: string }[] = await searchRelevantChunks(bot.id, retrievalQuery);
  const fullKnowledge = assembleKnowledge(bot, chunks, fileData);
  const kbHasCoverage = kbCoversQuestion(userLast, fullKnowledge, chunks);

  // intent + entities
  const textsBefore = recentHistory.map(({ content }) => content || '');
  const entitiesBefore = extractEntities(textsBefore);
  const hadNameBefore = !!(entitiesBefore?.name && !isBadNameToken(entitiesBefore.name));
  const everProvidedEmail =
    Array.isArray(history) &&
    history.some(({ role, content }: any) => role === 'user' && isEmail(String(content || '')));
  const allTexts = [...textsBefore, userLast];

  // UPDATED: use last non-empty assistant content
  const lastAssistantText =
    recentHistory
      .slice()
      .reverse()
      .find(m => m.role === 'assistant' && String(m.content || '').trim().length > 0)
      ?.content || '';

  // NEW — if we asked for email/phone to cancel last turn and the user just sent an email, continue flow
  {
    const cont = await maybeContinueCancelWithEmail({
      admin,
      botId,
      conversation_id,
      user_auth_id,
      userLast,
      lastAssistantText,
    });
    if (cont) return cont;
  }

  let intent = detectIntent(userLast, { lastAssistantText });
  if (/\b(toothache|tooth ache|tooth pain|severe pain|swelling|abscess|knocked\s*out|broken|chipped|bleeding|emergency|urgent)\b/i.test(userLast)) {
    intent = 'emergency' as any;
  }

  // biz context
  const originHost = (() => {
    const origin = (req.headers as any).get?.('origin') || process.env.PUBLIC_SITE_URL || '';
    if (!origin) return ((req.headers as any).get?.('host') || 'localhost');
    try { return new URL(origin).hostname; } catch { return 'localhost'; }
  })();
  const biz = await loadBizContext({ botId, isAfterHours: !!is_after_hours, originHost });

  // augmented entities
  const entities = extractEntities(allTexts);
  const serviceHint = inferServiceFromText(lastMeaningful || userLast);
  if (!entities.service && serviceHint) (entities as any).service = serviceHint;

  // entities delta log (optional)
  try {
    const beforeCount = Object.keys(entitiesBefore || {}).length;
    const afterCount = Object.keys(entities || {}).length;
    if (afterCount !== beforeCount) {
      console.debug('[chat]', reqId, 'entities delta', beforeCount, '→', afterCount);
    }
  } catch {
    void 0; // satisfy no-empty
  }

  // NEW — fast path: user said "I need to cancel / I want to cancel"
  {
    const offer = await maybeOfferCancelButtons({
      admin, botId, conversation_id, user_auth_id,
      userLast, entities, visitor_email
    });
    if (offer) return offer;
  }

  // === EXACT server-side ask detectors you requested ===
  const askedNameSrv  = /what(?:’|')?s your name|what is your name|can i take your name/i.test(lastAssistantText || '');
  const askedEmailSrv = /best email|share (?:your )?email|your email|email to send/i.test(lastAssistantText || '');
  const emailReSrv    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const effectiveName  = visitor_name || (askedNameSrv  && !emailReSrv.test(String(userLast).trim()) ? String(userLast).trim() : null);
  const effectiveEmail = visitor_email || (askedEmailSrv &&  emailReSrv.test(String(userLast).trim()) ? String(userLast).trim() : null);

  // partial lead update
  try {
    if (effectiveName || effectiveEmail) {
      const updates: any = { source: 'chat' };
      if (effectiveName)  updates.name  = capName(effectiveName);
      if (effectiveEmail) updates.email = effectiveEmail;
      await admin.from('leads').update(updates).eq('bot_id', botId).eq('conversation_id', conversation_id);
    }
  } catch (e: any) {
    console.warn('[chat]', reqId, 'lead partial update skipped:', e?.message || e);
  }

  // booking flags + action
  const meaningfulUserText = getLastMeaningfulUserText(recentHistory as any, userLast);
  const intentFromHistory = detectIntent(meaningfulUserText || userLast, { lastAssistantText });
  const isLowSignalTurn = /^\W*$/.test(userLast.trim()) || userLast.trim().split(/\s+/).length === 1;
  const bookingWords = /\b(book|appointment|calendar|schedule|slot|reserve|time)\b/i;
  const intentForAction = ((isLikelyCaptureInput(userLast) && !bookingWords.test(userLast)) || isLowSignalTurn)
    ? intentFromHistory : intent;

  const bookingFlags = computeBookingFlags({ userLast, lastAssistantText, intent: intentForAction });
  let action: any = decideNextAction(intentForAction, entities, biz, {
    bookingYes: bookingFlags.bookingYes,
    bookingNo: bookingFlags.bookingNo,
    softAck: bookingFlags.softAck,
    rawUserText: meaningfulUserText || userLast
  });

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // ---- BOOKING SHORT-CIRCUIT (must run before any KB/LLM) ---- // <<< CHANGE
  const bookingNow =
    intentForAction === 'booking' ||
    bookingFlags?.strongBookingNow ||
    bookingFlags?.bookingYes ||
    bookingFlags?.userAskedToOpen;

  if (bookingNow) {
    // If rules didn’t already choose a booking step, force a confirm
    if (!action || (action.type !== 'confirm' && action.type !== 'open_calendar')) {
      action = { type: 'confirm', message: 'Would you like to see available times now?' } as any;
    }
  }
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

  // --- debug: context & booking ---
  dbg(reqId, 'context.init', {
    botId,
    conversation_id,
    intent,
    intentForAction,
    kbHasCoverage,
    lastAssistantText: (lastAssistantText || '').slice(0, 140),
  });
  dbg(reqId, 'context.booking', bookingFlags);

  // --- capture-related context (MOVE ABOVE KB FALLBACK) ---
  const saidYes = /\b(yes|yeah|yep|sure|ok|okay|please)\b/i.test(userLast);
  const saidNo  = /\b(no|nah|nope|not now|later|maybe)\b/i.test(userLast);

  // broaden detection to include “please provide your name”
  const lastAskedName  = /(?:your name|put this under your name|can i take your name|what'?s your name|what name should i (?:use|put (?:this )?under)|(?:could you )?please provide (?:your )?name)/i
    .test(lastAssistantText);
  if (lastAskedName) console.debug('[chat]', reqId, 'previously asked for name');

  const lastAskedEmail = /your email|keep you posted|share email|get your email|best email/i.test(lastAssistantText);
  const askedNameBefore  = Array.isArray(history) && history.some(({ content }: any) =>
    /can i take your name|put this under your name|what'?s your name|what name should i (?:use|put (?:this )?under)|(?:could you )?please provide (?:your )?name/i
      .test(content || '')
  );
  const askedEmailBefore = Array.isArray(history) && history.some(({ content }: any) =>
    /keep you posted|share email|get your email|best email|your email/i.test(content || '')
  );

  const inlineName = tryExtractInlineName(userLast);
  const provisionalName = getProvisionalName(recentHistory as any, lastAssistantText, userLast);
  const resolvedName =
    (entities.name && !isBadNameToken(entities.name)) ? entities.name.trim()
    : (inlineName && !isBadNameToken(inlineName)) ? inlineName.trim()
    : (provisionalName && !isBadNameToken(provisionalName)) ? provisionalName.trim()
    : (effectiveName && !isBadNameToken(effectiveName)) ? String(effectiveName).trim()
    : null;

  const emailFromTurn = isEmail(userLast) ? normalizeEmail(userLast) : null;
  const combinedEmail = entities.email ? normalizeEmail(entities.email) : (emailFromTurn || null);

  const _lastAskIdx = lastCaptureIndex(recentHistory as any);
  const _lastAskText = _lastAskIdx === -1 ? '' : String((recentHistory as any)[_lastAskIdx].content || '');
  const _askedNameLast  = /(?:can i take your name|what'?s your name|put this under your name|what name should i (?:use|put (?:this )?under)|(?:could you )?please provide (?:your )?name)/i
    .test(_lastAskText);
  const _askedEmailLast = /your email|keep you posted|share email|get your email|best email/i.test(_lastAskText);

  const shareEmailCTA = /\b(share my email|send my email|provide my email|give you my email)\b/i.test(userLast);
  const skipEmailCTA  = /\b(skip|not now|no thanks?)\b/i.test(userLast);

  // debug: capture detectors & signals
  dbg(reqId, 'capture.serverSide', {
    askedNameSrv,
    askedEmailSrv,
    effectiveName,
    effectiveEmail,
  });
  dbg(reqId, 'capture.signals', {
    saidYes,
    saidNo,
    lastAskedName,
    lastAskedEmail,
    askedNameBefore,
    askedEmailBefore,
    _askedNameLast,
    _askedEmailLast,
    inlineName,
    provisionalName,
    resolvedName,
    emailFromTurn,
    combinedEmail,
    everProvidedEmail,
  });

  // --- KB FALLBACK MUST NOT BLOCK BOOKING OR CAPTURE CONTINUATIONS --- // <<< CHANGE
  if (!kbHasCoverage && !(action && (action.type === 'confirm' || action.type === 'open_calendar'))) {
    const justGaveName =
      (lastAskedName || _askedNameLast || askedNameBefore) &&
      resolvedName && isLikelyRealName(resolvedName) &&
      !combinedEmail && !everProvidedEmail;

    if (justGaveName) {
      const assistantText = `Thanks, ${capName(resolvedName)}. What’s the best email to send details and next steps?`;
      dbg(reqId, 'branch.KB_CONTINUE_EMAIL', { resolvedName, combinedEmail, everProvidedEmail });
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Share my email' }, { id: 'lead_email_no', label: 'Skip' }] }
      );
    }

    const text = pickTemplate(String(intentForAction || ''), biz);
    const lowIntentInfoLocal = ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction));
    const assistantText = lowIntentInfoLocal ? `${text}\n\nCan I take your name to tailor this for you?` : text;
    dbg(reqId, 'branch.KB_FALLBACK', { lowIntentInfoLocal, intentForAction });
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast: question, assistantText, intent: String(intentForAction ?? '') },
      lowIntentInfoLocal
        ? { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
        : { answer: assistantText }
    );
  }
  // -------------------------------------------------------------------------

  // quick capture yes/no branches (now safe; KB fallback has been handled above)
  // UPDATED: accept _askedNameLast as a valid trigger too
  if ((lastAskedName || _askedNameLast) && (saidYes || saidNo) && !resolvedName) {
    const assistantText = saidYes ? 'Great—what’s your name?' : 'No problem—let’s continue. What would you like to know next?';
    dbg(reqId, 'branch.NAME_YES_NO_WITHOUT_NAME', { saidYes, saidNo, lastAskedName, _askedNameLast, resolvedName });
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }

  // Email CTA short-circuit
  if ((shareEmailCTA || (lastAskedEmail && (saidYes || shareEmailCTA))) && !(combinedEmail || isEmail(userLast))) {
    const assistantText = `Great—please type your email (e.g., name@example.com).`;
    dbg(reqId, 'branch.EMAIL_CTA_PROMPT', { shareEmailCTA: shareEmailCTA || lastAskedEmail, combinedEmail, isEmailTurn: isEmail(userLast) });
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }
  if (skipEmailCTA || (saidNo && (lastAskedEmail || _askedEmailLast || askedEmailBefore))) {
    const assistantText = 'All good—I’ll keep helping here.';
    dbg(reqId, 'branch.EMAIL_CTA_SKIP', { skipEmailCTA, saidNo, lastAskedEmail, _askedEmailLast, askedEmailBefore });
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }

  // ask for email after a newly captured name
  const askedNameRecently = _askedNameLast;
  if (askedNameRecently && resolvedName && isLikelyRealName(resolvedName) && !combinedEmail && !everProvidedEmail) {
    const assistantText = `Thanks, ${capName(resolvedName)}. What’s the best email to send details and next steps?`;
    dbg(reqId, 'branch.ASK_EMAIL_AFTER_NAME', { askedNameRecently, resolvedName, combinedEmail, everProvidedEmail });
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Share my email' }, { id: 'lead_email_no', label: 'Skip' }] }
    );
  }

  const newlyGotName = !hadNameBefore && !!resolvedName && isLikelyRealName(resolvedName);
  if (newlyGotName && !combinedEmail && !everProvidedEmail && !lastAskedEmail && !askedEmailBefore) {
    const assistantText = `Thanks, ${capName(resolvedName!)}. What’s the best email to send details and next steps?`;
    dbg(reqId, 'branch.ASK_EMAIL_AFTER_NEW_NAME', { newlyGotName, resolvedName, combinedEmail, lastAskedEmail, askedEmailBefore });
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Share my email' }, { id: 'lead_email_no', label: 'Skip' }] }
    );
  }

  // email-turn lead save
  const alreadyConfirmed = Array.isArray(history) && history.some(({ content }: any) => /you'?re all set|all set, .*saved your email/i.test(String(content || '')));
  const nowHasEmailOrPhone = !!(combinedEmail || (entities as any).phone);
  if ((_askedEmailLast || lastAskedEmail || askedEmailBefore) && isEmail(userLast) && (alreadyConfirmed || nowHasEmailOrPhone)) {
    dbg(reqId, 'branch.EMAIL_CONFIRM_SAVE', { _askedEmailLast, lastAskedEmail, askedEmailBefore, isEmailTurn: isEmail(userLast), alreadyConfirmed, nowHasEmailOrPhone });
    await saveEmailTurnLead({ admin, req, botId, conversation_id, user_auth_id, userLast, resolvedName, recentHistory });
    const assistantText = `Thanks${resolvedName ? `, ${capName(resolvedName)}` : ''}. We'll use this for support if needed.`;
    return respondAndLog(admin, { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') }, { answer: assistantText });
  }

  // ask for name before opening calendar — also respect prior captures
  if (
    ((action as any)?.type === 'confirm' || (action as any)?.type === 'open_calendar') &&
    !(resolvedName || hadNameBefore) &&
    !(combinedEmail || everProvidedEmail) &&
    !askedNameBefore &&
    !lastAskedName
  ) {
    const assistantText = 'I can help right away. To secure a slot, can I take your name?';
    dbg(reqId, 'branch.ASK_NAME_BEFORE_CAL', {
      actionType: (action as any)?.type,
      needName: !(resolvedName || hadNameBefore),
      needEmail: !(combinedEmail || everProvidedEmail),
      askedNameBefore,
      lastAskedName,
    });
    return respondAndLog(
      admin,
      { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? intent ?? '') },
      { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
    );
  }

  // if we offered availability last turn and the user said YES, open the calendar
  const assistantOfferedAvailability =
    /(?:see|send|show).{0,30}availability|open (?:our|the) calendar|pick a time|choose a time|book now|see (?:available )?slots/i
      .test(lastAssistantText);
  if (assistantOfferedAvailability && saidYes) {
    dbg(reqId, 'branch.OPEN_CAL_AFTER_YES_SET', { assistantOfferedAvailability, saidYes });
    action = { type: 'open_calendar', message: '' } as any;
  }

  // booking routers
  if ((action as any)?.type === 'confirm' || (action as any)?.type === 'open_calendar') {
    dbg(reqId, 'branch.BOOKING_ROUTER', { kind: (action as any).type });
    return handleBookingAction({
      kind: (action as any).type,
      action, admin,
      ctx: { botId, conversation_id, user_auth_id, userLast, intent: String(intentForAction ?? intent ?? '') },
      biz,
      leadJustCompleted: false,
      leadPreface: '',
      rewriteWithTone: async (d: string) => d
    });
  }
  if ((action as any)?.type === 'show_link' || (action as any)?.type === 'handoff') {
    dbg(reqId, 'branch.MISC_ROUTER', { kind: (action as any).type });
    return handleMiscAction({
      kind: action.type, action, admin,
      ctx: { botId, conversation_id, user_auth_id, userLast, intent: String(intentForAction ?? intent ?? '') },
      leadJustCompleted: false, leadPreface: '', rewriteWithTone: async (d: string) => d, biz
    });
  }

  // final OpenAI answer
  const contactInstruction = [
    'If the user asks for contact details, share ONLY these exact values, and say "not available" if a field is empty:',
    `- Email: ${biz.email || 'not available'}`,
    `- Phone: ${biz.phone || 'not available'}`,
    `- Location: ${biz.address || 'not available'}`
  ].join('\n');

  const toneInstruction =
    `${bot.tone ? `Use a ${String(bot.tone).toLowerCase()} tone.` : ''} ` +
    `Answer **only** using the Business Description, Scraped Website Content, and Uploaded Files above. ` +
    `If the information is not present, say you don’t have it in this bot’s knowledge base and suggest relevant topics instead. Do not invent or speculate.`;

  const systemPrompt = buildSystemPrompt({
    detected_intent: intentForAction,
    toneInstruction,
    iframeInstruction: '',
    bookingFallbackInstruction: '',
    contactInstruction,
    noLinkUntilConfirmInstruction: '',
    suppressBookingAfterDoneInstruction: '',
    afterHours: (!biz.isOpenNow && !bookingFlags.bookingNo),
    calendarAlreadyShown: false,
    bookingCompleted: false
  });

  const system: ChatCompletionMessageParam = { role: 'system', content: systemPrompt };
  const knowledgeMsg: ChatCompletionMessageParam = { role: 'user', content: `Use the following information to answer questions:\n\n${fullKnowledge}` };
  const userMsg: ChatCompletionMessageParam = { role: 'user', content: userLast };

  const includeActionMsg = !!String(action.message || '').trim();
  const messages: ChatCompletionMessageParam[] = includeActionMsg
    ? [system, knowledgeMsg, ...(recentHistory as any), userMsg, { role: 'assistant', content: action.message }]
    : [system, knowledgeMsg, ...(recentHistory as any), userMsg];

  const resp = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, temperature: 0.3 });
  let finalAnswer = resp.choices[0]?.message?.content?.trim() || String(action.message || '');

  // anti-booking early (do NOT suppress on real booking turns) // <<< CHANGE
  const assistantTurnsSoFar = recentHistory.filter(({ role }) => role === 'assistant').length;
  const lowIntentInfo = ['general','services','pricing','hours','insurance','faq','unknown'].includes(String(intentForAction));
  const allowLeadCapture =
    !declinedNameSinceAsk(recentHistory as any, lastNameAskIndex(recentHistory as any));

  const bookingNow2 =
    intentForAction === 'booking' ||
    bookingFlags?.strongBookingNow ||
    bookingFlags?.bookingYes ||
    bookingFlags?.userAskedToOpen;

  const earlyNoBooking = !bookingNow2 && allowLeadCapture && assistantTurnsSoFar < 2;

  if (earlyNoBooking && hasBookingLanguage(finalAnswer)) {
    const stripped = stripEarlyBookingLanguage(finalAnswer).trim();
    finalAnswer = stripped || finalAnswer;
  }

  // post-answer capture nudges
  const askRegex = /(?:can i take your name|what'?s your name|what name should i (?:use|put (?:this )?under)|your email|best email|share email|get your email)/i;
  const captureAsks = Array.isArray(recentHistory)
    ? (recentHistory as any).filter((m: any) => m?.role === 'assistant' && askRegex.test(String(m?.content || ''))).length
    : 0;

  const lastAskIdx2 = lastCaptureIndex(recentHistory as any);
  const distanceSinceLastAsk = lastAskIdx2 === -1 ? Infinity : ((recentHistory as any).length - lastAskIdx2);
  const canAskNow = captureAsks < 2 && distanceSinceLastAsk >= 6;

  const everBookingFlow2 =
    Array.isArray(history) &&
    history.some(({ content }: any) => /\b(calendar|appointment|schedule|book)\b/i.test(String(content || '')));

  const hasNameNow = !!resolvedName;
  const hasEmailOrPhoneNow = nowHasEmailOrPhone;

  if (canAskNow && !everBookingFlow2 && lowIntentInfo) {
    if (!hasNameNow) {
      const assistantText = `${finalAnswer}\n\nCan I take your name to tailor this for you?`;
      dbg(reqId, 'branch.NUDGE_ASK_NAME', { canAskNow, everBookingFlow2, lowIntentInfo, hasNameNow });
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_name_yes', label: 'Yes' }, { id: 'lead_name_no', label: 'No' }] }
      );
    }
    if (hasNameNow && !hasEmailOrPhoneNow) {
      const assistantText = `${finalAnswer}\n\nThanks${resolvedName ? `, ${capName(resolvedName)}` : ''}. Would you like to share your email so I can send details and next steps?`;
      dbg(reqId, 'branch.NUDGE_ASK_EMAIL', { canAskNow, everBookingFlow2, lowIntentInfo, hasNameNow, hasEmailOrPhoneNow });
      return respondAndLog(
        admin,
        { botId, conversation_id, user_auth_id, userLast, assistantText, intent: String(intentForAction ?? '') },
        { answer: assistantText, ctas: [{ id: 'lead_email_yes', label: 'Share my email' }, { id: 'lead_email_no', label: 'Skip' }] }
      );
    }
  }

  dbg(reqId, 'final.answer', {
    assistantTurnsSoFar,
    earlyNoBooking,
    lowIntentInfo,
    finalAnswerPreview: (finalAnswer || '').slice(0, 160),
  });

  console.debug('[chat]', reqId, 'done');
  return respondAndLog(
    admin,
    { botId, conversation_id, user_auth_id, userLast, assistantText: finalAnswer, intent: String(intentForAction ?? '') },
    { answer: finalAnswer }
  );
}
