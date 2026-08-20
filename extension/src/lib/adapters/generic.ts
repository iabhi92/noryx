import { findLeafByExactText, extractEditorCode, KNOWN_LANGUAGES, SubmissionWatcher, type Stoppable } from './dom-heuristics';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent, SubmissionStatus } from '../types';

// ponytail: cross-site heuristics, not per-platform scraping — this is what makes "works on a
// variety of coding sites" tractable without a bespoke adapter per judge.
//
// Verified against real (logged-out) HTML fetched from each site — see extension/README.md for
// the honest per-platform status. Short version: works where the problem page itself has an
// in-browser editor + Run/Submit control (confirmed on HackerRank). Several major platforms don't
// fit that shape at all when logged out — AtCoder's submit form lives on a separate URL from the
// problem statement, CodeChef's editor isn't in the static page, and Kattis/CSES show no
// in-page submission UI without an authenticated session — so this adapter simply won't detect a
// session on those pages as they render logged-out. LeetCode and Codeforces couldn't be inspected
// at all (Cloudflare challenge blocked fetching from this environment). None of that is guessable
// from here — it needs real DOM pasted from a logged-in session, the same way LeetCode's adapter
// is being hardened.

const EDITOR_SELECTORS = ['.monaco-editor', '.CodeMirror', '.cm-editor', '.ace_editor', 'textarea'];
const ACTION_BUTTON_TEXTS = ['run', 'submit', 'compile', 'execute', 'run code', 'submit code'];

const CANONICAL_STATUSES: Array<{ pattern: RegExp; status: SubmissionStatus }> = [
  { pattern: /^accepted$/i, status: 'Accepted' },
  { pattern: /^correct answer$/i, status: 'Accepted' },
  { pattern: /^wrong answer$/i, status: 'Wrong Answer' },
  { pattern: /^time limit exceeded$/i, status: 'Time Limit Exceeded' },
  { pattern: /^(runtime error|run.?time error)$/i, status: 'Runtime Error' },
  { pattern: /^(compilation error|compile error)$/i, status: 'Compilation Error' },
  { pattern: /^memory limit exceeded$/i, status: 'Memory Limit Exceeded' },
];

export function matchStatus(text: string): SubmissionStatus | null {
  return CANONICAL_STATUSES.find((rule) => rule.pattern.test(text))?.status ?? null;
}

function hasCodeEditor(): boolean {
  return EDITOR_SELECTORS.some((sel) => document.querySelector(sel) !== null);
}

function hasActionButton(): boolean {
  const controls = document.querySelectorAll('button, a[role="button"], input[type="submit"]');
  for (const el of Array.from(controls)) {
    const text = (el.textContent || (el as HTMLInputElement).value || '').trim().toLowerCase();
    if (ACTION_BUTTON_TEXTS.includes(text)) return true;
  }
  return false;
}

export class GenericCodingAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher(matchStatus);

  detect(): boolean {
    return hasCodeEditor() && hasActionButton();
  }

  async getProblem(): Promise<Problem | null> {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const heading = document.querySelector('h1')?.textContent?.trim();
    const title = (ogTitle || heading || document.title).trim();
    if (!title) return null;
    return {
      platform: location.hostname.replace(/^www\./, ''),
      externalId: location.pathname.replace(/\/+$/, '') || '/',
      title,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    // 'Basic' confirmed as GeeksforGeeks's tier below Easy (seen in its embedded problem JSON);
    // included here in case it's also rendered as a standalone badge, same as Easy/Medium/Hard.
    const difficulty = findLeafByExactText(['Basic', 'Easy', 'Medium', 'Hard']);
    return {
      difficulty: difficulty?.text,
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    const code = extractEditorCode();
    const lang = findLeafByExactText(KNOWN_LANGUAGES);
    if (lang) return { language: lang.text, code };
    const select = document.querySelector('select');
    const selected = select?.selectedOptions?.[0]?.textContent?.trim();
    return selected ? { language: selected, code } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
