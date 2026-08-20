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
    <div className="chat-block-agent flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-electric-blue/60 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
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
        <h3 className="font-code-md text-sm uppercase tracking-wider text-on-surface">// connect_gemini</h3>
        <p className="text-on-surface-variant text-sm">
          Noryx nudges you with hints while you're stuck — it needs a free Gemini API key to do
          that. Add one in Settings.
        </p>
        <button
          onClick={onOpenSettings}
          className="self-start bg-transparent border border-electric-blue/30 text-electric-blue font-code-md text-xs py-2 px-4 uppercase hover:bg-electric-blue/10 hover:border-electric-blue/60 transition-all"
        >
          Open Settings
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="glass-card rounded-xl p-sm mb-md text-on-surface-variant text-sm font-code-md">
        // open a problem on LeetCode to get coached
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
      <div className="flex items-center justify-between gap-sm flex-wrap border-b border-white/5 pb-sm">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-code-md text-lg text-on-surface tracking-tight uppercase flex items-center gap-2">
            <span className="text-electric-blue opacity-70">#</span> {active.problem.title}
          </h3>
          <span className="font-code-md text-on-surface-variant text-[10px] uppercase tracking-widest">
            {isLive ? (
              <span className="text-neon-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" /> on leetcode
              </span>
            ) : (
              'away'
            )}
          </span>
        </div>
        <CircularTimer elapsedMs={elapsed} isLive={isLive} size={64} />
      </div>

      {postSolveInsight && (
        <div className="border border-electric-blue/20 bg-white/5 rounded px-sm py-xs text-sm text-on-surface font-code-md">
          {postSolveInsight}
        </div>
      )}

      <div ref={scrollRef} className="flex flex-col gap-6 max-h-80 overflow-y-auto scroll-smooth pr-1 font-code-md text-sm">
        {hints.length === 0 && !busy && (
          <div className="chat-block-agent">
            <div className="text-[10px] text-electric-blue mb-1 uppercase tracking-wider opacity-80">
              coach.noryx // sys.msg
            </div>
            <p className="text-on-surface/90 leading-relaxed">
              Stuck, or just want to talk through your approach? Ask below — I won't write the
              solution unless you tell me to.
            </p>
          </div>
        )}
        {hints.map((h) => (
          <div key={h.id}>
            {h.userMessage && (
              <div className="chat-block-user">
                <div className="text-[10px] text-on-surface-variant mb-1 uppercase tracking-wider opacity-80">
                  usr.local // reply
                </div>
                <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">{h.userMessage}</p>
              </div>
            )}
            <div className="chat-block-agent">
              <div className="text-[10px] text-electric-blue mb-1 uppercase tracking-wider opacity-80">
                coach.noryx // {h.level === 'solution' ? 'solution' : LEVEL_LABEL[h.level].toLowerCase()}
                {h.auto ? ' · auto' : ''}
              </div>
              <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">{h.text}</p>
            </div>
          </div>
        ))}
        {busy && <TypingBubble />}
      </div>

      {error && <p className="text-error text-sm font-code-md">{error}</p>}

      <div className="relative flex items-center glass-card border border-white/10 rounded focus-within:border-electric-blue/40 transition-colors">
        <span className="absolute left-4 text-electric-blue font-code-md text-sm font-bold opacity-80">&gt;_</span>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="execute command…"
          rows={1}
          className="w-full bg-transparent border-none py-3 pl-12 pr-12 text-on-surface font-code-md text-sm outline-none resize-none placeholder:text-on-surface-variant/40"
        />
        <button
          disabled={busy}
          onClick={() => void requestHint(nextLevel)}
          aria-label={atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
          title={atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
          className="absolute right-3 p-2 text-on-surface-variant hover:text-electric-blue transition-colors disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[20px]">{busy ? 'hourglass_top' : 'send'}</span>
        </button>
      </div>

      {atMaxLevel && (
        <button
          disabled={busy}
          onClick={handleShowSolution}
          className="self-start bg-transparent border border-white/10 text-on-surface-variant font-code-md text-xs py-2 px-4 uppercase disabled:opacity-50 hover:text-on-surface hover:border-white/30 transition-all"
        >
          show full solution
        </button>
      )}
    </div>
  );
}
