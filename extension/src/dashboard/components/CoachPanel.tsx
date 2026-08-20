import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAllSessions,
  getAllProblems,
  getAllSubmissions,
  getSubmissionsForSession,
  getHintsForSession,
} from '../../lib/storage';
import { getSettings } from '../../lib/settings';
import { useCoach, type CoachTarget } from '../../lib/hooks/useCoach';
import { formatElapsed } from '../../lib/format';
import { CircularTimer } from '../../lib/CircularTimer';
import { MAX_AUTO_HINT_LEVEL } from '../../lib/ai/intervention';
import { Skeleton } from './Skeleton';
import type { CodingSession, StoredProblem, StoredSubmission, StoredHint } from '../../lib/types';

const JUST_SOLVED_WINDOW_MS = 5 * 60 * 1000;

/** PRD §12 — a one-line comparison against past solves of the same difficulty. Pure arithmetic
 *  over already-tracked data, no AI call needed for something this mechanical. Needs at least one
 *  other solved session at the same difficulty to compare against, and a difficulty label at all
 *  (cross-platform scales aren't comparable, so this only ever compares within one platform's own
 *  labels — a LeetCode "Medium" against other LeetCode "Medium"s, never against a CF rating). */
function buildPostSolveInsight(
  target: CoachTarget,
  allSessions: CodingSession[],
  allProblems: Record<string, StoredProblem>,
  allSubmissionsBySession: Record<string, StoredSubmission[]>,
): string | null {
  const difficulty = target.problem.difficulty;
  if (!difficulty) return null;

  const priorTimes = allSessions
    .filter((s) => s.id !== target.session.id)
    .filter((s) => {
      const p = allProblems[s.problemKey];
      return p?.platform === target.problem.platform && p?.difficulty === difficulty;
    })
    .filter((s) => (allSubmissionsBySession[s.id] ?? []).some((sub) => sub.status === 'Accepted'))
    .map((s) => s.activeMs)
    .filter((ms) => ms > 0);

  if (priorTimes.length === 0) return null;

  const avg = priorTimes.reduce((sum, ms) => sum + ms, 0) / priorTimes.length;
  const thisTime = target.session.activeMs;
  const pctDiff = Math.round(((avg - thisTime) / avg) * 100);

  const timeStr = formatElapsed(thisTime);
  if (Math.abs(pctDiff) < 5) {
    return `Accepted in ${timeStr} — right around your usual pace for ${target.problem.platform} ${difficulty}.`;
  }
  return pctDiff > 0
    ? `Accepted in ${timeStr} — ${pctDiff}% faster than your average ${target.problem.platform} ${difficulty}.`
    : `Accepted in ${timeStr} — ${Math.abs(pctDiff)}% slower than your average ${target.problem.platform} ${difficulty}. That's fine — speed isn't the metric that matters.`;
}

const LEVEL_LABEL: Record<StoredHint['level'], string> = {
  1: 'Nudge',
  2: 'Direction',
  3: 'Pattern',
  4: 'Concept',
  solution: 'Solution',
};

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <span className="text-lg leading-none">🤖</span>
      <div className="bg-surface-container rounded-2xl rounded-bl-sm px-sm py-xs flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/60 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface CoachPanelProps {
  onOpenSettings: () => void;
}

