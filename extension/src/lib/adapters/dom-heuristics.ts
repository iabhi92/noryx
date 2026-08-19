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

export type StatusMatcher = (text: string) => SubmissionStatus | null;

/** Watches the DOM for a verdict string and resolves the next `detectSubmission()` call with it. */
export class SubmissionWatcher {
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
}
