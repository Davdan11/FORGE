-- FORGE on a Garmin watch: the day's summary ("watch feed") and the pairing code.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run again.
--
-- How it works
--   * The phone app (signed in) writes ONE small JSON document per user into
--     watch_feed: today's session, meals, targets, rank, XP, gems, streak.
--     Only its owner can read or write that row (row level security).
--   * The watch has no Supabase account. The owner makes a pairing code in
--     Settings → Garmin watch and types it once in the Garmin Connect app
--     (the FORGE watch app's settings). The watch then calls
--       POST /rest/v1/rpc/watch_feed_for   {"code": "..."}
--     with the public (publishable) key. That function runs with owner
--     rights, looks the code up and returns that user's feed — and nothing
--     else: no id, no email, no other table, no other user.
--
-- Security
--   * The code is a bearer secret: whoever has it can read that one feed
--     (a training/meal summary, no contact details). It is 12 characters
--     from a 31-letter alphabet (no 0/O/1/I/L), ~59 bits of randomness from
--     pgcrypto: guessing one over HTTP is not realistic.
--   * The code table itself is readable only by its owner; nobody (not even
--     the owner) can insert or change a code except through the two owner
--     functions below, which always make a fresh random code.
--   * One code per user. Making a new one ("rotate") or revoking deletes the
--     old one immediately; revoking also deletes the published feed.
--   * A wrong code gets the same short answer as a missing one
--     ({"error":"invalid"}), so the function does not reveal which codes
--     or users exist. The lookup is a single primary-key read (cheap, so
--     Supabase's normal API rate limits are the only throttle needed).
--   * The feed is capped at 16 KB in the database (the app sends ~2 KB).

create extension if not exists pgcrypto with schema extensions;

-- ── The feed ──────────────────────────────────────────────────────────────
create table if not exists watch_feed (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 16384),
  updated_at timestamptz not null default now()
);
alter table watch_feed enable row level security;

drop policy if exists "watch_feed_own_select" on watch_feed;
drop policy if exists "watch_feed_own_insert" on watch_feed;
drop policy if exists "watch_feed_own_update" on watch_feed;
drop policy if exists "watch_feed_own_delete" on watch_feed;
create policy "watch_feed_own_select" on watch_feed for select to authenticated using (auth.uid() = user_id);
create policy "watch_feed_own_insert" on watch_feed for insert to authenticated with check (auth.uid() = user_id);
create policy "watch_feed_own_update" on watch_feed for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watch_feed_own_delete" on watch_feed for delete to authenticated using (auth.uid() = user_id);

revoke all on watch_feed from anon;
grant select, insert, update, delete on watch_feed to authenticated;

-- ── The pairing code ─────────────────────────────────────────────────────
create table if not exists watch_pairing (
  code text primary key check (code ~ '^[A-HJKMNP-Z2-9]{12}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Optional end date. Null = valid until rotated or revoked.
  expires_at timestamptz,
  -- Last time a watch read the feed with this code (updated at most every 10 min).
  last_used_at timestamptz
);
alter table watch_pairing enable row level security;

drop policy if exists "watch_pairing_own_select" on watch_pairing;
create policy "watch_pairing_own_select" on watch_pairing for select to authenticated using (auth.uid() = user_id);
-- No insert / update / delete policies: codes are made and removed only by the functions below.

revoke all on watch_pairing from anon;
revoke all on watch_pairing from authenticated;
grant select on watch_pairing to authenticated;

-- A fresh random code: 12 characters, unambiguous alphabet, from pgcrypto's secure random bytes.
create or replace function watch_new_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- 31 characters
  b bytea := extensions.gen_random_bytes(24);
  res text := '';
  i int := 0;
  v int;
begin
  -- Rejection sampling: bytes >= 248 (8 × 31) are skipped so every letter is equally likely.
  while length(res) < 12 loop
    if i >= length(b) then b := extensions.gen_random_bytes(24); i := 0; end if;
    v := get_byte(b, i); i := i + 1;
    if v < 248 then res := res || substr(alphabet, (v % 31) + 1, 1); end if;
  end loop;
  return res;
end $$;
revoke all on function watch_new_code() from public, anon, authenticated;

-- Owner: make (or replace) my code. Returns the new code; the old one stops working at once.
create or replace function watch_pairing_rotate() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  c text;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from watch_pairing where user_id = me;
  loop
    c := watch_new_code();
    begin
      insert into watch_pairing (code, user_id) values (c, me);
      exit;
    exception when unique_violation then
      -- astronomically unlikely collision: try another code
    end;
  end loop;
  return c;
end $$;
revoke all on function watch_pairing_rotate() from public, anon;
grant execute on function watch_pairing_rotate() to authenticated;

-- Owner: unpair every watch. Deletes the code and the published feed.
create or replace function watch_pairing_revoke() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from watch_pairing where user_id = me;
  delete from watch_feed where user_id = me;
end $$;
revoke all on function watch_pairing_revoke() from public, anon;
grant execute on function watch_pairing_revoke() to authenticated;

-- The watch: the feed for a pairing code, or {"error":"invalid"} / {"error":"empty"}.
-- Accepts the code with or without dashes/spaces, any case ("abcd-2345-wxyz").
create or replace function watch_feed_for(code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  p watch_pairing%rowtype;
  f jsonb;
begin
  if length(c) <> 12 then return jsonb_build_object('error', 'invalid'); end if;
  select * into p from watch_pairing w where w.code = c and (w.expires_at is null or w.expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if p.last_used_at is null or p.last_used_at < now() - interval '10 minutes' then
    update watch_pairing set last_used_at = now() where watch_pairing.code = c;
  end if;
  select data into f from watch_feed where user_id = p.user_id;
  if f is null then return jsonb_build_object('error', 'empty'); end if;
  return f;
end $$;
revoke all on function watch_feed_for(text) from public;
grant execute on function watch_feed_for(text) to anon, authenticated;
