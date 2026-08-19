import { useCallback, useEffect, useState } from 'react';
import {
  getAllSessions,
  getAllProblems,
  getSubmissionsForSession,
  getHintsForSession,
  addHint,
  updateSessionHintState,
} from '../../lib/storage';
import { getSettings, saveSettings } from '../../lib/settings';
import { GeminiProvider } from '../../lib/ai/gemini-provider';
import { MAX_AUTO_HINT_LEVEL } from '../../lib/ai/intervention';
import { AIProviderError } from '../../lib/ai/types';
import type { CodingSession, StoredProblem, StoredSubmission, StoredHint, HintLevel } from '../../lib/types';

interface ActiveSession {
  session: CodingSession;
  problem: StoredProblem;
  submissions: StoredSubmission[];
}

export default function CoachPanel() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hints, setHints] = useState<StoredHint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const settings = await getSettings();
    setApiKey(settings.geminiApiKey ?? null);

    const [sessions, problems] = await Promise.all([getAllSessions(), getAllProblems()]);
    const inProgress = Object.values(sessions)
      .filter((s) => !s.endedAt)
      .sort((a, b) => b.startedAt - a.startedAt)[0];

    if (!inProgress) {
      setActive(null);
      setHints([]);
      setLoaded(true);
      return;
    }
    const problem = problems[inProgress.problemKey];
    if (!problem) {
      setActive(null);
      setLoaded(true);
      return;
    }
    const [submissions, sessionHints] = await Promise.all([
      getSubmissionsForSession(inProgress.id),
      getHintsForSession(inProgress.id),
    ]);
    setActive({ session: inProgress, problem, submissions });
    setHints(sessionHints);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    await saveSettings({ geminiApiKey: keyInput.trim() });
    setKeyInput('');
    void refresh();
  }

  async function requestHint(level: HintLevel | 'solution') {
    if (!apiKey || !active) return;
    setBusy(true);
    setError(null);
    try {
      const provider = new GeminiProvider(apiKey);
      const hint = await provider.generateHint({
        problem: active.problem,
        session: active.session,
        submissions: active.submissions,
        level,
      });
      const now = Date.now();
      await addHint({
        sessionId: active.session.id,
        level: hint.level,
        text: hint.text,
        createdAt: now,
        auto: false,
      });
      if (level !== 'solution') {
        await updateSessionHintState(active.session.id, level, now);
      }
      void refresh();
    } catch (err) {
      setError(err instanceof AIProviderError ? err.message : 'Something went wrong asking for a hint.');
    } finally {
      setBusy(false);
    }
  }

  function handleShowSolution() {
    const confirmed = window.confirm(
      'Viewing the full solution will affect your learning for this problem. Are you sure?',
    );
    if (confirmed) void requestHint('solution');
  }

  if (!loaded) return null;

  if (!apiKey) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">Connect Gemini to enable coaching</h3>
        <p className="text-on-surface-variant text-sm">
          Noryx nudges you with hints while you're stuck — it needs a free Gemini API key to do
          that. Stored locally in your browser, sent only to Google's API.
        </p>
        <div className="flex gap-xs flex-wrap">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Gemini API key"
            className="flex-1 min-w-[200px] bg-surface-container border border-white/10 text-on-surface rounded-lg px-sm py-xs text-sm outline-none focus:border-electric-blue"
          />
          <button
            onClick={() => void handleSaveKey()}
            className="bg-gradient-to-r from-electric-blue to-soft-violet text-on-primary font-label-sm rounded-lg px-sm py-xs text-sm"
          >
            Save
          </button>
        </div>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-electric-blue text-sm"
        >
          Get a free key →
        </a>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md text-on-surface-variant text-sm">
        Open a problem to get coached.
      </div>
    );
  }

  const nextLevel = Math.min(active.session.hintLevel + 1, MAX_AUTO_HINT_LEVEL) as HintLevel;
  const atMaxLevel = active.session.hintLevel >= MAX_AUTO_HINT_LEVEL;

  return (
    <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-sm">
      <h3 className="font-headline-md text-body-lg font-bold text-on-surface">
        Noryx Coach — {active.problem.title}
      </h3>

      <div className="flex flex-col gap-xs max-h-64 overflow-y-auto">
        {hints.length === 0 && <p className="text-on-surface-variant text-sm">No hints yet for this session.</p>}
        {hints.map((h) => (
          <div key={h.id} className="bg-surface-container rounded-lg p-xs">
            <span className="font-label-sm text-electric-blue text-xs mr-2">
              {h.level === 'solution' ? 'Solution' : `Level ${h.level}`}
              {h.auto ? ' · auto' : ''}
            </span>
            <p className="text-on-surface text-sm whitespace-pre-wrap">{h.text}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="flex gap-xs flex-wrap">
        <button
          disabled={busy}
          onClick={() => void requestHint(nextLevel)}
          className="bg-surface-container border border-electric-blue/30 text-electric-blue font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50"
        >
          {busy ? 'Asking…' : atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
        </button>
        {atMaxLevel && (
          <button
            disabled={busy}
            onClick={handleShowSolution}
            className="bg-surface-container border border-white/10 text-on-surface-variant font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50"
          >
            Show full solution
          </button>
        )}
      </div>
    </div>
  );
}
