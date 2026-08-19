export interface ProblemRow {
  key: string;
  platform: string;
  title: string;
  difficulty?: string;
  language?: string;
  status: string;
  activeTime: string;
  attempts: number;
  date: string;
}

const STATUS_COLOR: Record<string, string> = {
  Accepted: 'text-electric-blue',
  'Wrong Answer': 'text-error',
  'In Progress': 'text-on-surface-variant',
};

export default function ProblemsTable({ rows }: { rows: ProblemRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant">
        No sessions tracked yet. Open a LeetCode problem to get started.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left font-body-md text-sm">
        <thead className="bg-surface-container-lowest/50 text-on-surface-variant uppercase text-xs">
          <tr>
            <th className="px-sm py-xs">Problem</th>
            <th className="px-sm py-xs">Platform</th>
            <th className="px-sm py-xs">Difficulty</th>
            <th className="px-sm py-xs">Language</th>
            <th className="px-sm py-xs">Status</th>
            <th className="px-sm py-xs">Active Time</th>
            <th className="px-sm py-xs">Attempts</th>
            <th className="px-sm py-xs">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-sm py-xs text-on-surface">{row.title}</td>
              <td className="px-sm py-xs capitalize">{row.platform}</td>
              <td className="px-sm py-xs">{row.difficulty ?? '—'}</td>
              <td className="px-sm py-xs font-code-md">{row.language ?? '—'}</td>
              <td className={`px-sm py-xs ${STATUS_COLOR[row.status] ?? 'text-on-surface-variant'}`}>{row.status}</td>
              <td className="px-sm py-xs">{row.activeTime}</td>
              <td className="px-sm py-xs">{row.attempts}</td>
              <td className="px-sm py-xs">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
