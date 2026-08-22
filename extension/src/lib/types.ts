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
  // Count + total length of paste events into the editor above a noise threshold (see
  // universal.ts) — never the pasted text itself. Same "ambient metadata, not content" tier as
  // tabSwitches/activeMs: tracked by default, unlike EditorState.code which needs opt-in.
  pasteCount: number;
  pasteChars: number;
  attempts: number;
  hintLevel: number; // 0 = no hint yet; 1-4 = PRD's progressive levels reached so far
  lastHintAt?: number; // drives the intervention cooldown
  lastHeartbeatAt?: number; // drives the dashboard's live/away indicator
}

export type HintLevel = 1 | 2 | 3 | 4;

export interface StoredHint {
  id: string;
  sessionId: string;
  // 'review' is never requested through the normal level progression (see HintContext['level'],
  // unchanged) — it's a distinct automatic-only trigger fired on an Accepted submission (see
  // maybeReviewSolution in background/index.ts), stored and rendered through the same hint feed.
  level: HintLevel | 'solution' | 'review';
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
  // Only incremented by recordReviewOutcome, never on initial seeding — lets box === 0 be told
  // apart as "just solved, never quizzed" (0) vs. "quizzed and actually forgotten" (> 0).
  timesReviewed: number;
}

// AI-generated custom problems. args/expected are plain JSON values, positional to
// referenceSolutionJS's parameter order — see lib/practiceVerify.ts for how testCases gets
// trimmed down from what Gemini returns to only the ones actually verified against its own
// reference solution.
export interface PracticeTestCase {
  args: unknown[];
  expected: unknown;
}

export interface PracticeProblem {
  title: string;
  statement: string;
  difficulty: string;
  topics: string[];
  functionName: string;
  testCases: PracticeTestCase[];
  referenceSolutionJS: string;
  discardedCount: number;
  generatedAt: number;
}

// The "gets smarter the more you solve" mechanism: a synthesized read on the learner's actual
// demonstrated patterns, built periodically from their full history (not just the current
// session) and then fed back into every future hint prompt — see gemini-provider.ts's
// synthesizeLearnerProfile and buildPrompt. Every field must trace to real tracked data; a
// synthesis with no real signal yet (few solves) should say so plainly rather than inventing
// patterns, same rule buildRoadmapPrompt already follows.
export interface TopicSignal {
  topic: string;
  signal: 'strong' | 'developing' | 'weak';
  evidence: string;
}

export interface LearnerProfile {
  generatedAt: number;
  // How many Accepted submissions existed when this was built — the resync trigger compares this
  // against the current count so re-synthesis only fires after real new signal, not on a timer.
  basedOnAcceptedCount: number;
  topicSignals: TopicSignal[];
  mistakePatterns: string[];
  paceTrend: string;
  hintDependencyTrend: string;
  focusRecommendation: string;
  summary: string;
}

export function problemKey(platform: Platform, externalId: string): string {
  return `${platform}:${externalId}`;
}
