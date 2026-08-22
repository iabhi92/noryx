import assert from 'node:assert';
import { computeStreak } from './stats';
import type { CodingSession } from './types';

const DAY = 86_400_000;
const NOW = Date.now();

function sessionAt(daysAgo: number): CodingSession {
  return {
    id: `s${daysAgo}`,
    problemKey: 'p',
    startedAt: NOW - daysAgo * DAY,
    activeMs: 0,
    idleMs: 0,
    tabSwitches: 0,
    pasteCount: 0,
    pasteChars: 0,
    attempts: 0,
    hintLevel: 0,
  };
}

assert.strictEqual(computeStreak([]), 0, 'no sessions should be a 0 streak');

// Solved today and the two days before — a clean 3-day streak.
assert.strictEqual(
  computeStreak([sessionAt(0), sessionAt(1), sessionAt(2)]),
  3,
  'consecutive days including today should count all of them',
);

// Nothing today yet, but yesterday and the day before were solved — streak is still alive, not
// reset to 0 just because today hasn't happened yet.
assert.strictEqual(
  computeStreak([sessionAt(1), sessionAt(2)]),
  2,
  'a missing today should not zero out an otherwise-continuing streak',
);

// Nothing today or yesterday — the streak is actually broken.
assert.strictEqual(
  computeStreak([sessionAt(2), sessionAt(3)]),
  0,
  'a gap of two or more days should reset the streak to 0',
);

console.log('stats.ts: all checks passed');
