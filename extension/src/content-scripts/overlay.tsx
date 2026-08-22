import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrCreateSession, getSubmissionsForSession, getHintsForSession } from '../lib/storage';
import { getSettings } from '../lib/settings';
import { useCoach, type CoachTarget } from '../lib/hooks/useCoach';
import { CircularTimer, RingBadge } from '../lib/CircularTimer';
import { MAX_AUTO_HINT_LEVEL } from '../lib/ai/intervention';
import { extractEditorCode, findLeafByExactText, KNOWN_LANGUAGES } from '../lib/adapters/dom-heuristics';
import { runJavaScript, canRunLocally, type RunResult } from '../lib/codeRunner';
import type { Problem, ProblemMetadata, StoredHint } from '../lib/types';

// ponytail: pulling React+ReactDOM into the content script (vs. hand-rolled DOM) puts
// universal.js at ~1.1MB — fine for a personal-use extension injected once per page, but if this
// ever needs to be lean (many users, slow connections), the fix is dropping to vanilla DOM/a
// tiny signal library for just this widget, not bundle-splitting React across two entry points.

// Hand-written CSS, not Tailwind — the dashboard's Tailwind build only exists for the dashboard
// bundle (its own Vite pipeline); pulling that into a content script means either a second build
// pipeline or loading the dashboard's hashed CSS file across bundles, neither of which is worth it
// for a widget this size. Same tokens as the dashboard's "Ultra Engineering Terminal" theme
// (stitch_design_enhancement_engine/code.html: neon-cyan #00f0ff, neon-pink #f8acff, near-black
// #131313), injected into a Shadow DOM so the host page's CSS can't bleed in and vice versa.
const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: 'Geist Mono', ui-monospace, monospace; }
  .bubble-wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000; }
  .bubble-btn {
    position: absolute; inset: 6px; border-radius: 999px;
    background: #131313; border: 1px solid rgba(0,240,255,0.4); cursor: pointer;
    box-shadow: 0 0 16px rgba(0,240,255,0.3); font-size: 22px;
    display: flex; align-items: center; justify-content: center; transition: transform 0.15s;
  }
  .bubble-btn:hover { transform: scale(1.08); }
  .badge {
    position: absolute; top: -2px; right: -2px; background: #f8acff; color: #131313;
    font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center; padding: 0 3px;
  }
  .panel {
    position: fixed; bottom: 20px; right: 20px; width: 340px; max-height: 480px;
    background: rgba(20,20,20,0.85); backdrop-filter: blur(24px); border: 1px solid rgba(0,240,255,0.2);
    box-shadow: 0 12px 40px rgba(0,0,0,0.6); z-index: 2147483000; display: flex; flex-direction: column;
    overflow: hidden; color: #e5e2e1;
  }
  .panel-header {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .panel-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #e5e2e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .close-btn {
    background: none; border: none; color: #c4c7c7; cursor: pointer; font-size: 16px; padding: 2px 6px;
  }
  .close-btn:hover { background: rgba(255,255,255,0.08); }
  .run-btn {
    background: none; border: none; color: #c4c7c7; cursor: pointer; font-size: 15px; padding: 2px 6px; flex-shrink: 0;
  }
  .run-btn:hover { color: #00f0ff; }
  .run-btn:disabled { opacity: 0.5; cursor: default; }
  .run-output { border-bottom: 1px solid rgba(255,255,255,0.06); max-height: 140px; display: flex; flex-direction: column; }
  .run-output-header {
    display: flex; align-items: center; justify-content: space-between; padding: 6px 12px;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #00f0ff; background: rgba(0,240,255,0.05);
  }
  .run-output-body {
    margin: 0; padding: 8px 12px; font-size: 11.5px; line-height: 1.5; color: #e5e2e1;
    white-space: pre-wrap; word-break: break-word; overflow-y: auto; max-height: 100px;
  }
  .run-output-error { color: #ffb4ab; }
  .chat { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; min-height: 120px; }
  .chat-block-agent { border-left: 2px solid rgba(0,240,255,0.4); padding-left: 10px; }
  .chat-block-user { border-right: 2px solid rgba(255,255,255,0.2); padding-right: 10px; text-align: right; }
  .msg-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; opacity: 0.8; }
  .msg-label.agent { color: #00f0ff; }
  .msg-label.user { color: #c4c7c7; }
  .msg-text { font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; color: rgba(229,226,225,0.9); }
  .empty { color: #c4c7c7; font-size: 12.5px; padding: 4px; }
  .composer {
    position: relative; display: flex; align-items: center; gap: 6px; margin: 8px;
    background: rgba(20,20,20,0.6); border: 1px solid rgba(255,255,255,0.1);
  }
  .composer:focus-within { border-color: rgba(0,240,255,0.4); }
  .composer .prompt { position: absolute; left: 10px; color: #00f0ff; font-size: 12px; font-weight: 700; opacity: 0.8; }
  .composer textarea {
    flex: 1; background: transparent; border: none;
    color: #e5e2e1; font-size: 12.5px; padding: 10px 36px 10px 26px; resize: none; outline: none;
  }
  .send-btn {
    position: absolute; right: 4px; width: 26px; height: 26px; border: none; cursor: pointer;
    background: transparent; color: #c4c7c7; font-size: 14px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .send-btn:hover { color: #00f0ff; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }
  .keybtn {
    margin: 0 10px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1);
    color: #c4c7c7; font-weight: 500; font-size: 11px; text-transform: uppercase; padding: 8px; cursor: pointer;
  }
  .keybtn:hover { color: #e5e2e1; border-color: rgba(255,255,255,0.3); }
  .dots { display: flex; gap: 3px; padding: 2px 4px; }
  .dot { width: 5px; height: 5px; border-radius: 999px; background: rgba(0,240,255,0.6); animation: bounce 1s infinite; }
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
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
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

  // Reads the editor fresh at click-time (not stored submission code, which only exists if
  // captureCode is on) — this never leaves the device, so it isn't gated by that setting at all.
  // Only the dashboard's separate tab can't do this; the overlay lives on the same page as the
  // editor, so it's the only place "run locally" is architecturally possible.
  async function handleRunLocally() {
    const code = extractEditorCode();
    if (!code) {
      setRunResult({ output: '', error: 'No code found in the editor.', ranAt: Date.now() });
      return;
    }
    const detected = findLeafByExactText(KNOWN_LANGUAGES)?.text ?? '';
    if (!canRunLocally(detected)) {
      setRunResult({
        output: '',
        error: detected
          ? `Local execution only supports JavaScript/TypeScript right now — detected ${detected}.`
          : "Couldn't detect the language, and local execution only supports JavaScript/TypeScript right now.",
        ranAt: Date.now(),
      });
      return;
    }
    setRunning(true);
    setRunResult(null);
    setRunResult(await runJavaScript(code));
    setRunning(false);
  }

  if (!expanded) {
    return (
      <div className="bubble-wrap">
        <RingBadge elapsedMs={session?.activeMs ?? 0} isLive={isLive} size={64}>
          <button className="bubble-btn" onClick={() => setExpanded(true)} aria-label="Open Miko" title="Open Miko">
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
        <span className="panel-title"># {problem.title}</span>
        <button
          className="run-btn"
          onClick={() => void handleRunLocally()}
          disabled={running}
          aria-label="Run code locally"
          title="Run the current editor code locally (JavaScript/TypeScript only)"
        >
          {running ? '⏳' : '⚡'}
        </button>
        <CircularTimer elapsedMs={session?.activeMs ?? 0} isLive={isLive} size={40} />
        <button className="close-btn" onClick={() => setExpanded(false)} aria-label="Collapse coach panel" title="Collapse">
          ✕
        </button>
      </div>

      {runResult && (
        <div className="run-output">
          <div className="run-output-header">
            <span>local_exec.out</span>
            <button className="close-btn" onClick={() => setRunResult(null)} aria-label="Dismiss run output" title="Dismiss">
              ✕
            </button>
          </div>
          {runResult.output && <pre className="run-output-body">{runResult.output}</pre>}
          {runResult.error && <pre className="run-output-body run-output-error">{runResult.error}</pre>}
          {!runResult.output && !runResult.error && <pre className="run-output-body">(no output)</pre>}
        </div>
      )}

      {!apiKey ? (
        <div className="empty" style={{ padding: 12 }}>
          Add a free Gemini API key in the MeowMentor dashboard's Settings to enable coaching here.
        </div>
      ) : (
        <>
          <div className="chat" ref={chatRef}>
            {hints.length === 0 && !busy && (
              <div className="chat-block-agent">
                <span className="msg-label agent">coach.miko // sys.msg</span>
                <div className="msg-text">Stuck, or want to talk through your approach? Ask below.</div>
              </div>
            )}
            {hints.map((h) => (
              <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {h.userMessage && (
                  <div className="chat-block-user">
                    <span className="msg-label user">usr.local // reply</span>
                    <div className="msg-text">{h.userMessage}</div>
                  </div>
                )}
                <div className="chat-block-agent">
                  <span className="msg-label agent">
                    coach.miko // {h.level === 'solution' ? 'solution' : `level ${h.level}`}
                    {h.auto ? ' · auto' : ''}
                  </span>
                  <div className="msg-text">{h.text}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="chat-block-agent dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            )}
          </div>
          {error && <div className="empty" style={{ color: '#ffb4ab' }}>{error}</div>}
          <div className="composer">
            <span className="prompt">&gt;_</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="execute command…"
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
              show full solution
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
  host.id = 'meow-mentor-overlay-host';
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
