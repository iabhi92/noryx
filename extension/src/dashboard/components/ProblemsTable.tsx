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

const STATUS_STYLE: Record<string, string> = {
  Accepted: 'bg-electric-blue/15 text-electric-blue border-electric-blue/30',
  'Wrong Answer': 'bg-error/15 text-error border-error/30',
  'Time Limit Exceeded': 'bg-error/15 text-error border-error/30',
  'Runtime Error': 'bg-error/15 text-error border-error/30',
  'Compilation Error': 'bg-error/15 text-error border-error/30',
  'In Progress': 'bg-on-surface-variant/15 text-on-surface-variant border-on-surface-variant/30',
};

const STATUS_EMOJI: Record<string, string> = {
  Accepted: '✅',
  'Wrong Answer': '❌',
  'Time Limit Exceeded': '⏰',
  'Runtime Error': '💥',
  'Compilation Error': '🛠️',
  'In Progress': '🕐',
};

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: 'text-electric-blue',
  Medium: 'text-amber-400',
  Hard: 'text-error',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE['In Progress'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {STATUS_EMOJI[status] ?? '•'} {status}
    </span>
  );
}

export default function ProblemsTable({ rows }: { rows: ProblemRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant flex flex-col items-center gap-2">
        <span className="text-6xl drop-shadow-[0_0_15px_rgba(14,165,233,0.6)]">🧭</span>
        <p>No sessions tracked yet. Open a LeetCode problem to get started.</p>
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
            <tr key={row.key} className="border-t border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-sm py-xs text-on-surface font-medium">{row.title}</td>
              <td className="px-sm py-xs capitalize">{row.platform}</td>
              <td className={`px-sm py-xs font-medium ${row.difficulty ? DIFFICULTY_STYLE[row.difficulty] ?? '' : ''}`}>
                {row.difficulty ?? '—'}
              </td>
              <td className="px-sm py-xs font-code-md">{row.language ?? '—'}</td>
              <td className="px-sm py-xs">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-sm py-xs font-mono tabular-nums">{row.activeTime}</td>
              <td className="px-sm py-xs">{row.attempts}</td>
              <td className="px-sm py-xs text-on-surface-variant">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
