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
