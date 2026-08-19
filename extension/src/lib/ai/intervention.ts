import type { CodingSession, StoredSubmission } from '../types';

// Conservative defaults per PRD §8 — "prefer no intervention over an unnecessary interruption".
export const COOLDOWN_MINUTES = 5;
export const REPEATED_ERROR_THRESHOLD = 2; // consecutive same-status failures
export const FAILED_SUBMISSIONS_THRESHOLD = 3; // total failed submissions
export const STUCK_MINUTES = 10; // elapsed with zero submissions
export const MAX_AUTO_HINT_LEVEL = 4; // never auto-escalates to 'solution'

export type InterventionReason = 'repeated-error' | 'many-failed-submissions' | 'stuck-no-attempts';

export interface InterventionResult {
  intervene: boolean;
  reason?: InterventionReason;
}

/** Pure function, no chrome.* calls — easy to check in isolation (see intervention.check.ts). */
export function shouldIntervene(
  session: Pick<CodingSession, 'startedAt' | 'lastHintAt' | 'endedAt'>,
  submissions: Pick<StoredSubmission, 'status'>[],
  now: number,
): InterventionResult {
  if (session.endedAt) return { intervene: false }; // already solved, nothing to coach

  if (session.lastHintAt && now - session.lastHintAt < COOLDOWN_MINUTES * 60_000) {
    return { intervene: false };
  }

  if (countTrailingSameStatus(submissions) >= REPEATED_ERROR_THRESHOLD) {
    return { intervene: true, reason: 'repeated-error' };
  }

  const failedCount = submissions.filter((s) => s.status !== 'Accepted').length;
  if (failedCount >= FAILED_SUBMISSIONS_THRESHOLD) {
    return { intervene: true, reason: 'many-failed-submissions' };
  }

  const minutesSinceStart = (now - session.startedAt) / 60_000;
  if (submissions.length === 0 && minutesSinceStart >= STUCK_MINUTES) {
    return { intervene: true, reason: 'stuck-no-attempts' };
  }

  return { intervene: false };
}

function countTrailingSameStatus(submissions: Pick<StoredSubmission, 'status'>[]): number {
  if (submissions.length === 0) return 0;
  const last = submissions[submissions.length - 1].status;
  let count = 0;
  for (let i = submissions.length - 1; i >= 0 && submissions[i].status === last; i--) {
    count++;
  }
  return count;
}
