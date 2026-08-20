import { getAllSessions, getAllProblems, getAllSubmissions } from './storage';
import { computeTopicStats } from './topicStats';
import type { CodingSession } from './types';

export function computeStreak(sessions: CodingSession[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => new Date(s.startedAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface ProfileStats {
  solved: number;
  streak: number;
  successRate: number;
  platformCounts: Record<string, number>;
  topicHighlights: Record<string, number>;
}

/** The aggregate slice of local data that's allowed to leave the device for the public-profile
 *  share link (PRD §16/§17: minimum relevant context only) — counts and rollups, never
 *  individual problems, code, or timestamps. */
export async function computeProfileStats(): Promise<ProfileStats> {
  const [sessions, problems, submissionsBySession] = await Promise.all([
    getAllSessions(),
    getAllProblems(),
    getAllSubmissions(),
  ]);
  const sessionList = Object.values(sessions);

  const solved = new Set(
    sessionList
      .filter((s) => (submissionsBySession[s.id] ?? []).some((sub) => sub.status === 'Accepted'))
      .map((s) => s.problemKey),
  ).size;

  const allSubmissions = Object.values(submissionsBySession).flat();
  const successRate = allSubmissions.length
    ? Math.round((allSubmissions.filter((s) => s.status === 'Accepted').length / allSubmissions.length) * 100)
    : 0;

  const platformCounts: Record<string, number> = {};
  for (const session of sessionList) {
    const platform = problems[session.problemKey]?.platform;
    if (platform) platformCounts[platform] = (platformCounts[platform] ?? 0) + 1;
  }

  const topicHighlights: Record<string, number> = {};
  for (const t of computeTopicStats(sessionList, problems, submissionsBySession)) {
    if (t.solved > 0) topicHighlights[t.topic] = t.solved;
  }

  return { solved, streak: computeStreak(sessionList), successRate, platformCounts, topicHighlights };
}
