import { detectAdapter } from '../lib/adapters/universal-detector';
import { problemKey } from '../lib/types';
import type { RuntimeMessage } from '../lib/messages';
import type { CodingPlatformAdapter } from '../lib/adapters/types';

const HEARTBEAT_INTERVAL_MS = 15000;

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message);
}

function runHeartbeat(key: string): void {
  let lastTick = Date.now();
  let tabSwitches = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tabSwitches += 1;
  });

  // ponytail: visibility-based heartbeat, not keystroke-level activity detection —
  // upgrade if idle-time accuracy becomes a real problem.
  setInterval(() => {
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
    });
    tabSwitches = 0;
  }, HEARTBEAT_INTERVAL_MS);
}

async function runSubmissionLoop(adapter: CodingPlatformAdapter, key: string): Promise<void> {
  const initialEditorState = await adapter.getEditorState();
  let lastKnownLanguage = initialEditorState?.language ?? 'Unknown';

  for (;;) {
    const event = await adapter.detectSubmission();
    if (!event) continue;
    const editorState = await adapter.getEditorState();
    lastKnownLanguage = editorState?.language ?? lastKnownLanguage;
    send({
      type: 'SUBMISSION',
      problemKey: key,
      submission: { ...event, language: lastKnownLanguage },
    });
  }
}

async function main(): Promise<void> {
  const adapter = detectAdapter();
  if (!adapter) return;

  const problem = await adapter.getProblem();
  if (!problem) return;
  const metadata = await adapter.getProblemMetadata();
  const key = problemKey(problem.platform, problem.externalId);

  send({ type: 'SESSION_START', problem: { ...problem, ...metadata } });

  runHeartbeat(key);
  void runSubmissionLoop(adapter, key);
}

void main();
