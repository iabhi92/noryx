import type { CodingSession, StoredProblem, StoredSubmission } from './types';

export interface TopicStat {
  topic: string;
  solved: number;
  attempted: number;
  firstAttemptSuccesses: number;
  totalSolvedActiveMs: number;
}

/** Walks every tracked session and tallies per-topic solve/attempt stats — shared between the
 *  Analytics page's full topic breakdown and the dashboard's daily strong/weak-topic summary.
 *  Topics are often sparse (most adapters don't expose them pre-solve; see leetcode.ts), so this
 *  only has anything to tally for platforms whose adapter actually captures them. */
export function computeTopicStats(
  sessions: CodingSession[],
  problems: Record<string, StoredProblem>,
  submissionsBySession: Record<string, StoredSubmission[]>,
): TopicStat[] {
  const topicMap: Record<string, TopicStat> = {};

  for (const session of sessions) {
    const problem = problems[session.problemKey];
    const subs = submissionsBySession[session.id] ?? [];
    if (!problem?.topics?.length || subs.length === 0) continue;
    const solved = subs.some((s) => s.status === 'Accepted');
    const firstAttemptSolved = subs.find((s) => s.attemptNumber === 1)?.status === 'Accepted';

    for (const topic of problem.topics) {
      const entry = topicMap[topic] ?? {
        topic,
        solved: 0,
        attempted: 0,
        firstAttemptSuccesses: 0,
        totalSolvedActiveMs: 0,
      };
      entry.attempted += 1;
      if (solved) {
        entry.solved += 1;
        entry.totalSolvedActiveMs += session.activeMs;
      }
      if (firstAttemptSolved) entry.firstAttemptSuccesses += 1;
      topicMap[topic] = entry;
    }
  }

  return Object.values(topicMap);
}
