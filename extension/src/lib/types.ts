// Recognized platforms get a stable literal from their adapter (e.g. 'leetcode'); everything
// caught by GenericCodingAdapter is keyed by hostname instead, so this stays open-ended.
export type Platform = string;

export interface Problem {
  platform: Platform;
  externalId: string;
  title: string;
  url: string;
}

export interface ProblemMetadata {
  // Plain string, not an Easy/Medium/Hard union: platforms don't agree on a scale
  // (GeeksforGeeks has a "Basic" tier below Easy; Kattis rates numerically). Only ever
  // set from text actually read off the page — never mapped/invented across scales.
  difficulty?: string;
  topics?: string[];
}

export type StoredProblem = Problem & ProblemMetadata & { firstSeenAt: number };

export interface EditorState {
  language: string;
  // Only populated when the user has opted in (settings.captureCode) — the AI coach can only
  // give code-grounded feedback ("your loop bound is off on line N") instead of generic
  // status-based hints if it can actually see what was submitted. Never captured by default.
  code?: string;
}

export type SubmissionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Memory Limit Exceeded'
  | 'Unknown';

export interface SubmissionEvent {
  status: SubmissionStatus;
  language: string;
  runtime?: string;
  memory?: string;
  timestamp: number;
  code?: string; // opt-in only, see EditorState.code
}

export interface StoredSubmission extends SubmissionEvent {
  sessionId: string;
  attemptNumber: number;
}

export interface CodingSession {
  id: string;
  problemKey: string;
  startedAt: number;
  endedAt?: number;
  activeMs: number;
  idleMs: number;
  tabSwitches: number;
  attempts: number;
  hintLevel: number; // 0 = no hint yet; 1-4 = PRD's progressive levels reached so far
  lastHintAt?: number; // drives the intervention cooldown
  lastHeartbeatAt?: number; // drives the dashboard's live/away indicator
}

export type HintLevel = 1 | 2 | 3 | 4;

export interface StoredHint {
  id: string;
  sessionId: string;
  level: HintLevel | 'solution';
  text: string;
  createdAt: number;
  auto: boolean; // proactive intervention vs. user-clicked "Ask for a hint"
  userMessage?: string; // what the user typed, if this hint was a reply to a free-text question
}

// Mock interview mode: a deliberately different interaction shape from hints (the AI leads,
// asking clarifying questions unprompted, then scores the session) — doesn't reuse HintLevel at
// all, this isn't a coaching level progression.
export interface InterviewTurn {
  role: 'interviewer' | 'candidate';
  text: string;
  at: number;
}

export interface InterviewEvaluation {
  communication: number; // 1-5
  problemSolving: number; // 1-5
  complexityAwareness: number; // 1-5
  summary: string;
}

export interface StoredInterview {
  sessionId: string;
  turns: InterviewTurn[];
  evaluation?: InterviewEvaluation;
}

// Spaced repetition (Leitner system): box advances on self-reported recall, resets to 0 on
// "forgot". See REVIEW_INTERVAL_DAYS in storage.ts for the schedule.
export interface ReviewState {
  problemKey: string;
  box: number;
  dueAt: number;
  lastReviewedAt: number;
}

export function problemKey(platform: Platform, externalId: string): string {
  return `${platform}:${externalId}`;
}
