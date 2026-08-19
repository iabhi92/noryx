import { findLeafByExactText, SubmissionWatcher, type Stoppable } from './dom-heuristics';
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

export class LeetCodeAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher((text) =>
    STATUS_STRINGS.includes(text as SubmissionStatus) ? (text as SubmissionStatus) : null,
  );

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
      difficulty: difficulty?.text,
      // Topics aren't reliably exposed pre-solve; the PRD forbids inventing data, so this stays empty.
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    const lang = findLeafByExactText(KNOWN_LANGUAGES);
    return lang ? { language: lang.text } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
