export type Platform = 'leetcode';

export interface Problem {
  platform: Platform;
  externalId: string;
  title: string;
  url: string;
}

export interface ProblemMetadata {
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  topics?: string[];
}

export type StoredProblem = Problem & ProblemMetadata & { firstSeenAt: number };

export interface EditorState {
  language: string;
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
}

export function problemKey(platform: Platform, externalId: string): string {
  return `${platform}:${externalId}`;
}
