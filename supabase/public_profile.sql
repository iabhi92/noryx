-- Run this once in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Backs the "public profile" share-link feature: a recruiter with the link sees your aggregate
-- stats, live, with no login on their end and no login for you either. Security model matches a
-- Gist link, not a real account system — see the comments below for why that's the right call here.

create table public_profiles (
  id uuid primary key default gen_random_uuid(),
  write_token uuid not null default gen_random_uuid(),
  solved int not null default 0,
  streak int not null default 0,
  success_rate int not null default 0,
  platform_counts jsonb not null default '{}'::jsonb,
  topic_highlights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public_profiles enable row level security;

-- The id is an unguessable random UUID — knowing it is what grants read access, same trust model
-- as a Gist or a Google Doc "anyone with the link" share. Nothing in this app ever lists all
-- profiles, so this policy being "anyone" is safe: it only matters if you already have one exact id.
create policy "Anyone with the id can read a profile"
  on public_profiles for select
  using (true);
grant select on public_profiles to anon;

-- Deliberately NOT granting insert/update/delete to anon on the table itself. All writes go
-- through these SECURITY DEFINER functions instead, which check write_token before touching a
-- row. Every Meow Mentor install shares the same public anon key, so without this, any installation
-- could overwrite or delete any other user's public profile.

create or replace function create_profile(p_id uuid, p_write_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public_profiles (id, write_token) values (p_id, p_write_token);
end;
$$;
grant execute on function create_profile(uuid, uuid) to anon;

create or replace function sync_profile(
  p_id uuid,
  p_write_token uuid,
  p_solved int,
  p_streak int,
  p_success_rate int,
  p_platform_counts jsonb,
  p_topic_highlights jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public_profiles
  set solved = p_solved,
      streak = p_streak,
      success_rate = p_success_rate,
      platform_counts = p_platform_counts,
      topic_highlights = p_topic_highlights,
      updated_at = now()
  where id = p_id and write_token = p_write_token;

  if not found then
    raise exception 'profile not found or write token mismatch';
  end if;
end;
$$;
grant execute on function sync_profile(uuid, uuid, int, int, int, jsonb, jsonb) to anon;

create or replace function delete_profile(p_id uuid, p_write_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public_profiles where id = p_id and write_token = p_write_token;
end;
$$;
grant execute on function delete_profile(uuid, uuid) to anon;
