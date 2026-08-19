import { findLeafByExactText, SubmissionWatcher } from './dom-heuristics';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent, SubmissionStatus } from '../types';

// ponytail: cross-site heuristics, not per-platform scraping — this is what makes "works on a
// variety of coding sites" tractable without a bespoke adapter per judge. It's reasonably
// reliable on ACM-style judges (Codeforces/AtCoder/Kattis/CSES/LeetCode-like verdict vocabulary,
// e.g. "Wrong Answer" / "Time Limit Exceeded"). It's weaker on platforms with custom result UIs
// (HackerRank, GeeksforGeeks, HackerEarth, CodeChef) whose exact wording wasn't verified against
// a live page — none of these sites were reachable to inspect from this environment (Cloudflare
// challenge). If one of those needs real precision, give it its own adapter, same shape as
// leetcode.ts, once you've inspected its actual DOM.

const EDITOR_SELECTORS = ['.monaco-editor', '.CodeMirror', '.cm-editor', '.ace_editor', 'textarea'];
const ACTION_BUTTON_TEXTS = ['run', 'submit', 'compile', 'execute', 'run code', 'submit code'];

const KNOWN_LANGUAGES = [
  'Python3', 'Python', 'Python 3', 'C++', 'Java', 'JavaScript', 'TypeScript', 'C', 'C#',
  'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'Scala', 'PHP', 'Dart', 'Racket', 'Erlang', 'Elixir',
  'Pascal', 'Perl', 'Haskell', 'D', 'OCaml', 'F#',
];

const CANONICAL_STATUSES: Array<{ pattern: RegExp; status: SubmissionStatus }> = [
  { pattern: /^accepted$/i, status: 'Accepted' },
  { pattern: /^correct answer$/i, status: 'Accepted' },
  { pattern: /^wrong answer$/i, status: 'Wrong Answer' },
  { pattern: /^time limit exceeded$/i, status: 'Time Limit Exceeded' },
  { pattern: /^(runtime error|run.?time error)$/i, status: 'Runtime Error' },
  { pattern: /^(compilation error|compile error)$/i, status: 'Compilation Error' },
  { pattern: /^memory limit exceeded$/i, status: 'Memory Limit Exceeded' },
];

function matchStatus(text: string): SubmissionStatus | null {
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

export class GenericCodingAdapter implements CodingPlatformAdapter {
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
    const difficulty = findLeafByExactText(['Easy', 'Medium', 'Hard']);
    return {
      difficulty: (difficulty?.text as ProblemMetadata['difficulty']) ?? undefined,
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    const lang = findLeafByExactText(KNOWN_LANGUAGES);
    if (lang) return { language: lang.text };
    const select = document.querySelector('select');
    const selected = select?.selectedOptions?.[0]?.textContent?.trim();
    return selected ? { language: selected } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }
}
