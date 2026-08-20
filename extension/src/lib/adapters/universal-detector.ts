import type { CodingPlatformAdapter } from './types';
import { LeetCodeAdapter } from './leetcode';
import { CodeforcesAdapter } from './codeforces';
import { AtCoderAdapter } from './atcoder';
import { GeeksforGeeksAdapter } from './geeksforgeeks';
import { CodeChefAdapter } from './codechef';
import { GenericCodingAdapter } from './generic';

// Order matters: more precise adapters first, GenericCodingAdapter last as the broad fallback.
const ADAPTER_FACTORIES: Array<() => CodingPlatformAdapter> = [
  () => new LeetCodeAdapter(),
  () => new CodeforcesAdapter(),
  () => new AtCoderAdapter(),
  () => new GeeksforGeeksAdapter(),
  () => new CodeChefAdapter(),
  () => new GenericCodingAdapter(),
];

export function detectAdapter(): CodingPlatformAdapter | null {
  for (const create of ADAPTER_FACTORIES) {
    const adapter = create();
    if (adapter.detect()) return adapter;
  }
  return null;
}
