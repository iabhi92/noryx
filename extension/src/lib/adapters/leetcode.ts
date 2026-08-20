import { findLeafByExactText, extractEditorCode, KNOWN_LANGUAGES, type Stoppable } from './dom-heuristics';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent, SubmissionStatus } from '../types';

// Verified live against leetcode.com/problems/two-sum/ (2026-08-20, logged out) by driving real
// Safari via AppleScript — Cloudflare blocks curl/WebFetch here, but a real browser passes its
// challenge the same way normal browsing does. `data-e2e-locator` is LeetCode's own stable
// test-id convention (confirmed present on the Run/Submit buttons and the result panel), so this
// leans on that wherever it exists instead of the fuzzy leaf-text walk used elsewhere.
const RUN_BUTTON_SELECTOR = '[data-e2e-locator="console-run-button"]';
const SUBMIT_BUTTON_SELECTOR = '[data-e2e-locator="console-submit-button"]';
const RESULT_SELECTOR = '[data-e2e-locator="console-result"]';
// Difficulty badge: class is literally `text-difficulty-easy` / `-medium` / `-hard` (a themed
// design token, backed by `--difficulty-easy` etc. CSS custom properties) — confirmed live.
const DIFFICULTY_SELECTOR = '[class*="text-difficulty-"]';

const STATUS_STRINGS: SubmissionStatus[] = [
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Runtime Error',
  'Compilation Error',
  'Memory Limit Exceeded',
];

// ponytail: confirmed live that the button shows the plain language name ("Python"), not always
// "Python3" — leaf-text match against KNOWN_LANGUAGES (dom-heuristics.ts), no stable locator
// found for the language picker.

function slugFromUrl(): string | null {
  const match = location.pathname.match(/\/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

/** Run and Submit render into the *same* result element on LeetCode, so without tracking which
 *  button was actually clicked, every debug "Run" click during iteration would get miscounted as
 *  a real submission attempt. This watches Run/Submit clicks (event delegation — works even if the
 *  buttons haven't mounted yet) and only reports a result that followed a Submit click. */
class LeetCodeSubmissionWatcher implements Stoppable {
  private queue: SubmissionEvent[] = [];
  private waiters: Array<(ev: SubmissionEvent | null) => void> = [];
  private observer: MutationObserver | null = null;
  private lastAction: 'run' | 'submit' | null = null;
  private lastSeenText: string | null = null;
  private onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (target?.closest(SUBMIT_BUTTON_SELECTOR)) this.lastAction = 'submit';
    else if (target?.closest(RUN_BUTTON_SELECTOR)) this.lastAction = 'run';
  };

  next(): Promise<SubmissionEvent | null> {
    this.ensureObserver();
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private ensureObserver(): void {
    if (this.observer) return;
    document.addEventListener('click', this.onClick, true);
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  private scan(): void {
    const el = document.querySelector(RESULT_SELECTOR);
    const text = el?.textContent?.trim() ?? null;
    if (!text || text === this.lastSeenText) return;
    this.lastSeenText = text;
    if (this.lastAction !== 'submit' || !STATUS_STRINGS.includes(text as SubmissionStatus)) return;
    this.lastAction = null;

    // Confirmed live: a sibling div reads "Runtime: 0 ms" next to the verdict; memory only
    // showed up on accepted runs in practice, so it stays optional here.
    const container = el!.closest('.space-y-4') ?? el!.parentElement;
    const nearbyText = container?.textContent ?? '';
    const runtimeMatch = nearbyText.match(/Runtime:\s*([\d.]+\s?ms)/i);
    const memoryMatch = nearbyText.match(/Memory:\s*([\d.]+\s?MB)/i);

    const submissionEvent: SubmissionEvent = {
      status: text as SubmissionStatus,
      language: 'Unknown',
      runtime: runtimeMatch?.[1],
      memory: memoryMatch?.[1],
      timestamp: Date.now(),
    };

    const waiter = this.waiters.shift();
    if (waiter) waiter(submissionEvent);
    else this.queue.push(submissionEvent);
  }

  stop(): void {
    document.removeEventListener('click', this.onClick, true);
    this.observer?.disconnect();
    this.observer = null;
    const pending = this.waiters.splice(0);
    pending.forEach((resolve) => resolve(null));
  }
}

export class LeetCodeAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new LeetCodeSubmissionWatcher();

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
    const badge = document.querySelector(DIFFICULTY_SELECTOR);
    return {
      difficulty: badge?.textContent?.trim(),
      // Topics aren't reliably exposed pre-solve; the PRD forbids inventing data, so this stays empty.
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    const lang = findLeafByExactText(KNOWN_LANGUAGES);
    return lang ? { language: lang.text, code: extractEditorCode() } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
