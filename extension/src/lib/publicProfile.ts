import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';
import { getSettings, saveSettings } from './settings';
import { computeProfileStats } from './stats';

const HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function rpc(fn: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${fn} failed (${res.status}): ${await res.text()}`);
  }
}

export function shareUrlFor(id: string): string {
  return `https://iabhi92.github.io/noryx/u.html?id=${id}`;
}

/** One opaque string carrying {id, writeToken} for the VS Code extension's "Set Sync Code"
 *  command — same identity as the public profile, so VS Code time lands on the same row. Base64
 *  JSON rather than two UUIDs pasted side by side: one paste-able string, no field-order ambiguity. */
export function syncCodeFor(id: string, writeToken: string): string {
  return btoa(JSON.stringify({ id, writeToken }));
}

/** Turns on the public profile: creates the row, saves the id/write_token locally (the
 *  write_token never leaves this device again after this), and does an initial sync so the link
 *  isn't blank the moment it's shared. */
export async function enablePublicProfile(): Promise<string> {
  const id = crypto.randomUUID();
  const writeToken = crypto.randomUUID();
  await rpc('create_profile', { p_id: id, p_write_token: writeToken });
  await saveSettings({ publicProfile: { id, writeToken } });
  await syncPublicProfile();
  return shareUrlFor(id);
}

/** Deletes the row server-side (not just stops syncing) — turning this off actually removes the
 *  public data, since the old link would otherwise keep serving stale stats forever. */
export async function disablePublicProfile(): Promise<void> {
  const { publicProfile } = await getSettings();
  if (!publicProfile) return;
  await rpc('delete_profile', { p_id: publicProfile.id, p_write_token: publicProfile.writeToken });
  await saveSettings({ publicProfile: undefined });
}

export async function syncPublicProfile(): Promise<void> {
  const { publicProfile } = await getSettings();
  if (!publicProfile) return;
  const stats = await computeProfileStats();
  await rpc('sync_profile', {
    p_id: publicProfile.id,
    p_write_token: publicProfile.writeToken,
    p_solved: stats.solved,
    p_streak: stats.streak,
    p_success_rate: stats.successRate,
    p_platform_counts: stats.platformCounts,
    p_topic_highlights: stats.topicHighlights,
  });
}
