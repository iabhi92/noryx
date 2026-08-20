import type { Problem, ProblemMetadata, SubmissionEvent } from './types';

export type RuntimeMessage =
  | { type: 'SESSION_START'; problem: Problem & ProblemMetadata }
  | {
      type: 'HEARTBEAT';
      problemKey: string;
      activeDeltaMs: number;
      idleDeltaMs: number;
      tabSwitchInc: number;
      pasteCountInc: number;
      pasteCharsInc: number;
    }
  | { type: 'SUBMISSION'; problemKey: string; submission: SubmissionEvent };
