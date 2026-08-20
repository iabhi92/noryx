import { useCallback, useEffect, useState } from 'react';
import { getAllSessions, getAllProblems, getAllSubmissions, getRoadmap, saveRoadmap } from '../../lib/storage';
import { getSettings } from '../../lib/settings';
import { GeminiProvider } from '../../lib/ai/gemini-provider';
import { AIProviderError, type ProgressContext, type ProgressInsight } from '../../lib/ai/types';
import type { StoredSubmission } from '../../lib/types';
import { Skeleton } from './Skeleton';

interface RoadmapProps {
  onOpenSettings: () => void;
}

function count<T extends string>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] ?? 0) + 1;
  return out;
}

export default function Roadmap({ onOpenSettings }: RoadmapProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [context, setContext] = useState<ProgressContext | null>(null);
  const [insight, setInsight] = useState<ProgressInsight | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const settings = await getSettings();
    setApiKey(settings.geminiApiKey ?? null);

    const [sessions, problems, submissionsBySession, cachedRoadmap] = await Promise.all([
      getAllSessions(),
      getAllProblems(),
      getAllSubmissions(),
      getRoadmap(),
    ]);

    const sessionList = Object.values(sessions);
    const allSubmissions: StoredSubmission[] = Object.values(submissionsBySession).flat();
    const solvedKeys = new Set(
      sessionList
        .filter((s) => (submissionsBySession[s.id] ?? []).some((sub) => sub.status === 'Accepted'))
        .map((s) => s.problemKey),
    );

    const platforms = sessionList.map((s) => problems[s.problemKey]?.platform).filter((p): p is string => !!p);
    const difficulties = sessionList
      .map((s) => problems[s.problemKey]?.difficulty)
      .filter((d): d is string => !!d);
    const topics = sessionList.flatMap((s) => problems[s.problemKey]?.topics ?? []);

    setContext({
      totalSolved: solvedKeys.size,
      totalAttempted: sessionList.length,
      successRate: allSubmissions.length
        ? Math.round((allSubmissions.filter((s) => s.status === 'Accepted').length / allSubmissions.length) * 100)
        : 0,
      platformCounts: count(platforms),
      difficultyCounts: count(difficulties),
      topicCounts: count(topics),
    });
    setInsight(cachedRoadmap);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  async function handleGenerate() {
    if (!apiKey || !context) return;
    setBusy(true);
    setError(null);
    try {
      const provider = new GeminiProvider(apiKey);
      const result = await provider.analyzeProgress(context);
      await saveRoadmap(result);
      setInsight(result);
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Something went wrong generating the roadmap.');
    } finally {
      setBusy(false);
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

  if (!apiKey) {
    return (
      <div className="glass-card rounded-xl p-sm flex flex-col gap-xs max-w-xl">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">🔑 Connect Gemini to generate a roadmap</h3>
        <p className="text-on-surface-variant text-sm">Add a free Gemini API key in Settings first.</p>
        <button
          onClick={onOpenSettings}
          className="self-start bg-gradient-to-r from-electric-blue to-soft-violet text-on-primary font-label-sm rounded-lg px-sm py-xs text-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm max-w-2xl">
      {context && (
        <div className="glass-card rounded-xl p-sm flex flex-wrap gap-sm text-sm text-on-surface-variant">
          <span>✅ {context.totalSolved} solved</span>
          <span>🔁 {context.totalAttempted} attempted</span>
          <span>🎯 {context.successRate}% success rate</span>
        </div>
      )}

      <div className="glass-card rounded-xl p-sm flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm flex-wrap">
          <h3 className="font-headline-md text-body-lg font-bold text-on-surface">🗺️ Your roadmap</h3>
          <button
            disabled={busy}
            onClick={() => void handleGenerate()}
            className="bg-gradient-to-r from-electric-blue/20 to-soft-violet/20 border border-electric-blue/30 text-electric-blue font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50 hover:from-electric-blue/30 hover:to-soft-violet/30 transition-all"
          >
            {busy ? '⏳ Generating…' : insight ? '🔄 Regenerate' : '✨ Generate roadmap'}
          </button>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        {insight ? (
          <>
            <p className="text-on-surface text-sm whitespace-pre-wrap leading-relaxed">{insight.text}</p>
            <p className="text-on-surface-variant text-xs">
              Generated {new Date(insight.generatedAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-on-surface-variant text-sm">
            Ask Noryx for a personalized set of focus areas based on what you've tracked so far.
            {context && context.totalAttempted < 5 && (
              <> Heads up — with this little history, it&rsquo;ll lean on general beginner-friendly guidance rather than personal patterns.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
