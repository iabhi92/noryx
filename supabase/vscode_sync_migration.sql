-- Run this once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Incremental on top of public_profile.sql (which you've already run) — this only adds a column
-- and a function, it does NOT recreate public_profiles, so it's safe to run against the live
-- table without touching existing rows.
--
-- Backs "cross-editor identity": the same id/write_token pair that unlocks writes from the Safari
-- extension (see sync_profile in public_profile.sql) now also accepts writes from the MeowMentor VS
-- Code extension, so time spent coding locally counts toward the same public profile.

alter table public_profiles add column if not exists vscode_active_ms bigint not null default 0;

-- Additive, unlike sync_profile's full-snapshot overwrite: the VS Code extension only ever knows
-- its own delta since its last sync, never the browser extension's full local state, so it can't
-- overwrite solved/streak/platform_counts/etc. even by accident — this function touches nothing
-- but vscode_active_ms.
create or replace function increment_vscode_time(p_id uuid, p_write_token uuid, p_delta_ms bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public_profiles
  set vscode_active_ms = vscode_active_ms + p_delta_ms,
      updated_at = now()
  where id = p_id and write_token = p_write_token;

  if not found then
    raise exception 'profile not found or write token mismatch';
  end if;
end;
$$;
grant execute on function increment_vscode_time(uuid, uuid, bigint) to anon;
