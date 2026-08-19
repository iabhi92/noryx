import type { StoredProblem, CodingSession, StoredSubmission, Problem, ProblemMetadata, SubmissionEvent } from './types';

const KEYS = {
  problems: 'noryx:problems',
  sessions: 'noryx:sessions',
  submissions: 'noryx:submissions',
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
