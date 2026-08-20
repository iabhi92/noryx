import { detectAdapter } from '../lib/adapters/universal-detector';
import { problemKey } from '../lib/types';
import { getSettings } from '../lib/settings';
import type { RuntimeMessage } from '../lib/messages';
import type { CodingPlatformAdapter } from '../lib/adapters/types';
import type { Stoppable } from '../lib/adapters/dom-heuristics';
import { mountOverlay } from './overlay';

const HEARTBEAT_INTERVAL_MS = 15000;
// Below this, a paste is more likely a variable name or a single line pulled from docs than a
// chunk of solution code — not worth counting as a behavioral signal.
const PASTE_NOISE_FLOOR_CHARS = 20;
// ponytail: pushState-patch + popstate covers most SPA routers; the poll is a cheap fallback for
// whatever navigation mechanism a given judge's frontend uses that we didn't intercept.
const URL_POLL_INTERVAL_MS = 1000;

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message);
}

function isStoppable(adapter: CodingPlatformAdapter): adapter is CodingPlatformAdapter & Stoppable {
  return typeof (adapter as Partial<Stoppable>).stop === 'function';
}

function runHeartbeat(key: string): () => void {
  let lastTick = Date.now();
  let tabSwitches = 0;
  let pasteCount = 0;
  let pasteChars = 0;

  const onVisibilityChange = () => {
    if (document.hidden) tabSwitches += 1;
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Capture phase on document, not a per-adapter editor hook: paste events bubble through Shadow
  // DOM and iframe-free editors alike, so one listener covers Monaco/Ace/CodeMirror/textarea
  // without needing to know which one is on the page. Length only — the pasted text itself is
  // never read into a variable, let alone stored.
  const onPaste = (e: ClipboardEvent) => {
    const length = e.clipboardData?.getData('text').length ?? 0;
    if (length < PASTE_NOISE_FLOOR_CHARS) return;
    pasteCount += 1;
    pasteChars += length;
  };
  document.addEventListener('paste', onPaste, true);

  const intervalId = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    const active = document.hasFocus() && !document.hidden;
    send({
      type: 'HEARTBEAT',
      problemKey: key,
      activeDeltaMs: active ? delta : 0,
      idleDeltaMs: active ? 0 : delta,
      tabSwitchInc: tabSwitches,
      pasteCountInc: pasteCount,
      pasteCharsInc: pasteChars,
    });
    tabSwitches = 0;
    pasteCount = 0;
    pasteChars = 0;
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('paste', onPaste, true);
  };
}

async function runSubmissionLoop(
  adapter: CodingPlatformAdapter,
  key: string,
  isCancelled: () => boolean,
): Promise<void> {
  const initialEditorState = await adapter.getEditorState();
  let lastKnownLanguage = initialEditorState?.language ?? 'Unknown';

  while (!isCancelled()) {
    const event = await adapter.detectSubmission();
    if (isCancelled() || !event) continue;
    const editorState = await adapter.getEditorState();
    lastKnownLanguage = editorState?.language ?? lastKnownLanguage;
    // Privacy gate: adapters extract code unconditionally (it's just a local DOM read, no
    // different from reading the language), but it only ever leaves this function — into
    // storage, and from there to Gemini for hint generation — if the user opted in.
    const settings = await getSettings();
    const code = settings.captureCode ? editorState?.code : undefined;
    send({
      type: 'SUBMISSION',
      problemKey: key,
      submission: { ...event, language: lastKnownLanguage, code },
    });
  }
}

/** Detects + tracks whatever problem is on the page right now. Returns a cleanup function that
 *  tears down the heartbeat and stops the adapter's observer before the next navigation reuses it. */
async function trackCurrentPage(): Promise<() => void> {
  const adapter = detectAdapter();
  if (!adapter) return () => {};

  const problem = await adapter.getProblem();
  if (!problem) return () => {};
  const metadata = await adapter.getProblemMetadata();
  const key = problemKey(problem.platform, problem.externalId);

  send({ type: 'SESSION_START', problem: { ...problem, ...metadata } });

  const stopHeartbeat = runHeartbeat(key);
  const unmountOverlay = mountOverlay(key, { ...problem, ...metadata });
  let cancelled = false;
  void runSubmissionLoop(adapter, key, () => cancelled);

  return () => {
    cancelled = true;
    stopHeartbeat();
    unmountOverlay();
    if (isStoppable(adapter)) adapter.stop();
  };
}

/** Coding-platform frontends are a mix of classic multi-page sites and React/SPA routers. A full
 *  page load re-injects the content script fine on its own; this covers the SPA case, where the
 *  URL changes but the script never gets a fresh injection. */
function watchUrlChanges(onChange: () => void): void {
  let lastUrl = location.href;
  const checkForChange = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onChange();
    }
  };

  window.addEventListener('popstate', checkForChange);
  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<History['pushState']>) => {
    originalPushState(...args);
    checkForChange();
  }) as History['pushState'];

  setInterval(checkForChange, URL_POLL_INTERVAL_MS);
}

async function main(): Promise<void> {
  let cleanup = await trackCurrentPage();
  watchUrlChanges(() => {
    cleanup();
    void trackCurrentPage().then((next) => {
      cleanup = next;
    });
  });
}

void main();
