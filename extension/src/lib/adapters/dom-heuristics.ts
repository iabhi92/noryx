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
  private seen = new WeakSet<Element>();

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
    if (!hit || this.seen.has(hit.el)) return;
    this.seen.add(hit.el);
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
