import type {
  StoredProblem,
  CodingSession,
  StoredSubmission,
  Problem,
  ProblemMetadata,
  SubmissionEvent,
  StoredHint,
  HintLevel,
  InterviewTurn,
  InterviewEvaluation,
  StoredInterview,
  ReviewState,
  PracticeProblem,
  LearnerProfile,
} from './types';
import type { ProgressInsight, LearnerProfileContext, LearnerProfileHistoryItem } from './ai/types';

const KEYS = {
  problems: 'meowmentor:problems',
  sessions: 'meowmentor:sessions',
  submissions: 'meowmentor:submissions',
  hints: 'meowmentor:hints',
  roadmap: 'meowmentor:roadmap',
  interviews: 'meowmentor:interviews',
  reviews: 'meowmentor:reviews',
  practiceProblem: 'meowmentor:practiceProblem',
  learnerProfile: 'meowmentor:learnerProfile',
} as const;

// Leitner boxes: index = box number, value = days until next due. Correct recall advances a
// box (longer interval); "forgot" drops back to box 0.
const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30, 60];
const DAY_MS = 86_400_000;

async function getMap<T>(key: string): Promise<Record<string, T>> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as Record<string, T>) ?? {};
}

async function setMap<T>(key: string, value: Record<string, T>): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

const LEGACY_KEY_PAIRS: Array<[string, string]> = [
  ['noryx:problems', KEYS.problems],
  ['noryx:sessions', KEYS.sessions],
  ['noryx:submissions', KEYS.submissions],
  ['noryx:hints', KEYS.hints],
  ['noryx:roadmap', KEYS.roadmap],
  ['noryx:interviews', KEYS.interviews],
  ['noryx:reviews', KEYS.reviews],
  ['noryx:practiceProblem', KEYS.practiceProblem],
  ['noryx:learnerProfile', KEYS.learnerProfile],
  ['noryx:settings', 'meowmentor:settings'],
];

