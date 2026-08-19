import { useEffect, useState } from 'react';
import { getAllProblems, getAllSessions, getAllSubmissions } from '../lib/storage';
import type { CodingSession, StoredSubmission } from '../lib/types';
import Sidebar from './components/Sidebar';
import StatTile from './components/StatTile';
import ProblemsTable, { type ProblemRow } from './components/ProblemsTable';

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [stats, setStats] = useState({ solved: 0, activeTime: 0, successRate: 0, streak: 0 });

  useEffect(() => {
    void (async () => {
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
    })();
  }, []);

  return (
    <div className="bg-background text-on-surface mesh-bg min-h-screen flex">
      <Sidebar />
      <main className="flex-grow md:ml-64 p-gutter lg:p-margin max-w-[1440px] mx-auto w-full">
        <div className="mb-md">
          <h1 className="font-display text-headline-lg-mobile md:text-display text-on-surface mb-1">
            <span className="text-gradient">Noryx</span>
          </h1>
          <p className="font-body-md text-on-surface-variant">Your coding sessions, tracked automatically.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-sm mb-md">
          <StatTile label="Problems Solved" value={String(stats.solved)} />
          <StatTile label="Active Coding Time" value={formatDuration(stats.activeTime)} />
          <StatTile label="Success Rate" value={`${stats.successRate}%`} />
          <StatTile label="Current Streak" value={`${stats.streak}d`} />
        </div>
        <ProblemsTable rows={rows} />
      </main>
    </div>
  );
}
