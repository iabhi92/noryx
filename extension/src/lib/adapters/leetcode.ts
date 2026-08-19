import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent, SubmissionStatus } from '../types';

// ponytail: leaf-text DOM heuristics below have no stable data-testid to anchor to.
// LeetCode's markup shifts periodically; when detection breaks, this file is the one place to patch.

const STATUS_STRINGS: SubmissionStatus[] = [
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Runtime Error',
  'Compilation Error',
  'Memory Limit Exceeded',
];

const KNOWN_LANGUAGES = [
  'Python3', 'Python', 'C++', 'Java', 'JavaScript', 'TypeScript', 'C', 'C#',
  'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'Scala', 'PHP', 'Dart', 'Racket', 'Erlang', 'Elixir',
];

function slugFromUrl(): string | null {
  const match = location.pathname.match(/\/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

function findLeafByExactText(candidates: string[]): { text: string; el: Element } | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (node.children.length === 0) {
      const text = node.textContent?.trim() ?? '';
      if (candidates.includes(text)) return { text, el: node };
    }
    node = walker.nextNode() as Element | null;
  }
  return null;
}

export class LeetCodeAdapter implements CodingPlatformAdapter {
  private submissionQueue: SubmissionEvent[] = [];
  private submissionWaiters: Array<(ev: SubmissionEvent | null) => void> = [];
  private observer: MutationObserver | null = null;
  private seenStatusNodes = new WeakSet<Element>();

  detect(): boolean {
    return location.hostname === 'leetcode.com' && slugFromUrl() !== null;
  }

  async getProblem(): Promise<Problem | null> {
    const externalId = slugFromUrl();
    if (!externalId) return null;
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const title = (ogTitle || document.title.replace(/\s*-\s*LeetCode\s*$/i, '')).trim();
    return {
      platform: 'leetcode',
      externalId,
      title: title || externalId,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    const difficulty = findLeafByExactText(['Easy', 'Medium', 'Hard']);
    return {
      difficulty: (difficulty?.text as ProblemMetadata['difficulty']) ?? undefined,
      // Topics aren't reliably exposed pre-solve; the PRD forbids inventing data, so this stays empty.
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    const lang = findLeafByExactText(KNOWN_LANGUAGES);
    return lang ? { language: lang.text } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    this.ensureObserver();
    if (this.submissionQueue.length > 0) {
      return Promise.resolve(this.submissionQueue.shift()!);
    }
    return new Promise((resolve) => this.submissionWaiters.push(resolve));
  }

  private ensureObserver(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.scanForSubmissionResult());
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  private scanForSubmissionResult(): void {
    const hit = findLeafByExactText(STATUS_STRINGS);
    if (!hit || this.seenStatusNodes.has(hit.el)) return;
    this.seenStatusNodes.add(hit.el);

    const container = hit.el.closest('[class]')?.parentElement ?? hit.el.parentElement;
    const nearbyText = container?.textContent ?? '';
    const runtimeMatch = nearbyText.match(/(\d+(?:\.\d+)?\s?ms)/i);
    const memoryMatch = nearbyText.match(/(\d+(?:\.\d+)?\s?MB)/i);

    const event: SubmissionEvent = {
      status: hit.text as SubmissionStatus,
      language: 'Unknown',
      runtime: runtimeMatch?.[1],
      memory: memoryMatch?.[1],
      timestamp: Date.now(),
    };

    const waiter = this.submissionWaiters.shift();
    if (waiter) waiter(event);
    else this.submissionQueue.push(event);
  }
}
