import { useCallback, useEffect, useState } from 'react';
import { getAllReviews, getAllProblems, recordReviewOutcome } from '../../lib/storage';
import type { ReviewState, StoredProblem } from '../../lib/types';
import { Skeleton } from './Skeleton';

interface DueItem {
  review: ReviewState;
  problem: StoredProblem;
}

const BOX_COUNT = 7;

export default function ReviewQueue() {
  const [due, setDue] = useState<DueItem[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [nextDueAt, setNextDueAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [reviews, problems] = await Promise.all([getAllReviews(), getAllProblems()]);
    const now = Date.now();
    const all = Object.values(reviews);
    const dueItems = all
      .filter((r) => r.dueAt <= now && problems[r.problemKey])
      .map((review) => ({ review, problem: problems[review.problemKey] }))
      .sort((a, b) => a.review.dueAt - b.review.dueAt);
    const upcoming = all.filter((r) => r.dueAt > now);

    setDue(dueItems);
    setUpcomingCount(upcoming.length);
    setNextDueAt(upcoming.length ? Math.min(...upcoming.map((r) => r.dueAt)) : null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  async function handleOutcome(problemKey: string, remembered: boolean) {
    setBusyKey(problemKey);
    try {
      await recordReviewOutcome(problemKey, remembered);
      setDue((prev) => prev.filter((item) => item.review.problemKey !== problemKey));
    } finally {
      setBusyKey(null);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-sm max-w-2xl">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm max-w-2xl">
      <div className="glass-card rounded-xl p-sm flex flex-wrap gap-sm text-sm text-on-surface-variant">
        <span>🔔 {due.length} due now</span>
        <span>📅 {upcomingCount} scheduled ahead</span>
        {nextDueAt && <span>⏭️ next up {new Date(nextDueAt).toLocaleDateString()}</span>}
      </div>

      {due.length === 0 ? (
        <div className="glass-card rounded-xl p-sm text-on-surface-variant text-sm">
          Queue's clear. Solved problems land here on a spaced schedule so you revisit them before
          you'd forget — nothing due right now.
        </div>
      ) : (
        <div className="flex flex-col gap-xs">
          {due.map(({ review, problem }) => (
            <div
              key={review.problemKey}
              className="glass-card rounded-xl p-sm flex items-center justify-between gap-sm flex-wrap"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-headline-md text-body-lg font-bold text-on-surface hover:text-electric-blue transition-colors truncate"
                >
                  {problem.title}
                </a>
                <div className="flex items-center gap-xs text-xs text-on-surface-variant">
                  <span className="uppercase">{problem.platform}</span>
                  {problem.difficulty && <span>· {problem.difficulty}</span>}
                  <span>· box {review.box + 1}/{BOX_COUNT}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={busyKey === review.problemKey}
                  onClick={() => void handleOutcome(review.problemKey, false)}
                  className="border border-white/10 text-on-surface-variant font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50 hover:text-on-surface hover:border-white/30 transition-all"
                >
                  🙀 Forgot
                </button>
                <button
                  disabled={busyKey === review.problemKey}
                  onClick={() => void handleOutcome(review.problemKey, true)}
                  className="bg-gradient-to-r from-electric-blue/20 to-soft-violet/20 border border-electric-blue/30 text-electric-blue font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50 hover:from-electric-blue/30 hover:to-soft-violet/30 transition-all"
                >
                  😻 Remembered
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
