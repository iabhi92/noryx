import { runJavaScript } from './codeRunner';
import type { PracticeTestCase } from './types';
import type { GeneratedPracticeProblem } from './ai/types';

interface VerifyResult {
  verified: PracticeTestCase[];
  discardedCount: number;
}

// Never trust the model's claim that its own test cases are correct — actually execute its
// referenceSolutionJS against them in the same sandboxed Worker "run locally" uses, and keep
// only the cases whose claimed `expected` the reference solution actually produces.
export async function verifyTestCases(problem: GeneratedPracticeProblem): Promise<VerifyResult> {
  const harness = [
    problem.referenceSolutionJS,
    `const cases = ${JSON.stringify(problem.testCases)};`,
    'const results = cases.map((c) => {',
    '  try {',
    `    const actual = ${problem.functionName}(...c.args);`,
    '    return { pass: JSON.stringify(actual) === JSON.stringify(c.expected) };',
    '  } catch (e) {',
    '    return { pass: false };',
    '  }',
    '});',
    'console.log(JSON.stringify(results));',
  ].join('\n');

  const result = await runJavaScript(harness);
  if (result.error) return { verified: [], discardedCount: problem.testCases.length };

  try {
    const lastLine = result.output.trim().split('\n').pop() ?? '[]';
    const outcomes = JSON.parse(lastLine) as Array<{ pass: boolean }>;
    const verified = problem.testCases.filter((_, i) => outcomes[i]?.pass === true);
    return { verified, discardedCount: problem.testCases.length - verified.length };
  } catch {
    return { verified: [], discardedCount: problem.testCases.length };
  }
}
