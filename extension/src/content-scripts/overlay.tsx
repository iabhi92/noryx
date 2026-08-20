import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrCreateSession, getSubmissionsForSession, getHintsForSession } from '../lib/storage';
import { getSettings } from '../lib/settings';
import { useCoach, type CoachTarget } from '../lib/hooks/useCoach';
import { CircularTimer, RingBadge } from '../lib/CircularTimer';
import { MAX_AUTO_HINT_LEVEL } from '../lib/ai/intervention';
import type { Problem, ProblemMetadata, StoredHint } from '../lib/types';

// ponytail: pulling React+ReactDOM into the content script (vs. hand-rolled DOM) puts
// universal.js at ~1.1MB — fine for a personal-use extension injected once per page, but if this
// ever needs to be lean (many users, slow connections), the fix is dropping to vanilla DOM/a
// tiny signal library for just this widget, not bundle-splitting React across two entry points.

// Hand-written CSS, not Tailwind — the dashboard's Tailwind build only exists for the dashboard
// bundle (its own Vite pipeline); pulling that into a content script means either a second build
// pipeline or loading the dashboard's hashed CSS file across bundles, neither of which is worth it
// for a widget this size. Same color tokens as the dashboard (electric-blue #0ea5e9, soft-violet
// #a78bfa, surface #0f1418) for visual consistency, injected into a Shadow DOM so the host page's
// CSS can't bleed in and this widget's CSS can't bleed onto the host page.
const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, system-ui, sans-serif; }
  .bubble-wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000; }
  .bubble-btn {
    position: absolute; inset: 6px; border-radius: 999px;
    background: linear-gradient(135deg, #0ea5e9, #a78bfa); border: none; cursor: pointer;
    box-shadow: 0 4px 16px rgba(14,165,233,0.4); font-size: 24px;
    display: flex; align-items: center; justify-content: center; transition: transform 0.15s;
  }
  .bubble-btn:hover { transform: scale(1.08); }
  .badge {
    position: absolute; top: -2px; right: -2px; background: #ffb4ab; color: #690005;
    font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center; padding: 0 3px;
  }
  .panel {
    position: fixed; bottom: 20px; right: 20px; width: 340px; max-height: 480px;
    background: #0f1418; border: 1px solid rgba(14,165,233,0.25); border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5); z-index: 2147483000; display: flex; flex-direction: column;
    overflow: hidden; color: #dee3e9;
  }
  .panel-header {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .panel-title { font-size: 13px; font-weight: 700; color: #dee3e9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .close-btn {
    background: none; border: none; color: #bec8d2; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 6px;
  }
  .close-btn:hover { background: rgba(255,255,255,0.08); }
  .chat { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; }
  .msg-row { display: flex; align-items: flex-end; gap: 6px; }
  .msg-row.user { justify-content: flex-end; }
  .msg-bubble {
    max-width: 85%; padding: 8px 10px; border-radius: 14px; font-size: 12.5px; line-height: 1.45; white-space: pre-wrap;
  }
  .msg-bubble.ai { background: #1b2024; border-bottom-left-radius: 4px; }
  .msg-bubble.user { background: linear-gradient(135deg, #0ea5e9, #a78bfa); color: #00344d; border-bottom-right-radius: 4px; }
  .msg-level { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; margin-bottom: 3px; }
  .empty { color: #bec8d2; font-size: 12.5px; padding: 4px; }
  .composer {
    display: flex; align-items: flex-end; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,0.06);
  }
  .composer textarea {
    flex: 1; background: #1b2024; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    color: #dee3e9; font-size: 12.5px; padding: 8px 10px; resize: none; outline: none;
  }
  .composer textarea:focus { border-color: rgba(14,165,233,0.6); }
  .send-btn {
    width: 32px; height: 32px; border-radius: 999px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #0ea5e9, #a78bfa); color: #00344d; font-size: 14px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .send-btn:disabled { opacity: 0.4; cursor: default; }
  .keybtn {
    margin: 8px 10px 10px; background: linear-gradient(135deg, #0ea5e9, #a78bfa); border: none;
    color: #00344d; font-weight: 700; font-size: 12px; border-radius: 10px; padding: 8px; cursor: pointer;
  }
  .dots { display: flex; gap: 3px; padding: 2px 4px; }
  .dot { width: 5px; height: 5px; border-radius: 999px; background: rgba(190,200,210,0.6); animation: bounce 1s infinite; }
  .dot:nth-child(2) { animation-delay: 0.12s; }
  .dot:nth-child(3) { animation-delay: 0.24s; }
  @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

interface OverlayAppProps {
  problemKey: string;
  problem: Problem & ProblemMetadata;
}

function OverlayApp({ problemKey, problem }: OverlayAppProps) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [active, setActive] = useState<CoachTarget | null>(null);
  const [hints, setHints] = useState<StoredHint[]>([]);
  const [now, setNow] = useState(Date.now());
  const chatRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const settings = await getSettings();
    setApiKey(settings.geminiApiKey ?? null);
    const session = await getOrCreateSession(problemKey);
    const [submissions, sessionHints] = await Promise.all([
      getSubmissionsForSession(session.id),
      getHintsForSession(session.id),
    ]);
    setActive({ session, problem, submissions });
    setHints(sessionHints);
  }, [problemKey, problem]);

  const { question, setQuestion, busy, error, nextLevel, requestHint, handleComposerKeyDown, handleShowSolution } =
    useCoach(apiKey, active, () => void refresh());

  useEffect(() => {
    void refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (expanded) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [hints, busy, expanded]);

  const session = active?.session;
  const isLive = !!session?.lastHeartbeatAt && now - session.lastHeartbeatAt < 20000;
  const atMaxLevel = (session?.hintLevel ?? 0) >= MAX_AUTO_HINT_LEVEL;

  if (!expanded) {
    return (
      <div className="bubble-wrap">
        <RingBadge elapsedMs={session?.activeMs ?? 0} isLive={isLive} size={64}>
          <button className="bubble-btn" onClick={() => setExpanded(true)} aria-label="Open Noryx coach" title="Open Noryx coach">
            🤖
            {hints.length > 0 && <span className="badge">{hints.length}</span>}
          </button>
        </RingBadge>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🤖 {problem.title}</span>
        <CircularTimer elapsedMs={session?.activeMs ?? 0} isLive={isLive} size={40} />
        <button className="close-btn" onClick={() => setExpanded(false)} aria-label="Collapse coach panel" title="Collapse">
          ✕
        </button>
      </div>

      {!apiKey ? (
        <div className="empty" style={{ padding: 12 }}>
          Add a free Gemini API key in the Noryx dashboard's Settings to enable coaching here.
        </div>
      ) : (
        <>
          <div className="chat" ref={chatRef}>
            {hints.length === 0 && !busy && (
              <div className="msg-row">
                <div className="msg-bubble ai">Stuck, or want to talk through your approach? Ask below.</div>
              </div>
            )}
            {hints.map((h) => (
              <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {h.userMessage && (
                  <div className="msg-row user">
                    <div className="msg-bubble user">{h.userMessage}</div>
                  </div>
                )}
                <div className="msg-row">
                  <div className="msg-bubble ai">
                    <span className="msg-level">
                      {h.level === 'solution' ? '🔓 solution' : `💡 level ${h.level}`}
                      {h.auto ? ' · auto' : ''}
                    </span>
                    {h.text}
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="msg-row">
                <div className="msg-bubble ai dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>
          {error && <div className="empty" style={{ color: '#ffb4ab' }}>{error}</div>}
          <div className="composer">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="What are you thinking?"
              rows={1}
            />
            <button
              className="send-btn"
              disabled={busy}
              onClick={() => void requestHint(nextLevel)}
              aria-label={atMaxLevel ? 'Ask again' : `Ask for a hint (level ${nextLevel})`}
            >
              {busy ? '⏳' : '➤'}
            </button>
          </div>
          {atMaxLevel && (
            <button className="keybtn" disabled={busy} onClick={handleShowSolution}>
              🔓 Show full solution
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Mounts the floating coach widget into an isolated Shadow DOM so the host page's CSS can't
 *  style it and its CSS can't leak onto the host page. Returns an unmount function so the caller
 *  (universal.ts's SPA-navigation handling) can tear it down cleanly before the next problem. */
export function mountOverlay(problemKey: string, problem: Problem & ProblemMetadata): () => void {
  const host = document.createElement('div');
  host.id = 'noryx-overlay-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  shadow.appendChild(styleEl);
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<OverlayApp problemKey={problemKey} problem={problem} />);

  return () => {
    root.unmount();
    host.remove();
  };
}
