import {
  upsertProblem,
  getOrCreateSession,
  applyHeartbeat,
  recordSubmission,
  getAllProblems,
  getSubmissionsForSession,
  addHint,
  updateSessionHintState,
} from '../lib/storage';
import { problemKey, type HintLevel } from '../lib/types';
import { getSettings } from '../lib/settings';
import { shouldIntervene, MAX_AUTO_HINT_LEVEL } from '../lib/ai/intervention';
import { GeminiProvider } from '../lib/ai/gemini-provider';
import type { RuntimeMessage } from '../lib/messages';

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  void handleMessage(message);
});

async function handleMessage(message: RuntimeMessage): Promise<void> {
  switch (message.type) {
    case 'SESSION_START': {
      const key = problemKey(message.problem.platform, message.problem.externalId);
      await upsertProblem(key, message.problem);
      await getOrCreateSession(key);
      break;
    }
    case 'HEARTBEAT':
      await applyHeartbeat(message.problemKey, message.activeDeltaMs, message.idleDeltaMs, message.tabSwitchInc);
      void maybeIntervene(message.problemKey);
      break;
    case 'SUBMISSION':
      await recordSubmission(message.problemKey, message.submission);
      void maybeIntervene(message.problemKey);
      break;
  }
}

/** Runs after every heartbeat/submission — the proactive side of the AI layer (PRD §7-9). Quiet
 *  by default: no-ops without an API key, and shouldIntervene() itself is conservative (cooldown,
 *  thresholds) about when it's actually worth interrupting the user. */
async function maybeIntervene(key: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) return;

  const session = await getOrCreateSession(key);
  const submissions = await getSubmissionsForSession(session.id);
  const result = shouldIntervene(session, submissions, Date.now());
  if (!result.intervene) return;

  const problems = await getAllProblems();
  const problem = problems[key];
  if (!problem) return;

  const nextLevel = Math.min(session.hintLevel + 1, MAX_AUTO_HINT_LEVEL) as HintLevel;
  const provider = new GeminiProvider(settings.geminiApiKey);

  try {
    const hint = await provider.generateHint({ problem, session, submissions, level: nextLevel });
    const now = Date.now();
    await addHint({ sessionId: session.id, level: hint.level, text: hint.text, createdAt: now, auto: true });
    await updateSessionHintState(session.id, nextLevel, now);

    chrome.notifications.create(`noryx-hint-${session.id}-${now}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: `Noryx · ${problem.title}`,
      message: hint.text,
    });
  } catch (err) {
    // Conservative-by-design: a failed hint (bad key, rate limit, network) should never crash
    // the service worker or block tracking. It just quietly doesn't nudge this time.
    console.warn('[Noryx] hint generation failed:', err);
  }
}

chrome.notifications.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});
