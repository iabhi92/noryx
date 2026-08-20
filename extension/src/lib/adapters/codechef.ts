import { findLeafMatching, extractEditorCode, SubmissionWatcher, type Stoppable } from './dom-heuristics';
import { matchStatus } from './generic';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent } from '../types';

// Verified live against codechef.com/problems/FLOW001 (2026-08-20) via `do JavaScript` — like
// GeeksforGeeks, this is fully client-rendered (`<div id="root">`), invisible to a static fetch.
// Confirmed: `.ace_editor` present, a `#submit_btn` button plus a "Run" leaf, and difficulty shown
// as a numeric rating (e.g. "242") in a `<span>` right after a "Difficulty:" label — no
// Easy/Medium/Hard tier here, CodeChef rates numerically. No stable topic/tag markup found.
// Submission requires login (not verified further); detectSubmission is best-effort only.

const PROBLEM_PATH = /\/problems\/([^/]+)/;

function pathMatch(): RegExpMatchArray | null {
  return location.pathname.match(PROBLEM_PATH);
}

/** Difficulty renders as a plain number in a sibling span right after a "Difficulty:" label —
 *  no stable class name to hang a selector on (CSS-module hashes), so this walks by label text. */
function findDifficultyRating(): string | undefined {
  const label = findLeafMatching((text) => text === 'Difficulty:');
  const value = label?.el.nextElementSibling?.textContent?.trim();
  return value || undefined;
}

export class CodeChefAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher(matchStatus);

  detect(): boolean {
    return location.hostname.endsWith('codechef.com') && pathMatch() !== null && document.querySelector('.ace_editor') !== null;
  }

  async getProblem(): Promise<Problem | null> {
    const match = pathMatch();
    if (!match) return null;
    const code = match[1];
    // Confirmed live: <title> is "{Problem Name} Practice Coding Problem".
    const title = document.title.replace(/\s*Practice Coding Problem\s*$/i, '').trim();
    return {
      platform: 'codechef',
      externalId: code,
      title: title || code,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    return {
      difficulty: findDifficultyRating(),
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    // No native <select> found live — CodeChef's language picker is a custom dropdown with no
    // confirmed stable selector, so the language itself stays unguessed. Code extraction doesn't
    // depend on that though (.ace_editor confirmed present), so this is worth returning even
    // without a known language.
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
