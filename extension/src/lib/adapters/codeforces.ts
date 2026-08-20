import { SubmissionWatcher, type Stoppable } from './dom-heuristics';
import { matchStatus } from './generic';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent } from '../types';

// Verified live against codeforces.com/problemset/problem/4/A (2026-08-20, logged out) by driving
// real Safari via AppleScript. The problem-statement page is server-rendered (no editor, no
// Cloudflare JS challenge blocking `source of document`) and carries real title/tag/rating markup.
// Submission is a different story: /problemset/submit redirects back to the problem page without
// a session, and Codeforces requires login to reach the actual submit form — same limitation the
// generic adapter already documents for AtCoder/CodeChef/Kattis/CSES. detectSubmission() below is
// therefore best-effort only (shared canonical-status text matcher), not verified against a real
// logged-in verdict page.

// Matches both /problemset/problem/{contestId}/{index} and /contest/{contestId}/problem/{index}.
const PROBLEM_PATH = /\/(?:problemset\/problem|contest\/\d+\/problem)\/(\d+)\/([A-Za-z]\d?)/;

function pathMatch(): RegExpMatchArray | null {
  return location.pathname.match(PROBLEM_PATH);
}

export class CodeforcesAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher(matchStatus);

  detect(): boolean {
    return location.hostname === 'codeforces.com' && pathMatch() !== null && document.querySelector('.problem-statement') !== null;
  }

  async getProblem(): Promise<Problem | null> {
    const match = pathMatch();
    if (!match) return null;
    const [, contestId, index] = match;
    const title = document.querySelector('.problem-statement .header .title')?.textContent?.trim();
    return {
      platform: 'codeforces',
      externalId: `${contestId}${index}`,
      title: title || `${contestId}${index}`,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    const tagBoxes = Array.from(document.querySelectorAll('.tag-box'));
    // Confirmed live: the numeric rating is rendered as a pseudo-tag with title="Difficulty"
    // (text like "*800"), mixed in among the real topic tags — filter it out from topics.
    const ratingBox = tagBoxes.find((el) => el.getAttribute('title') === 'Difficulty');
    const topics = tagBoxes
      .filter((el) => el !== ratingBox)
      .map((el) => el.textContent?.trim())
      .filter((text): text is string => !!text);

    return {
      difficulty: ratingBox?.textContent?.trim(),
      topics: topics.length ? topics : undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    // Confirmed live: no editor on the problem-statement page — Codeforces has none to detect
    // here without a logged-in session on the submit form.
    return null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
