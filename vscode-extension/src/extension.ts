import * as vscode from 'vscode';

const SYNC_CODE_SECRET_KEY = 'meowmentor.syncCode';
const TICK_INTERVAL_MS = 15_000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Same publishable key/project the Safari extension uses — see extension/src/lib/supabaseConfig.ts
// for why this is safe to embed (write access is gated by write_token, not by keeping this secret).
const SUPABASE_URL = 'https://jliflngpelahaprxsziq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v1S6u0JdZ3-E4BuovTxMww_FY_W5iP2';

interface SyncCode {
  id: string;
  writeToken: string;
}

function decodeSyncCode(raw: string): SyncCode | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw.trim(), 'base64').toString('utf8')) as Partial<SyncCode>;
    if (typeof parsed.id === 'string' && typeof parsed.writeToken === 'string') {
      return { id: parsed.id, writeToken: parsed.writeToken };
    }
    return null;
  } catch {
    return null;
  }
}

function formatActiveTime(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.name = 'Meow Mentor';
  statusBar.tooltip = 'Active coding time tracked by Meow Mentor in this VS Code window.';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // activeMs is this window's lifetime total (status bar display only, never persisted or sent).
  // unsyncedMs is what's accumulated since the last successful sync — the only thing that ever
  // leaves this machine, and only as a millisecond count, never with any file/workspace/keystroke
  // content attached. Same "ambient metadata, not content" tier as the Safari extension's own
  // activeMs/idleMs/tabSwitches tracking (see CodingSession in extension/src/lib/types.ts).
  let activeMs = 0;
  let unsyncedMs = 0;
  let lastTick = Date.now();

  const updateStatusBar = () => {
    statusBar.text = `$(watch) Meow Mentor ${formatActiveTime(activeMs)}`;
  };
  updateStatusBar();

  const tickTimer = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    if (vscode.window.state.focused) {
      activeMs += delta;
      unsyncedMs += delta;
      updateStatusBar();
    }
  }, TICK_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(tickTimer) });

  async function flushSync(): Promise<void> {
    if (unsyncedMs === 0) return;
    const raw = await context.secrets.get(SYNC_CODE_SECRET_KEY);
    if (!raw) return;
    const code = decodeSyncCode(raw);
    if (!code) return;

    const delta = unsyncedMs;
    // Reset optimistically before the network call: a failed sync loses at most one interval's
    // worth of time rather than risking a stuck counter that double-counts on retry — same
    // tradeoff the Safari extension's heartbeat already makes on failure.
    unsyncedMs = 0;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_vscode_time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ p_id: code.id, p_write_token: code.writeToken, p_delta_ms: delta }),
      });
      if (!res.ok) throw new Error(`sync failed (${res.status})`);
    } catch (err) {
      console.warn('[Meow Mentor] sync failed:', err);
    }
  }

  const syncTimer = setInterval(() => void flushSync(), SYNC_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(syncTimer) });
  // Best-effort only — VS Code does not wait for async dispose handlers, so a flush started here
  // may not finish before the process exits. Worst case: up to one sync interval's time is lost,
  // never double-counted.
  context.subscriptions.push({ dispose: () => void flushSync() });

  context.subscriptions.push(
    vscode.commands.registerCommand('meowmentor.setSyncCode', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Paste the sync code from Meow Mentor → Settings → Public Profile (in your browser)',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => (decodeSyncCode(value) ? null : "That doesn't look like a valid Meow Mentor sync code."),
      });
      if (!input) return;
      await context.secrets.store(SYNC_CODE_SECRET_KEY, input.trim());
      void vscode.window.showInformationMessage(
        'Meow Mentor: sync code saved — VS Code time now counts toward your public profile.',
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowmentor.clearSyncCode', async () => {
      await context.secrets.delete(SYNC_CODE_SECRET_KEY);
      void vscode.window.showInformationMessage('Meow Mentor: sync code removed — VS Code time stays local only.');
    }),
  );
}

export function deactivate(): void {}
