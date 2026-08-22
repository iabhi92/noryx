import type { SubmissionEvent, SubmissionStatus } from '../types';

export function findLeafMatching(predicate: (text: string) => boolean): { text: string; el: Element } | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (node.children.length === 0) {
      const text = node.textContent?.trim() ?? '';
      if (text && predicate(text)) return { text, el: node };
    }
    node = walker.nextNode() as Element | null;
  }
  return null;
}

export function findLeafByExactText(candidates: string[]): { text: string; el: Element } | null {
  return findLeafMatching((text) => candidates.includes(text));
}

// Shared across adapters (was duplicated in leetcode.ts and generic.ts with generic.ts's list a
// strict superset) and the in-page overlay's "Run locally" language check.
export const KNOWN_LANGUAGES = [
  'Python3', 'Python', 'Python 3', 'C++', 'Java', 'JavaScript', 'TypeScript', 'C', 'C#',
  'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'Scala', 'PHP', 'Dart', 'Racket', 'Erlang', 'Elixir',
  'Pascal', 'Perl', 'Haskell', 'D', 'OCaml', 'F#',
];

/** Best-effort code extraction from whichever editor widget is on the page. Only ever called
 *  when the user has opted in (settings.captureCode) — see EditorState.code. Monaco and Ace both
 *  virtualize rendering (only visible lines actually exist in the DOM, recycled as you scroll),
 *  so this can miss lines scrolled out of view on a very long solution — acceptable for
 *  typical DSA-length code, and honestly better than nothing rather than false precision. */
export function extractEditorCode(): string | undefined {
  const monacoLines = document.querySelector('.monaco-editor .view-lines');
  if (monacoLines) {
    const lines = Array.from(monacoLines.querySelectorAll<HTMLElement>('.view-line'))
      .sort((a, b) => (parseInt(a.style.top) || 0) - (parseInt(b.style.top) || 0))
      .map((el) => el.textContent ?? '');
    if (lines.length) return lines.join('\n');
  }

  const aceLines = document.querySelector('.ace_editor .ace_text-layer');
  if (aceLines) {
    const lines = Array.from(aceLines.querySelectorAll('.ace_line')).map((el) => el.textContent ?? '');
    if (lines.length) return lines.join('\n');
  }

  const cmContent = document.querySelector('.CodeMirror-code, .cm-content');
  const cmText = cmContent?.textContent?.trim();
  if (cmText) return cmText;

  const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
  if (textarea?.value) return textarea.value;

  return undefined;
}

export type StatusMatcher = (text: string) => SubmissionStatus | null;

/** Implemented by adapters that hold a live MutationObserver, so the content script can tear it
 *  down on SPA navigation instead of leaking an observer that keeps watching the wrong problem. */
export interface Stoppable {
  stop(): void;
}

/** Watches the DOM for a verdict string and resolves the next `detectSubmission()` call with it. */
export class SubmissionWatcher implements Stoppable {
  private queue: SubmissionEvent[] = [];
  private waiters: Array<(ev: SubmissionEvent | null) => void> = [];
  private observer: MutationObserver | null = null;
  // Keyed by element AND its text, not just the element: these sites often reuse the same result
  // node across submissions rather than replacing it, so a bare per-element WeakSet would
  // permanently ignore that node after its first verdict — silently dropping every later
  // resubmission's result, including a genuine Accepted after an earlier Wrong Answer.
  // ponytail: still misses a second submission that lands the exact same verdict text on the
  // exact same node (no click signal to tell "still the old render" from "a new identical one",
  // unlike leetcode.ts's watcher) — add per-platform submit-click tracking if that matters here.
  private seen = new WeakMap<Element, string>();

  constructor(private matchStatus: StatusMatcher) {}

  next(): Promise<SubmissionEvent | null> {
    this.ensureObserver();
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private ensureObserver(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  private scan(): void {
    const hit = findLeafMatching((text) => this.matchStatus(text) !== null);
    if (!hit || this.seen.get(hit.el) === hit.text) return;
    this.seen.set(hit.el, hit.text);
    const status = this.matchStatus(hit.text)!;

    const container = hit.el.closest('[class]')?.parentElement ?? hit.el.parentElement;
    const nearbyText = container?.textContent ?? '';
    const runtimeMatch = nearbyText.match(/(\d+(?:\.\d+)?\s?(?:ms|s)\b)/i);
    const memoryMatch = nearbyText.match(/(\d+(?:\.\d+)?\s?(?:KB|MB)\b)/i);

    const event: SubmissionEvent = {
      status,
      language: 'Unknown',
      runtime: runtimeMatch?.[1],
      memory: memoryMatch?.[1],
      timestamp: Date.now(),
    };

    const waiter = this.waiters.shift();
    if (waiter) waiter(event);
    else this.queue.push(event);
  }

  /** Disconnects the observer and unblocks any pending `next()` call with null, so a caller
   *  awaiting in a loop can see it and exit instead of hanging on a page that navigated away. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    const pending = this.waiters.splice(0);
    pending.forEach((resolve) => resolve(null));
  }
}
