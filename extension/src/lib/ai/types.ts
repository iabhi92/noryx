import type {
  Problem,
  ProblemMetadata,
  CodingSession,
  StoredSubmission,
  HintLevel,
  InterviewTurn,
  PracticeTestCase,
  LearnerProfile,
} from '../types';

// Shape TBD — analyzeSession belongs to personal memory (PRD §10-11) and analyzeSolution to
// post-solve analytics (§12), neither built yet. Declared as `unknown` so AIProvider's shape
// matches the PRD without pretending these are implemented by anything.
export type SessionContext = unknown;
export type AIAnalysis = unknown;
export type SolutionContext = unknown;
export type SolutionAnalysis = unknown;

// Only ever built from real tracked data (storage.ts) — counts as observed, nothing invented.
// difficultyCounts and topicCounts are keyed by whatever raw label the platform showed (a
// LeetCode "Easy" and a Codeforces "*800" both land here as separate keys — no cross-platform
// scale unification, same rule as ProblemMetadata.difficulty in lib/types.ts). topicCounts will
// often be sparse: most adapters don't expose topics pre-solve (see leetcode.ts), so this is
// realistically populated mainly from Codeforces sessions today.
export interface ProgressContext {
  totalSolved: number;
  totalAttempted: number;
  successRate: number;
  platformCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  topicCounts: Record<string, number>;
}

export interface ProgressInsight {
  text: string;
  generatedAt: number;
}

// The full-history input to the periodic deep-synthesis pass (see gemini-provider.ts's
// synthesizeLearnerProfile) — deliberately richer than ProgressContext's plain counts, since this
// runs infrequently and is meant to actually reason over patterns, not just tally them. Pulls
// across every feature that tracks something about how the user solves, not just submissions:
// hint-level usage (dependency trend), review-queue box state (what keeps getting forgotten), and
// interview scores (self-reported-adjacent signal from a structured evaluation).
export interface LearnerProfileHistoryItem {
  platform: string;
  title: string;
  difficulty?: string;
  topics?: string[];
  finalStatus: string;
  attempts: number;
  activeMs: number;
  hintLevelsRequested: Array<HintLevel | 'solution'>;
  solvedAt?: number;
}

export interface LearnerProfileContext {
  totalAccepted: number;
  history: LearnerProfileHistoryItem[];
  // problemKey isn't meaningful to the model; title is what it can reason about, so this is
  // titles of problems currently sitting at Leitner box 0 (the review queue's "recently forgot"
  // signal) — see storage.ts's REVIEW_INTERVAL_DAYS.
  recentlyForgotten: string[];
  interviewScores: Array<{
    problemTitle: string;
    communication: number;
    problemSolving: number;
    complexityAwareness: number;
  }>;
}

export interface HintContext {
  problem: Problem & ProblemMetadata;
  session: CodingSession;
  submissions: StoredSubmission[];
  level: HintLevel | 'solution';
  userMessage?: string;
  // Optional: when present, hints get grounded in the learner's demonstrated history across
  // *all* sessions, not just this one. Absent for brand-new users with no profile yet — hints
  // degrade gracefully to the same generic-but-real behavior as before this existed.
  learnerProfile?: LearnerProfile;
}

export interface Hint {
  level: HintLevel | 'solution';
  text: string;
}

export interface InterviewContext {
  problem: Problem & ProblemMetadata;
  turns: InterviewTurn[];
  submissions: StoredSubmission[];
  elapsedMs: number;
}

// What the model claims, before lib/practiceVerify.ts actually runs referenceSolutionJS against
// testCases and finds out which of that claim holds up.
export interface GeneratedPracticeProblem {
  title: string;
  statement: string;
  difficulty: string;
  topics: string[];
  functionName: string;
  testCases: PracticeTestCase[];
  referenceSolutionJS: string;
}

/** Per the PRD: keep the AI layer provider-agnostic. Only `generateHint` has a caller today —
 *  see HintProvider below for what's actually implemented. */
export interface AIProvider {
  analyzeSession(context: SessionContext): Promise<AIAnalysis>;
  generateHint(context: HintContext): Promise<Hint>;
  analyzeSolution(context: SolutionContext): Promise<SolutionAnalysis>;
  analyzeProgress(context: ProgressContext): Promise<ProgressInsight>;
}

/** The slice of AIProvider this build actually implements and calls. */
export interface HintProvider {
  generateHint(context: HintContext): Promise<Hint>;
}

export class AIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderError';
  }
}
