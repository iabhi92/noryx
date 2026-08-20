import { useCallback, useEffect, useState } from 'react';
import { getAllSessions, getAllProblems, getAllSubmissions } from '../../lib/storage';
import { computeTopicStats, type TopicStat } from '../../lib/topicStats';
import { formatDuration } from '../../lib/format';
import { Skeleton } from './Skeleton';
import type { StoredSubmission } from '../../lib/types';

// Validated categorical palette (dataviz skill, dark-mode slots 1-5) — passes lightness band,
// chroma floor, CVD separation (worst adjacent ΔE 8.4), and contrast vs a near-black (#131313)
// surface. Fixed order, never cycled; a 6th+ platform folds into the gray "Other" bucket instead
// of extending the ramp.
const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER_COLOR = '#5b6570';

// Reuses the same two-tone status convention already established in ProblemsTable/StatusBadge —
// electric-blue (now neon-cyan) for Accepted, error red for every failure kind, muted for
// in-progress. Status colors are reserved and never repurposed as a generic categorical slot.
const STATUS_COLOR: Record<string, string> = {
  Accepted: '#00f0ff',
  'Wrong Answer': '#ffb4ab',
  'Time Limit Exceeded': '#ffb4ab',
  'Runtime Error': '#ffb4ab',
  'Compilation Error': '#ffb4ab',
  'Memory Limit Exceeded': '#ffb4ab',
  Unknown: '#88929b',
};

interface BarDatum {
  label: string;
  value: number;
  color: string;
}


function HBar({ data, unit }: { data: BarDatum[]; unit: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="text-on-surface-variant text-sm">No data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div
          key={d.label}
          className="flex items-center gap-sm"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          tabIndex={0}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
        >
          <span className="w-28 shrink-0 text-xs text-on-surface-variant capitalize truncate">{d.label}</span>
          <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color,
                color: d.color,
                boxShadow: `0 0 8px ${d.color}`,
                opacity: hovered === null || hovered === i ? 1 : 0.55,
                filter: hovered === i ? 'brightness(1.15)' : undefined,
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-on-surface tabular-nums">
            {d.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityChart({ counts }: { counts: { day: string; label: string; value: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...counts.map((c) => c.value));

  return (
    <div className="flex items-end gap-1.5 h-32">
      {counts.map((c, i) => (
        <div
          key={c.day}
          className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          tabIndex={0}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
        >
          {hovered === i && (
            <span className="text-xs text-on-surface font-mono tabular-nums">{c.value}</span>
          )}
          <div
            className="w-full rounded-t-[4px] transition-all duration-150"
            style={{
              height: `${Math.max(4, (c.value / max) * 100)}%`,
              backgroundColor: '#00f0ff',
              boxShadow: c.value > 0 ? '0 0 8px rgba(0,240,255,0.6)' : undefined,
              opacity: c.value === 0 ? 0.15 : hovered === null || hovered === i ? 1 : 0.55,
            }}
          />
          <span className="text-[10px] text-on-surface-variant">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function bucketPlatforms(counts: Record<string, number>): BarDatum[] {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, CATEGORICAL.length);
  const rest = sorted.slice(CATEGORICAL.length);
  const bars = top.map(([label, value], i) => ({ label, value, color: CATEGORICAL[i] }));
  const otherTotal = rest.reduce((sum, [, v]) => sum + v, 0);
  if (otherTotal > 0) bars.push({ label: 'Other', value: otherTotal, color: OTHER_COLOR });
  return bars;
}

export default function Analytics() {
  const [platformBars, setPlatformBars] = useState<BarDatum[]>([]);
  const [statusBars, setStatusBars] = useState<BarDatum[]>([]);
  const [activity, setActivity] = useState<{ day: string; label: string; value: number }[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [sessions, problems, submissionsBySession] = await Promise.all([
      getAllSessions(),
      getAllProblems(),
      getAllSubmissions(),
    ]);

    const sessionList = Object.values(sessions);
    const platformCounts: Record<string, number> = {};
    for (const session of sessionList) {
      const problem = problems[session.problemKey];
      if (!problem) continue;
      platformCounts[problem.platform] = (platformCounts[problem.platform] ?? 0) + 1;
    }
    const topicStatsList = computeTopicStats(sessionList, problems, submissionsBySession);

    const allSubmissions: StoredSubmission[] = Object.values(submissionsBySession).flat();
    const statusCounts: Record<string, number> = {};
    for (const sub of allSubmissions) {
      statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1;
    }
    const statusBarsList = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: STATUS_COLOR[label] ?? OTHER_COLOR }));

    const acceptedByDay: Record<string, number> = {};
    for (const sub of allSubmissions) {
      if (sub.status !== 'Accepted') continue;
      const day = new Date(sub.timestamp).toDateString();
      acceptedByDay[day] = (acceptedByDay[day] ?? 0) + 1;
    }
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return {
        day: d.toDateString(),
        label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        value: acceptedByDay[d.toDateString()] ?? 0,
      };
    });

    setPlatformBars(bucketPlatforms(platformCounts));
    setStatusBars(statusBarsList);
    setActivity(last14);
    setTopicStats(topicStatsList.sort((a, b) => b.attempted - a.attempted));
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
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="glass-card rounded-xl p-sm">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface mb-sm">📈 Accepted, last 14 days</h3>
        <ActivityChart counts={activity} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
        <div className="glass-card rounded-xl p-sm">
          <h3 className="font-headline-md text-body-lg font-bold text-on-surface mb-sm">🌐 Platforms</h3>
          <HBar data={platformBars} unit="sessions" />
        </div>
        <div className="glass-card rounded-xl p-sm">
          <h3 className="font-headline-md text-body-lg font-bold text-on-surface mb-sm">📊 Submission outcomes</h3>
          <HBar data={statusBars} unit="" />
        </div>
      </div>
      <div className="glass-card rounded-xl p-sm">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface mb-sm">🧠 Topic performance</h3>
        {topicStats.length === 0 ? (
          <p className="text-on-surface-variant text-sm">
            No topic data yet — most platforms don't expose a problem's topics until you're
            already solving it (only Codeforces currently does, of the ones Noryx tracks). This
            fills in as you solve tagged problems there.
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            {topicStats.map((t, i) => {
              const firstAttemptRate = t.attempted ? Math.round((t.firstAttemptSuccesses / t.attempted) * 100) : 0;
              const avgTime = t.solved ? t.totalSolvedActiveMs / t.solved : 0;
              const color = i % 2 === 0 ? '#00f0ff' : '#f8acff';
              return (
                <div key={t.topic}>
                  <div className="flex justify-between items-baseline font-label-sm text-on-surface-variant text-xs mb-1">
                    <span className="text-on-surface font-medium capitalize">{t.topic}</span>
                    <span className="text-on-surface-variant">
                      ✅ {t.solved} solved{t.solved > 0 ? ` · ⏱️ ${formatDuration(avgTime)} avg` : ''}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${firstAttemptRate}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                    />
                  </div>
                  <div className="text-right text-[10px] mt-0.5" style={{ color }}>
                    {firstAttemptRate}% first-attempt
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
