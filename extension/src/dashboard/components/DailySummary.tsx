import { useCallback, useEffect, useState } from 'react';
import { getAllSessions, getAllProblems, getAllSubmissions } from '../../lib/storage';
import { computeTopicStats } from '../../lib/topicStats';
import { formatDuration } from '../../lib/format';

interface Summary {
  solvedToday: number;
  activeMsToday: number;
  strongTopic: string | null;
  weakTopic: string | null;
}

// PRD §13's "Daily AI Review" example includes a specific behavioral-narration line ("You spent
// 18 minutes on a brute-force approach before recognizing..."). That level of detail needs code
// content/keystroke tracking nothing here captures — inventing it would violate the one rule this
// whole app is built around (never invent data), so this sticks to what's actually derivable:
// today's real counts plus an all-time strong/weak topic split (≥2 attempts, so one lucky or
// unlucky problem doesn't crown a topic).
export default function DailySummary() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const refresh = useCallback(async () => {
    const [sessions, problems, submissionsBySession] = await Promise.all([
      getAllSessions(),
      getAllProblems(),
      getAllSubmissions(),
    ]);
    const sessionList = Object.values(sessions);
    const todayStr = new Date().toDateString();
    const todaySessions = sessionList.filter((s) => new Date(s.startedAt).toDateString() === todayStr);

    const solvedToday = todaySessions.filter((s) =>
      (submissionsBySession[s.id] ?? []).some((sub) => sub.status === 'Accepted'),
    ).length;
    const activeMsToday = todaySessions.reduce((sum, s) => sum + s.activeMs, 0);

    if (todaySessions.length === 0) {
      setSummary(null);
      return;
    }

    const ranked = computeTopicStats(sessionList, problems, submissionsBySession)
      .filter((t) => t.attempted >= 2)
      .map((t) => ({ topic: t.topic, rate: t.firstAttemptSuccesses / t.attempted }))
      .sort((a, b) => b.rate - a.rate);

    setSummary({
      solvedToday,
      activeMsToday,
      // Both require a second topic to compare against — with only one, its rate could be low
      // and calling it "strong" purely for being the sole data point would be misleading.
      strongTopic: ranked.length > 1 ? ranked[0].topic : null,
      weakTopic: ranked.length > 1 ? ranked[ranked.length - 1].topic : null,
    });
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  if (!summary) return null;

  return (
    <div className="glass-card rounded-xl p-sm mb-md flex flex-wrap items-center gap-sm">
      <span className="text-2xl">📅</span>
      <div className="flex flex-col">
        <span className="font-headline-md text-body-lg font-bold text-on-surface">Today</span>
        <span className="text-on-surface-variant text-sm">
          {summary.solvedToday} solved · {formatDuration(summary.activeMsToday)} active coding
          {summary.strongTopic && (
            <>
              {' · '}
              <span className="text-electric-blue">strong: {summary.strongTopic}</span>
            </>
          )}
          {summary.weakTopic && (
            <>
              {' · '}
              <span className="text-amber-400">needs work: {summary.weakTopic}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
