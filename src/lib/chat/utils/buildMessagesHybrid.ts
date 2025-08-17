import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { lastKTurns, summarizeHistoryInline, type ChatHistory, type Turn } from './history';

type BuildOpts = {
  systemContent: string;
  recentHistory: ChatHistory;
  userLast: string;
  effectiveUserText: string;
  captureJustCompleted: boolean;
  mode?: 'pairs' | 'summary';
  maxPairs?: number;
  maxSummaryChars?: number;
};

export function buildMessagesHybrid(opts: BuildOpts): ChatCompletionMessageParam[] {
  const {
    systemContent,
    recentHistory,
    userLast,
    effectiveUserText,
    captureJustCompleted,
    mode = 'pairs',
    maxPairs = 8,
    maxSummaryChars = 900,
  } = opts;

  let messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: effectiveUserText },
  ];

  if (captureJustCompleted) {
    if (mode === 'pairs') {
      const bundle: Turn[] = lastKTurns(recentHistory, maxPairs);
      messages = [{ role: 'system', content: systemContent }, ...bundle, { role: 'user', content: userLast }];
    } else {
      const summary = summarizeHistoryInline(recentHistory, maxSummaryChars);
      const sys = `${systemContent}\n\n---\nConversation so far (condensed):\n${summary}\n---`;
      messages = [{ role: 'system', content: sys }, { role: 'user', content: userLast }];
    }
  }

  return messages;
}
