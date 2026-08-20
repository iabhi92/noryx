import { useCallback, useEffect, useState } from 'react';
import { getAllProblems, getAllSessions, getAllSubmissions } from '../lib/storage';
import { formatDuration } from '../lib/format';
import type { CodingSession, StoredSubmission } from '../lib/types';
import Sidebar from './components/Sidebar';
import StatTile from './components/StatTile';
import ProblemsTable, { type ProblemRow } from './components/ProblemsTable';
import CoachPanel from './components/CoachPanel';
import Settings from './components/Settings';
import Sessions from './components/Sessions';
import Analytics from './components/Analytics';
import Roadmap from './components/Roadmap';
import DailySummary from './components/DailySummary';
import { Skeleton } from './components/Skeleton';

function rankFor(solved: number): string {
  if (solved >= 100) return 'Elite Coder';
  if (solved >= 30) return 'Expert Coder';
  if (solved >= 10) return 'Skilled Coder';
  if (solved >= 1) return 'Rising Coder';
  return 'Getting Started';
}

function computeStreak(sessions: CodingSession[]): number {
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

export default function App() {
  const [view, setView] = useState<'dashboard' | 'sessions' | 'analytics' | 'roadmap' | 'settings'>('dashboard');
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [stats, setStats] = useState({ solved: 0, activeTime: 0, successRate: 0, streak: 0 });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [problems, sessions, submissionsBySession] = await Promise.all([
      getAllProblems(),
      getAllSessions(),
      getAllSubmissions(),
    ]);

      const sessionList = Object.values(sessions);

      const problemRows: ProblemRow[] = sessionList
        .map((session): ProblemRow | null => {
          const problem = problems[session.problemKey];
          if (!problem) return null;
          const submissions = submissionsBySession[session.id] ?? [];
          const latest = submissions[submissions.length - 1];
          return {
            key: session.id,
            platform: problem.platform,
            title: problem.title,
            difficulty: problem.difficulty,
            language: latest?.language,
            status: latest?.status ?? 'In Progress',
            activeTime: formatDuration(session.activeMs),
            attempts: session.attempts,
            date: new Date(session.startedAt).toLocaleDateString(),
          };
        })
        .filter((row): row is ProblemRow => row !== null)
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      const allSubmissions: StoredSubmission[] = Object.values(submissionsBySession).flat();
      const solved = new Set(
        sessionList
          .filter((s) => (submissionsBySession[s.id] ?? []).some((sub) => sub.status === 'Accepted'))
          .map((s) => s.problemKey),
      ).size;
      const totalActiveMs = sessionList.reduce((sum, s) => sum + s.activeMs, 0);
      const successRate = allSubmissions.length
        ? Math.round((allSubmissions.filter((s) => s.status === 'Accepted').length / allSubmissions.length) * 100)
        : 0;

    setRows(problemRows);
    setStats({ solved, activeTime: totalActiveMs, successRate, streak: computeStreak(sessionList) });
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  return (
    <div className="bg-background text-on-surface mesh-bg min-h-screen flex">
      <Sidebar activeView={view} onNavigate={setView} />
      <main className="flex-grow md:ml-64 p-gutter lg:p-margin max-w-[1440px] mx-auto w-full">
        <div className="mb-md flex flex-col md:flex-row justify-between items-start md:items-end gap-sm">
          <div>
            <h1 className="font-display text-headline-lg-mobile md:text-display text-on-surface mb-1">
              <span className="text-gradient">Noryx</span>
            </h1>
            <p className="font-body-md text-on-surface-variant">Your coding sessions, tracked automatically.</p>
          </div>
          <div className="bg-surface-elevated border border-electric-blue/30 rounded-full px-sm py-xs flex items-center gap-xs shadow-[0_0_10px_rgba(14,165,233,0.2)]">
            <span className="text-xl">🏆</span>
            <span className="font-label-sm text-label-sm text-electric-blue uppercase">{rankFor(stats.solved)}</span>
          </div>
        </div>
        {view === 'settings' ? (
          <Settings />
        ) : view === 'sessions' ? (
          <Sessions />
        ) : view === 'analytics' ? (
          <Analytics />
        ) : view === 'roadmap' ? (
          <Roadmap onOpenSettings={() => setView('settings')} />
        ) : (
          <>
            <DailySummary />
            <CoachPanel onOpenSettings={() => setView('settings')} />
            {!loaded ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-sm mb-md">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-48 w-full" />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-sm mb-md">
                  <StatTile icon="✅" label="Problems Solved" value={String(stats.solved)} />
                  <StatTile icon="⏱️" label="Active Coding Time" value={formatDuration(stats.activeTime)} />
                  <StatTile icon="🎯" label="Success Rate" value={`${stats.successRate}%`} />
                  <StatTile icon="🔥" label="Current Streak" value={`${stats.streak}d`} />
                </div>
                <ProblemsTable rows={rows} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