// Recovers data recorded before the Noryx -> MeowMentor rename moved every storage key to a new
// prefix, so it stops looking erased under the new key names. Idempotent: once a new key holds
// data, its legacy pair is skipped, so this is cheap to call unconditionally on every startup.
export async function migrateLegacyStorageKeys(): Promise<void> {
  const oldKeys = LEGACY_KEY_PAIRS.map(([oldKey]) => oldKey);
  const newKeys = LEGACY_KEY_PAIRS.map(([, newKey]) => newKey);
  const [oldData, newData] = await Promise.all([
    chrome.storage.local.get(oldKeys),
    chrome.storage.local.get(newKeys),
  ]);
  const toSet: Record<string, unknown> = {};
  for (const [oldKey, newKey] of LEGACY_KEY_PAIRS) {
    if (oldData[oldKey] !== undefined && newData[newKey] === undefined) {
      toSet[newKey] = oldData[oldKey];
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
    console.info('[MeowMentor] recovered local data from pre-rename storage keys:', Object.keys(toSet));
  }
}

export async function upsertProblem(key: string, problem: Problem & ProblemMetadata): Promise<void> {
  const problems = await getMap<StoredProblem>(KEYS.problems);
  const existing = problems[key];
  problems[key] = { ...problem, firstSeenAt: existing?.firstSeenAt ?? Date.now() };
  await setMap(KEYS.problems, problems);
}

export async function getOrCreateSession(problemKey: string): Promise<CodingSession> {
  const sessions = await getMap<CodingSession>(KEYS.sessions);
  const open = Object.values(sessions).find((s) => s.problemKey === problemKey && !s.endedAt);
  if (open) return open;

  const session: CodingSession = {
    id: `${problemKey}:${Date.now()}`,
    problemKey,
    startedAt: Date.now(),
    activeMs: 0,
    idleMs: 0,
    tabSwitches: 0,
    pasteCount: 0,
    pasteChars: 0,
    attempts: 0,
    hintLevel: 0,
  };
  sessions[session.id] = session;
  await setMap(KEYS.sessions, sessions);
  return session;
}

export async function applyHeartbeat(
  problemKey: string,
  activeDeltaMs: number,
  idleDeltaMs: number,
  tabSwitchInc: number,
  pasteCountInc = 0,
  pasteCharsInc = 0,
): Promise<void> {
  const session = await getOrCreateSession(problemKey);
  const sessions = await getMap<CodingSession>(KEYS.sessions);
  sessions[session.id] = {
    ...session,
    activeMs: session.activeMs + activeDeltaMs,
    idleMs: session.idleMs + idleDeltaMs,
    tabSwitches: session.tabSwitches + tabSwitchInc,
    pasteCount: (session.pasteCount ?? 0) + pasteCountInc,
    pasteChars: (session.pasteChars ?? 0) + pasteCharsInc,
    lastHeartbeatAt: Date.now(),
  };
  await setMap(KEYS.sessions, sessions);
}

export async function recordSubmission(problemKey: string, submission: SubmissionEvent): Promise<void> {
  const session = await getOrCreateSession(problemKey);
  const sessions = await getMap<CodingSession>(KEYS.sessions);
  const current = sessions[session.id] ?? session;
  const attemptNumber = current.attempts + 1;
  sessions[session.id] = {
    ...current,
    attempts: attemptNumber,
    endedAt: submission.status === 'Accepted' ? Date.now() : current.endedAt,
  };
  await setMap(KEYS.sessions, sessions);

  const submissions = await getMap<StoredSubmission[]>(KEYS.submissions);
  const list = submissions[session.id] ?? [];
  list.push({ ...submission, sessionId: session.id, attemptNumber });
  submissions[session.id] = list;
  await setMap(KEYS.submissions, submissions);

  // First time this problem is ever solved, it enters the spaced-repetition queue. Later
  // Accepted submissions of the same problem don't re-seed it — recall is self-reported via
  // recordReviewOutcome, not inferred from re-solves.
  if (submission.status === 'Accepted') {
    const reviews = await getMap<ReviewState>(KEYS.reviews);
    if (!reviews[problemKey]) {
      reviews[problemKey] = {
        problemKey,
        box: 0,
        dueAt: Date.now() + REVIEW_INTERVAL_DAYS[0] * DAY_MS,
        lastReviewedAt: Date.now(),
        timesReviewed: 0,
      };
      await setMap(KEYS.reviews, reviews);
    }
  }
}

export async function getAllProblems(): Promise<Record<string, StoredProblem>> {
  return getMap<StoredProblem>(KEYS.problems);
}

export async function getAllSessions(): Promise<Record<string, CodingSession>> {
  return getMap<CodingSession>(KEYS.sessions);
}

export async function getAllSubmissions(): Promise<Record<string, StoredSubmission[]>> {
  return getMap<StoredSubmission[]>(KEYS.submissions);
}

export async function getSubmissionsForSession(sessionId: string): Promise<StoredSubmission[]> {
  const all = await getMap<StoredSubmission[]>(KEYS.submissions);
  return all[sessionId] ?? [];
}

export async function addHint(hint: Omit<StoredHint, 'id'>): Promise<StoredHint> {
  const hints = await getMap<StoredHint[]>(KEYS.hints);
  const stored: StoredHint = { ...hint, id: `${hint.sessionId}:${hint.createdAt}` };
  hints[hint.sessionId] = [...(hints[hint.sessionId] ?? []), stored];
  await setMap(KEYS.hints, hints);
  return stored;
}

export async function getHintsForSession(sessionId: string): Promise<StoredHint[]> {
  const hints = await getMap<StoredHint[]>(KEYS.hints);
  return hints[sessionId] ?? [];
}

export async function getAllHints(): Promise<Record<string, StoredHint[]>> {
  return getMap<StoredHint[]>(KEYS.hints);
}

export async function getRoadmap(): Promise<ProgressInsight | null> {
  const result = await chrome.storage.local.get(KEYS.roadmap);
  return (result[KEYS.roadmap] as ProgressInsight) ?? null;
}

export async function saveRoadmap(insight: ProgressInsight): Promise<void> {
  await chrome.storage.local.set({ [KEYS.roadmap]: insight });
}

export async function getInterview(sessionId: string): Promise<StoredInterview | null> {
  const interviews = await getMap<StoredInterview>(KEYS.interviews);
  return interviews[sessionId] ?? null;
}

export async function appendInterviewTurn(sessionId: string, turn: InterviewTurn): Promise<StoredInterview> {
  const interviews = await getMap<StoredInterview>(KEYS.interviews);
  const current = interviews[sessionId] ?? { sessionId, turns: [] };
  const updated: StoredInterview = { ...current, turns: [...current.turns, turn] };
  interviews[sessionId] = updated;
  await setMap(KEYS.interviews, interviews);
  return updated;
}

export async function saveInterviewEvaluation(sessionId: string, evaluation: InterviewEvaluation): Promise<void> {
  const interviews = await getMap<StoredInterview>(KEYS.interviews);
  const current = interviews[sessionId] ?? { sessionId, turns: [] };
  interviews[sessionId] = { ...current, evaluation };
  await setMap(KEYS.interviews, interviews);
}

export async function getAllReviews(): Promise<Record<string, ReviewState>> {
  return getMap<ReviewState>(KEYS.reviews);
}

export async function recordReviewOutcome(problemKey: string, remembered: boolean): Promise<ReviewState> {
  const reviews = await getMap<ReviewState>(KEYS.reviews);
  const nextBox = remembered
    ? Math.min((reviews[problemKey]?.box ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1)
    : 0;
  const updated: ReviewState = {
    problemKey,
    box: nextBox,
    dueAt: Date.now() + REVIEW_INTERVAL_DAYS[nextBox] * DAY_MS,
    lastReviewedAt: Date.now(),
    timesReviewed: (reviews[problemKey]?.timesReviewed ?? 0) + 1,
  };
  reviews[problemKey] = updated;
  await setMap(KEYS.reviews, reviews);
  return updated;
}

export async function getPracticeProblem(): Promise<PracticeProblem | null> {
  const result = await chrome.storage.local.get(KEYS.practiceProblem);
  return (result[KEYS.practiceProblem] as PracticeProblem) ?? null;
}

export async function savePracticeProblem(problem: PracticeProblem): Promise<void> {
  await chrome.storage.local.set({ [KEYS.practiceProblem]: problem });
}

export async function getLearnerProfile(): Promise<LearnerProfile | null> {
  const result = await chrome.storage.local.get(KEYS.learnerProfile);
  return (result[KEYS.learnerProfile] as LearnerProfile) ?? null;
}

export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  await chrome.storage.local.set({ [KEYS.learnerProfile]: profile });
}

export async function getLearnerProfileContext(): Promise<LearnerProfileContext> {
  const [sessions, problems, submissionsBySession, hintsBySession, reviews, interviews] = await Promise.all([
    getAllSessions(),
    getAllProblems(),
    getAllSubmissions(),
    getAllHints(),
    getMap<ReviewState>(KEYS.reviews),
    getMap<StoredInterview>(KEYS.interviews),
  ]);

  const sessionList = Object.values(sessions);
  let totalAccepted = 0;

  const history: LearnerProfileHistoryItem[] = sessionList
    .map((session): LearnerProfileHistoryItem | null => {
      const problem = problems[session.problemKey];
      if (!problem) return null;
      const submissions = submissionsBySession[session.id] ?? [];
      const accepted = submissions.find((s) => s.status === 'Accepted');
      if (accepted) totalAccepted += 1;
      // 'review' hints are an automatic post-solve message, not a level the user climbed while
      // stuck — excluding them keeps hintLevelsRequested meaningful for the hint-dependency trend.
      const hintLevels = (hintsBySession[session.id] ?? [])
        .map((h) => h.level)
        .filter((level): level is HintLevel | 'solution' => level !== 'review');
      return {
        platform: problem.platform,
        title: problem.title,
        difficulty: problem.difficulty,
        topics: problem.topics,
        finalStatus: submissions[submissions.length - 1]?.status ?? 'In Progress',
        attempts: session.attempts,
        activeMs: session.activeMs,
        hintLevelsRequested: hintLevels,
        solvedAt: accepted?.timestamp,
      };
    })
    .filter((item): item is LearnerProfileHistoryItem => item !== null);

  const recentlyForgotten = Object.values(reviews)
    .filter((r) => r.box === 0 && r.timesReviewed > 0)
    .map((r) => problems[r.problemKey]?.title)
    .filter((title): title is string => !!title);

  const interviewScores = Object.values(interviews)
    .filter((i): i is StoredInterview & { evaluation: NonNullable<StoredInterview['evaluation']> } => !!i.evaluation)
    .map((i) => {
      const problemKeyForSession = sessionList.find((s) => s.id === i.sessionId)?.problemKey;
      const title = problemKeyForSession ? problems[problemKeyForSession]?.title : undefined;
      return {
        problemTitle: title ?? 'Unknown problem',
        communication: i.evaluation.communication,
        problemSolving: i.evaluation.problemSolving,
        complexityAwareness: i.evaluation.complexityAwareness,
      };
    });

  return { totalAccepted, history, recentlyForgotten, interviewScores };
}

export async function updateSessionHintState(
  sessionId: string,
  hintLevel: HintLevel,
  lastHintAt: number,
): Promise<void> {
  const sessions = await getMap<CodingSession>(KEYS.sessions);
  const current = sessions[sessionId];
  if (!current) return;
  sessions[sessionId] = { ...current, hintLevel, lastHintAt };
  await setMap(KEYS.sessions, sessions);
}
