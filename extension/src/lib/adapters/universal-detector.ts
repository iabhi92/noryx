import type { CodingPlatformAdapter } from './types';
import { LeetCodeAdapter } from './leetcode';
import { GenericCodingAdapter } from './generic';

// Order matters: more precise adapters first, GenericCodingAdapter last as the broad fallback.
const ADAPTER_FACTORIES: Array<() => CodingPlatformAdapter> = [
  () => new LeetCodeAdapter(),
  () => new GenericCodingAdapter(),
];

export function detectAdapter(): CodingPlatformAdapter | null {
  for (const create of ADAPTER_FACTORIES) {
    const adapter = create();
    if (adapter.detect()) return adapter;
  }
  return null;
}
