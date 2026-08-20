import { findLeafByExactText, extractEditorCode, SubmissionWatcher, type Stoppable } from './dom-heuristics';
import { matchStatus } from './generic';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent } from '../types';

// Verified live against geeksforgeeks.org/problems/reverse-a-linked-list/1 (2026-08-20) — this
// site is a client-rendered Next.js app (`<div id="__next">`), so a static/logged-out fetch (what
// the README's earlier pass used) sees none of this; had to drive real Safari with `do JavaScript`
// to read the post-hydration DOM. Confirmed: `.ace_editor` present, a "Submit" button, and
// difficulty rendered as an isolated leaf ("Easy") next to a "Difficulty:" label — the generic
// adapter would actually already detect this page once hydrated. This dedicated adapter exists
// for a clean platform key and title instead of the raw hostname/`<title>` suffix.
// Submission itself requires login (not verified further); detectSubmission is best-effort only.

const PROBLEM_PATH = /\/problems\/([^/]+)/;

function pathMatch(): RegExpMatchArray | null {
  return location.pathname.match(PROBLEM_PATH);
}

export class GeeksforGeeksAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher(matchStatus);

  detect(): boolean {
    return location.hostname.endsWith('geeksforgeeks.org') && pathMatch() !== null && document.querySelector('.ace_editor') !== null;
  }

  async getProblem(): Promise<Problem | null> {
    const match = pathMatch();
    if (!match) return null;
    const slug = match[1];
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    // Confirmed live: page <title>/og:title is "{Problem Name} | Practice | GeeksforGeeks".
    const title = (ogTitle || document.title).replace(/\s*\|\s*Practice\s*\|\s*GeeksforGeeks\s*$/i, '').trim();
    return {
      platform: 'geeksforgeeks',
      externalId: slug,
      title: title || slug,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    // 'Basic' is GFG's tier below Easy — confirmed present in its embedded problem JSON.
    const difficulty = findLeafByExactText(['Basic', 'Easy', 'Medium', 'Hard']);
    return {
      difficulty: difficulty?.text,
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    // No native <select> found live — GFG's language picker is a custom dropdown component with
    // no confirmed stable selector, so the language itself stays unguessed. Code extraction
    // doesn't depend on that (.ace_editor confirmed present), so this is worth returning anyway.
    const code = extractEditorCode();
    return code ? { language: 'Unknown', code } : null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
