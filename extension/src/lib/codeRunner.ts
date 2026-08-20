export interface RunResult {
  output: string;
  error?: string;
  ranAt: number;
}

const RUNNABLE_LANGUAGES = new Set(['javascript', 'js', 'typescript', 'ts']);

export function canRunLocally(language: string): boolean {
  return RUNNABLE_LANGUAGES.has(language.trim().toLowerCase());
}

const TIMEOUT_MS = 3000;

// Runs in a Worker (not the page/extension context) so a runaway loop or crash can't touch
// anything else — terminate() just kills it. console.* is overridden inside the worker itself
// (not postMessage-per-call) so output stays in real call order even if the code logs, throws,
// then the catch logs again.
const WORKER_SRC = `
  self.onmessage = (e) => {
    const logs = [];
    const push = (...args) => logs.push(args.map(a => {
      try { return typeof a === 'string' ? a : JSON.stringify(a); }
      catch { return String(a); }
    }).join(' '));
    console.log = console.info = console.warn = console.error = push;
    try {
      new Function(e.data)();
      self.postMessage({ ok: true, output: logs.join('\\n') });
    } catch (err) {
      self.postMessage({ ok: false, output: logs.join('\\n'), error: err instanceof Error ? err.message : String(err) });
    }
  };
`;

/** Runs the code exactly as written — no auto-detected test cases, no function-calling. If a
 *  LeetCode-style solution has no top-level side effects, this just confirms it parses/executes
 *  without throwing; pairing it with a manual call the user adds themselves (e.g.
 *  `console.log(new Solution().twoSum(...))`) is the intended workflow, same as running any
 *  script locally — this isn't a test-case runner, it's "does this actually run." */
export function runJavaScript(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    let settled = false;

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ output: '', error: `Timed out after ${TIMEOUT_MS / 1000}s (infinite loop?)`, ranAt: Date.now() });
    }, TIMEOUT_MS);

    worker.onmessage = (e) => {
      const data = e.data as { ok: boolean; output: string; error?: string };
      finish({ output: data.output, error: data.error, ranAt: Date.now() });
    };
    worker.onerror = (e) => {
      finish({ output: '', error: e.message, ranAt: Date.now() });
    };

    worker.postMessage(code);
  });
}
