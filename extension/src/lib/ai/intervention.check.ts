import assert from 'node:assert';
import { shouldIntervene, COOLDOWN_MINUTES, STUCK_MINUTES } from './intervention';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

// Fresh session, no submissions yet, barely started — stay quiet.
assert.strictEqual(
  shouldIntervene({ startedAt: NOW, lastHintAt: undefined, endedAt: undefined }, [], NOW).intervene,
  false,
  'fresh session should not intervene',
);

// Two consecutive Wrong Answers — repeated error.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW, lastHintAt: undefined, endedAt: undefined },
    [{ status: 'Wrong Answer' }, { status: 'Wrong Answer' }],
    NOW,
  ).reason,
  'repeated-error',
  'two consecutive failures should trigger repeated-error',
);

// Three total failures, not all the same status — many-failed-submissions.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW, lastHintAt: undefined, endedAt: undefined },
    [{ status: 'Wrong Answer' }, { status: 'Time Limit Exceeded' }, { status: 'Runtime Error' }],
    NOW,
  ).reason,
  'many-failed-submissions',
  'three varied failures should trigger many-failed-submissions',
);

// Stuck past the threshold with zero submissions.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW - (STUCK_MINUTES + 1) * MIN, lastHintAt: undefined, endedAt: undefined },
    [],
    NOW,
  ).reason,
  'stuck-no-attempts',
  'no submissions past the stuck threshold should trigger stuck-no-attempts',
);

// Already solved — never intervene, even with a failure history.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW, lastHintAt: undefined, endedAt: NOW },
    [{ status: 'Wrong Answer' }, { status: 'Wrong Answer' }],
    NOW,
  ).intervene,
  false,
  'an already-solved session should never intervene',
);

// Cooldown active — a fresh trigger condition is still suppressed.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW, lastHintAt: NOW - (COOLDOWN_MINUTES - 1) * MIN, endedAt: undefined },
    [{ status: 'Wrong Answer' }, { status: 'Wrong Answer' }],
    NOW,
  ).intervene,
  false,
  'a hint within the cooldown window should suppress intervention',
);

// Cooldown expired — the same condition now fires.
assert.strictEqual(
  shouldIntervene(
    { startedAt: NOW, lastHintAt: NOW - (COOLDOWN_MINUTES + 1) * MIN, endedAt: undefined },
    [{ status: 'Wrong Answer' }, { status: 'Wrong Answer' }],
    NOW,
  ).intervene,
  true,
  'the same condition should fire again once the cooldown has passed',
);

console.log('intervention.ts: all checks passed');
