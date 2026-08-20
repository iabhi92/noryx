import type { Problem, ProblemMetadata, CodingSession, StoredSubmission, HintLevel } from '../types';

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

export interface HintContext {
  problem: Problem & ProblemMetadata;
  session: CodingSession;
  submissions: StoredSubmission[];
  level: HintLevel | 'solution';
  userMessage?: string;
}

export interface Hint {
  level: HintLevel | 'solution';
  text: string;
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
