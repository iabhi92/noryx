import type { StoredProblem, CodingSession, StoredSubmission, HintLevel } from '../types';

// Shape TBD — analyzeSession/analyzeProgress belong to personal memory (PRD §10-11) and
// analyzeSolution to post-solve analytics (§12), neither built yet. Declared as `unknown` so
// AIProvider's shape matches the PRD without pretending these are implemented by anything.
export type SessionContext = unknown;
export type AIAnalysis = unknown;
export type SolutionContext = unknown;
export type SolutionAnalysis = unknown;
export type ProgressContext = unknown;
export type ProgressInsight = unknown;

export interface HintContext {
  problem: StoredProblem;
  session: CodingSession;
  submissions: StoredSubmission[];
  level: HintLevel | 'solution';
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
