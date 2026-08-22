import {
  upsertProblem,
  getOrCreateSession,
  applyHeartbeat,
  recordSubmission,
  getAllProblems,
  getSubmissionsForSession,
  addHint,
  updateSessionHintState,
  getLearnerProfile,
  saveLearnerProfile,
  getLearnerProfileContext,
  migrateLegacyStorageKeys,
} from '../lib/storage';
import { problemKey, type HintLevel, type SubmissionEvent } from '../lib/types';
import { getSettings } from '../lib/settings';
import { shouldIntervene, MAX_AUTO_HINT_LEVEL } from '../lib/ai/intervention';
import { GeminiProvider } from '../lib/ai/gemini-provider';
import { syncPublicProfile } from '../lib/publicProfile';
import type { RuntimeMessage } from '../lib/messages';

// Throttled so a public-profile owner's heartbeats (every 15s per tracked tab) don't turn into a
// request storm — syncPublicProfile() itself already no-ops when no profile is enabled.
const PROFILE_SYNC_INTERVAL_MS = 2 * 60 * 1000;
let lastProfileSyncAt = 0;

async function maybeSyncPublicProfile(): Promise<void> {
  if (Date.now() - lastProfileSyncAt < PROFILE_SYNC_INTERVAL_MS) return;
  lastProfileSyncAt = Date.now();
  try {
    await syncPublicProfile();
  } catch (err) {
    console.warn('[Meow Mentor] public profile sync failed:', err);
  }
}

void migrateLegacyStorageKeys();

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  void handleMessage(message);
});

// The heartbeat-triggered sync above only fires while a tracked coding-platform tab is open and
// active — go quiet for a day and the public profile's "last updated" goes just as quiet, even
// though nothing's actually broken. This alarm re-syncs on a fixed cadence regardless of activity
// (syncPublicProfile() itself still no-ops without an enabled profile), so the link stays
// current-looking for whoever has it, not just fresh right after a coding session.
const PROFILE_SYNC_ALARM = 'meow-mentor-profile-sync';
if (chrome.alarms) {
  chrome.alarms.create(PROFILE_SYNC_ALARM, { periodInMinutes: 15 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROFILE_SYNC_ALARM) return;
    void syncPublicProfile().catch((err) => console.warn('[Meow Mentor] public profile sync failed:', err));
  });
}

// Safari has no chrome.notifications (see the guard below), so an auto-generated hint would
// otherwise land silently in storage with nothing telling the user it happened — defeating the
// PRD's actual point that coaching should be proactive, not something you have to go check for.
// The toolbar badge is the one native, cross-platform "something happened" signal available here.
let unseenHints = 0;

function updateBadge(): void {
  chrome.action.setBadgeText({ text: unseenHints > 0 ? String(unseenHints) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#00f0ff' });
}

async function handleMessage(message: RuntimeMessage): Promise<void> {
  switch (message.type) {
    case 'SESSION_START': {
      const key = problemKey(message.problem.platform, message.problem.externalId);
      await upsertProblem(key, message.problem);
      await getOrCreateSession(key);
      break;
    }
    case 'HEARTBEAT':
      await applyHeartbeat(
        message.problemKey,
        message.activeDeltaMs,
        message.idleDeltaMs,
        message.tabSwitchInc,
        message.pasteCountInc,
        message.pasteCharsInc,
      );
      void maybeIntervene(message.problemKey);
      void maybeSyncPublicProfile();
      break;
    case 'SUBMISSION':
      await recordSubmission(message.problemKey, message.submission);
      void maybeIntervene(message.problemKey);
      void maybeSyncPublicProfile();
      void maybeUpdateLearnerProfile();
      void maybeReviewSolution(message.problemKey, message.submission);
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
  const learnerProfile = await getLearnerProfile();

  try {
    const hint = await provider.generateHint({
      problem,
      session,
      submissions,
      level: nextLevel,
      learnerProfile: learnerProfile ?? undefined,
    });
    const now = Date.now();
    await addHint({ sessionId: session.id, level: hint.level, text: hint.text, createdAt: now, auto: true });
    await updateSessionHintState(session.id, nextLevel, now);

    unseenHints += 1;
    updateBadge();

    // Safari's WebExtension implementation doesn't have chrome.notifications — the hint is
    // still stored via addHint() above, and now badged, just not shown as a system notification.
    if (chrome.notifications) {
      chrome.notifications.create(`meow-mentor-hint-${session.id}-${now}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: `Meow Mentor · ${problem.title}`,
        message: hint.text,
      });
    }
  } catch (err) {
    // Conservative-by-design: a failed hint (bad key, rate limit, network) should never crash
    // the service worker or block tracking. It just quietly doesn't nudge this time.
    console.warn('[Meow Mentor] hint generation failed:', err);
  }
}

/** Automatic optimization feedback the moment a submission comes back Accepted — the post-solve
 *  "is this actually a good solution" review, distinct from the in-flow progressive hints above.
 *  Gated on settings.captureCode being on: a status of "Accepted" alone says nothing about
 *  *how* the problem was solved, so without the actual code there's nothing to review. */
async function maybeReviewSolution(key: string, submission: SubmissionEvent): Promise<void> {
  if (submission.status !== 'Accepted') return;
  if (!submission.code) return;

  const settings = await getSettings();
  if (!settings.geminiApiKey) return;

  const problems = await getAllProblems();
  const problem = problems[key];
  if (!problem) return;

  const session = await getOrCreateSession(key);
  const provider = new GeminiProvider(settings.geminiApiKey);

  try {
    const hint = await provider.reviewSolution({ problem, code: submission.code, language: submission.language });
    const now = Date.now();
    await addHint({ sessionId: session.id, level: hint.level, text: hint.text, createdAt: now, auto: true });

    unseenHints += 1;
    updateBadge();

    if (chrome.notifications) {
      chrome.notifications.create(`meow-mentor-review-${session.id}-${now}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: `Meow Mentor · ${problem.title}`,
        message: hint.text,
      });
    }
  } catch (err) {
    // Same rule as maybeIntervene: never let a failed review call crash tracking.
    console.warn('[Meow Mentor] solution review failed:', err);
  }
}

// Every few solves, not every solve — the deep-synthesis model is intentionally the expensive,
// infrequent side of the two-tier setup (see SYNTHESIS_MODEL in gemini-provider.ts), so this only
// re-runs once real new signal exists, not on a timer or every submission.
const LEARNER_PROFILE_RESYNC_THRESHOLD = 3;

async function maybeUpdateLearnerProfile(): Promise<void> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) return;

  const context = await getLearnerProfileContext();
  if (context.totalAccepted === 0) return;

  const existing = await getLearnerProfile();
  const dueForResync =
    !existing || context.totalAccepted - existing.basedOnAcceptedCount >= LEARNER_PROFILE_RESYNC_THRESHOLD;
  if (!dueForResync) return;

  try {
    const provider = new GeminiProvider(settings.geminiApiKey);
    const profile = await provider.synthesizeLearnerProfile(context);
    await saveLearnerProfile(profile);
  } catch (err) {
    // Same rule as maybeIntervene: a failed synthesis (bad key, rate limit, malformed response)
    // never blocks tracking — hints just keep using whatever profile (or none) already existed.
    console.warn('[Meow Mentor] learner profile synthesis failed:', err);
  }
}

if (chrome.notifications) {
  chrome.notifications.onClicked.addListener(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
  });
}

chrome.action.onClicked.addListener(() => {
  unseenHints = 0;
  updateBadge();
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
});