export default function CoachPanel({ onOpenSettings }: CoachPanelProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [active, setActive] = useState<CoachTarget | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hints, setHints] = useState<StoredHint[]>([]);
  const [now, setNow] = useState(Date.now());
  const [postSolveInsight, setPostSolveInsight] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const settings = await getSettings();
    setApiKey(settings.geminiApiKey ?? null);

    const [sessions, problems, submissionsBySession] = await Promise.all([
      getAllSessions(),
      getAllProblems(),
      getAllSubmissions(),
    ]);
    const sessionList = Object.values(sessions);
    const open = sessionList.filter((s) => !s.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0];
    const mostRecentEnded = sessionList
      .filter((s) => s.endedAt)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
    const justSolved =
      mostRecentEnded && Date.now() - (mostRecentEnded.endedAt ?? 0) < JUST_SOLVED_WINDOW_MS
        ? mostRecentEnded
        : undefined;
    const target = open ?? justSolved;

    if (!target) {
      setActive(null);
      setHints([]);
      setPostSolveInsight(null);
      setLoaded(true);
      return;
    }
    const problem = problems[target.problemKey];
    if (!problem) {
      setActive(null);
      setLoaded(true);
      return;
    }
    const [submissions, sessionHints] = await Promise.all([
      getSubmissionsForSession(target.id),
      getHintsForSession(target.id),
    ]);
    const activeSession = { session: target, problem, submissions };
    setActive(activeSession);
    setHints(sessionHints);
    setPostSolveInsight(
      target === justSolved ? buildPostSolveInsight(activeSession, sessionList, problems, submissionsBySession) : null,
    );
    setLoaded(true);
  }, []);

  const { question, setQuestion, busy, error, nextLevel, requestHint, handleComposerKeyDown, handleShowSolution } =
    useCoach(apiKey, active, () => void refresh());

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  // Re-render periodically so the live/away badge's "is the last heartbeat still fresh"
  // check stays current — the heartbeat itself only lands every 15s from the LeetCode tab.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [hints, busy]);

  if (!loaded) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-xs">
        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">🔑 Connect Gemini to enable coaching</h3>
        <p className="text-on-surface-variant text-sm">
          Noryx nudges you with hints while you're stuck — it needs a free Gemini API key to do
          that. Add one in Settings.
        </p>
        <button
          onClick={onOpenSettings}
          className="self-start bg-gradient-to-r from-electric-blue to-soft-violet text-on-primary font-label-sm rounded-lg px-sm py-xs text-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md text-on-surface-variant text-sm">
        🧑‍💻 Open a problem on LeetCode to get coached.
      </div>
    );
  }

  const atMaxLevel = active.session.hintLevel >= MAX_AUTO_HINT_LEVEL;
  // activeMs only counts time the LeetCode tab was actually focused and visible (see the
  // content script's heartbeat) — this is "time on the problem", not wall-clock since open.
  const elapsed = active.session.activeMs;
  const isLive = !!active.session.lastHeartbeatAt && now - active.session.lastHeartbeatAt < 20000;

  return (
    <div className="glass-card rounded-xl p-sm mb-md flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm flex-wrap">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-headline-md text-body-lg font-bold text-on-surface flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-electric-blue to-soft-violet text-base">
              🤖
            </span>
            Noryx Coach — {active.problem.title}
          </h3>
          <span className="text-on-surface-variant text-xs pl-9">{isLive ? '🟢 on LeetCode' : '⚪ away'}</span>
        </div>
        <CircularTimer elapsedMs={elapsed} isLive={isLive} size={64} />
      </div>

      {postSolveInsight && (
        <div className="bg-gradient-to-r from-electric-blue/15 to-soft-violet/15 border border-electric-blue/30 rounded-lg px-sm py-xs text-sm text-on-surface flex items-center gap-2">
          <span className="text-base">🏆</span>
          {postSolveInsight}
        </div>
      )}

      <div ref={scrollRef} className="flex flex-col gap-sm max-h-80 overflow-y-auto scroll-smooth px-1">
        {hints.length === 0 && !busy && (
          <div className="flex items-end gap-2">
            <span className="text-lg leading-none">🤖</span>
            <div className="bg-surface-container rounded-2xl rounded-bl-sm px-sm py-xs text-on-surface-variant text-sm max-w-[85%]">
              Stuck, or just want to talk through your approach? Ask me anything below — I won't
              write the solution unless you tell me to.
            </div>
          </div>
        )}
        {hints.map((h) => (
          <div key={h.id} className="flex flex-col gap-1.5">
            {h.userMessage && (
              <div className="flex justify-end">
                <div className="bg-gradient-to-br from-electric-blue to-soft-violet text-on-primary rounded-2xl rounded-br-sm px-sm py-xs text-sm max-w-[85%] whitespace-pre-wrap">
                  {h.userMessage}
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <span className="text-lg leading-none shrink-0">🤖</span>
              <div className="bg-surface-container rounded-2xl rounded-bl-sm px-sm py-xs max-w-[85%] flex flex-col gap-1">
                <span className="font-label-sm text-electric-blue text-[10px] uppercase tracking-wide">
                  {h.level === 'solution' ? '🔓 ' : '💡 '}
                  {LEVEL_LABEL[h.level]}
                  {h.auto ? ' · proactive' : ''}
                </span>
                <p className="text-on-surface text-sm whitespace-pre-wrap">{h.text}</p>
              </div>
            </div>
          </div>
        ))}
        {busy && <TypingBubble />}
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="flex items-end gap-xs bg-surface-container border border-white/10 rounded-2xl px-sm py-xs focus-within:border-electric-blue/60 transition-colors">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Tell Noryx what you're thinking…"
          rows={1}
          className="flex-1 bg-transparent text-on-surface text-sm outline-none resize-none py-1 placeholder:text-on-surface-variant/60"
        />
        <button
          disabled={busy}
          onClick={() => void requestHint(nextLevel)}
          aria-label={atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
          title={atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
          className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-electric-blue to-soft-violet text-on-primary flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
        >
          {busy ? '⏳' : '➤'}
        </button>
      </div>

      {atMaxLevel && (
        <button
          disabled={busy}
          onClick={handleShowSolution}
          className="self-start bg-surface-container border border-white/10 text-on-surface-variant font-label-sm rounded-lg px-sm py-xs text-sm disabled:opacity-50 hover:text-on-surface transition-all"
        >
          🔓 Show full solution
        </button>
      )}
    </div>
  );
}
