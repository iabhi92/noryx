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
} from './types';
import type { ProgressInsight } from './ai/types';

const KEYS = {
  problems: 'noryx:problems',
  sessions: 'noryx:sessions',
  submissions: 'noryx:submissions',
  hints: 'noryx:hints',
  roadmap: 'noryx:roadmap',
  interviews: 'noryx:interviews',
} as const;

async function getMap<T>(key: string): Promise<Record<string, T>> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as Record<string, T>) ?? {};
}

async function setMap<T>(key: string, value: Record<string, T>): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
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
): Promise<void> {
  const session = await getOrCreateSession(problemKey);
  const sessions = await getMap<CodingSession>(KEYS.sessions);
  sessions[session.id] = {
    ...session,
    activeMs: session.activeMs + activeDeltaMs,
    idleMs: session.idleMs + idleDeltaMs,
    tabSwitches: session.tabSwitches + tabSwitchInc,
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
