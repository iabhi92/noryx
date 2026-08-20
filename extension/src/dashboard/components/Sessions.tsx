import { useCallback, useEffect, useState } from 'react';
import { getAllSessions, getAllProblems, getAllSubmissions, getAllHints } from '../../lib/storage';
import { formatDuration } from '../../lib/format';
import type { CodingSession, StoredProblem, StoredSubmission, StoredHint } from '../../lib/types';
import { StatusBadge } from './ProblemsTable';
import { Skeleton } from './Skeleton';

interface SessionRow {
  session: CodingSession;
  problem: StoredProblem;
  submissions: StoredSubmission[];
  hints: StoredHint[];
}

function formatTimeRange(startedAt: number, endedAt?: number): string {
  const start = new Date(startedAt);
  const startStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!endedAt) return `${startStr} → in progress`;
  const endStr = new Date(endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${startStr} → ${endStr}`;
}

function dayLabel(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Sessions() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [sessions, problems, submissionsBySession, hintsBySession] = await Promise.all([
      getAllSessions(),
      getAllProblems(),
      getAllSubmissions(),
      getAllHints(),
    ]);

    const list: SessionRow[] = Object.values(sessions)
      .map((session): SessionRow | null => {
        const problem = problems[session.problemKey];
        if (!problem) return null;
        return {
          session,
          problem,
          submissions: submissionsBySession[session.id] ?? [],
          hints: hintsBySession[session.id] ?? [],
        };
      })
      .filter((row): row is SessionRow => row !== null)
      .sort((a, b) => b.session.startedAt - a.session.startedAt);

    setRows(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-sm">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant flex flex-col items-center gap-2">
        <span className="text-6xl drop-shadow-[0_0_15px_rgba(14,165,233,0.6)]">🕐</span>
        <p>No sessions yet. Open a problem to start tracking.</p>
      </div>
    );
  }

  let lastDay: string | null = null;

  return (
    <div className="flex flex-col gap-sm">
      {rows.map(({ session, problem, submissions, hints }) => {
        const day = dayLabel(session.startedAt);
        const showDayHeader = day !== lastDay;
        lastDay = day;

        return (
          <div key={session.id} className="flex flex-col gap-xs">
            {showDayHeader && (
              <h3 className="font-label-sm text-on-surface-variant uppercase tracking-wide text-xs mt-sm first:mt-0">
                {day}
              </h3>
            )}
            <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
              <div className="flex items-center justify-between gap-sm flex-wrap">
                <div>
                  <h4 className="text-on-surface font-bold">{problem.title}</h4>
                  <p className="text-on-surface-variant text-xs capitalize">
                    {problem.platform} · {formatTimeRange(session.startedAt, session.endedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-sm text-xs text-on-surface-variant">
                  <span>⏱️ {formatDuration(session.activeMs)}</span>
                  <span>🔁 {session.attempts} attempt{session.attempts === 1 ? '' : 's'}</span>
                  {session.tabSwitches > 0 && <span>↔️ {session.tabSwitches} tab switches</span>}
                  {hints.length > 0 && <span>💡 {hints.length} hint{hints.length === 1 ? '' : 's'}</span>}
                </div>
              </div>
              {submissions.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {submissions.map((s, i) => (
                    <StatusBadge key={i} status={s.status} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
