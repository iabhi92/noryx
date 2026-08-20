import { useCallback, useEffect, useState } from 'react';
import { getPracticeProblem, savePracticeProblem } from '../../lib/storage';
import { getSettings } from '../../lib/settings';
import { GeminiProvider } from '../../lib/ai/gemini-provider';
import { AIProviderError } from '../../lib/ai/types';
import { verifyTestCases } from '../../lib/practiceVerify';
import type { PracticeProblem } from '../../lib/types';
import { Skeleton } from './Skeleton';

interface PracticeProps {
  onOpenSettings: () => void;
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function Practice({ onOpenSettings }: PracticeProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<PracticeProblem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [topic, setTopic] = useState('arrays');
  const [difficulty, setDifficulty] = useState('Easy');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const settings = await getSettings();
    setApiKey(settings.geminiApiKey ?? null);
    setProblem(await getPracticeProblem());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  async function handleGenerate() {
    if (!apiKey || !topic.trim()) return;
    setBusy(true);
    setError(null);
    setStatus('Asking Gemini for a problem…');
    try {
      const provider = new GeminiProvider(apiKey);
      const generated = await provider.generatePracticeProblem(topic.trim(), difficulty);
      setStatus('Verifying its test cases against its own reference solution…');
      const { verified, discardedCount } = await verifyTestCases(generated);
      if (verified.length === 0) {
        setError("Couldn't verify any of the generated test cases — try regenerating.");
        return;
      }
      const stored: PracticeProblem = {
        title: generated.title,
        statement: generated.statement,
        difficulty: generated.difficulty,
        topics: generated.topics,
        functionName: generated.functionName,
        testCases: verified,
        referenceSolutionJS: generated.referenceSolutionJS,
        discardedCount,
        generatedAt: Date.now(),
      };
      await savePracticeProblem(stored);
      setProblem(stored);
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Something went wrong generating this problem.');
    } finally {
      setBusy(false);
      setStatus(null);
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
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">🔑 Connect Gemini to generate problems</h3>
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
      <div className="glass-card rounded-xl p-sm flex flex-col gap-sm">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">✨ Generate a custom problem</h3>
        <div className="flex flex-wrap items-center gap-sm">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="topic, e.g. sliding window"
            className="bg-transparent border border-white/10 rounded-lg px-sm py-xs text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-electric-blue/40"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-surface-elevated border border-white/10 rounded-lg px-sm py-xs text-sm text-on-surface outline-none focus:border-electric-blue/40"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !topic.trim()}
            onClick={() => void handleGenerate()}
            className="bg-gradient-to-r from-electric-blue/20 to-soft-violet/20 border border-electric-blue/30 text-electric-blue font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50 hover:from-electric-blue/30 hover:to-soft-violet/30 transition-all"
          >
            {busy ? `⏳ ${status ?? 'Working…'}` : '✨ Generate'}
          </button>
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
      </div>

      {problem && (
        <div className="glass-card rounded-xl p-sm flex flex-col gap-sm">
          <div className="flex items-center justify-between gap-sm flex-wrap">
            <h3 className="font-headline-md text-body-lg font-bold text-on-surface">{problem.title}</h3>
            <div className="flex items-center gap-xs text-xs text-on-surface-variant uppercase">
              <span>{problem.difficulty}</span>
              {problem.topics.map((t) => (
                <span key={t} className="border border-white/10 rounded-full px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-on-surface text-sm whitespace-pre-wrap leading-relaxed">{problem.statement}</p>
          <div className="font-code-md text-xs text-on-surface-variant">
            function signature: <span className="text-electric-blue">{problem.functionName}(...)</span>
          </div>
          <div className="flex flex-col gap-xs">
            <p className="text-on-surface-variant text-xs uppercase tracking-wide">
              verified test cases ({problem.testCases.length}
              {problem.discardedCount > 0 ? `, ${problem.discardedCount} discarded as unverifiable` : ''})
            </p>
            {problem.testCases.map((tc, i) => (
              <div key={i} className="font-code-md text-xs text-on-surface bg-surface-elevated/50 rounded-lg px-sm py-xs">
                {problem.functionName}({tc.args.map((a) => JSON.stringify(a)).join(', ')}) → {JSON.stringify(tc.expected)}
              </div>
            ))}
          </div>
          <p className="text-on-surface-variant text-xs">
            Generated {new Date(problem.generatedAt).toLocaleString()}. Solve it in your own editor, then check your
            output against these cases.
          </p>
        </div>
      )}
    </div>
  );
}
