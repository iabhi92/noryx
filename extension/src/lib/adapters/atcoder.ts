import { SubmissionWatcher, type Stoppable } from './dom-heuristics';
import { matchStatus } from './generic';
import type { CodingPlatformAdapter } from './types';
import type { Problem, ProblemMetadata, EditorState, SubmissionEvent } from '../types';

// Verified live against atcoder.jp/contests/abc086/tasks/abc086_a (2026-08-20, logged out) via
// real Safari. The task page is server-rendered with a confirmed `<p>Score : <var>N</var>
// points</p>` marker (used here as the difficulty proxy — AtCoder has no on-page tag/topic
// system to read topics from). Submission is a separate page (/contests/{id}/submit) that
// redirects straight to /login when logged out — confirmed unreachable from here, same
// login-wall limitation as Codeforces. detectSubmission() is therefore best-effort only.

const TASK_PATH = /\/contests\/([^/]+)\/tasks\/([^/]+)/;

function pathMatch(): RegExpMatchArray | null {
  return location.pathname.match(TASK_PATH);
}

export class AtCoderAdapter implements CodingPlatformAdapter, Stoppable {
  private watcher = new SubmissionWatcher(matchStatus);

  detect(): boolean {
    return location.hostname === 'atcoder.jp' && pathMatch() !== null;
  }

  async getProblem(): Promise<Problem | null> {
    const match = pathMatch();
    if (!match) return null;
    const [, , taskId] = match;
    // Confirmed live: title lives in the first text node of <span class="h2">, followed by a
    // nested "Editorial" link whose text textContent would otherwise pull in.
    const heading = document.querySelector('span.h2');
    const title = heading?.childNodes[0]?.textContent?.trim();
    return {
      platform: 'atcoder',
      externalId: taskId,
      title: title || taskId,
      url: location.href,
    };
  }

  async getProblemMetadata(): Promise<ProblemMetadata | null> {
    const scoreP = Array.from(document.querySelectorAll('p')).find((p) => /^Score\s*:/.test(p.textContent?.trim() ?? ''));
    const points = scoreP?.querySelector('var')?.textContent?.trim();
    return {
      difficulty: points ? `${points} points` : undefined,
      topics: undefined,
    };
  }

  async getEditorState(): Promise<EditorState | null> {
    // Confirmed live: no editor on the task/statement page — the submit form is a separate,
    // login-walled page that couldn't be inspected from here.
    return null;
  }

  detectSubmission(): Promise<SubmissionEvent | null> {
    return this.watcher.next();
  }

  stop(): void {
    this.watcher.stop();
  }
}
