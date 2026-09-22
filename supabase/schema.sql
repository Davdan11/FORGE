-- FORGE — Supabase schema v1
-- Run in the SQL editor of your Supabase project. Every table stores the
-- local-first record as JSONB (same shape as src/lib/types.ts) so the app
-- schema can evolve without migrations for now; RLS keeps rows per user.

create extension if not exists "pgcrypto";

create or replace function forge_table(name text) returns void language plpgsql as $$
begin
  execute format('
    create table if not exists %I (
      id text primary key,
      user_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );
    alter table %I enable row level security;
    drop policy if exists "%I_owner" on %I;
    create policy "%I_owner" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    create index if not exists %I_user_idx on %I (user_id, updated_at desc);
  ', name, name, name, name, name, name, name, name);
end $$;

select forge_table('profiles');
select forge_table('plans');
select forge_table('sessions');
select forge_table('sets');
select forge_table('logs');
select forge_table('readiness');
select forge_table('activities');
select forge_table('nutrition');
select forge_table('stats');
select forge_table('weights');
select forge_table('injuries');

-- Public leaderboard view (opt-in later): level + streak only, no personal data.
create table if not exists leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  city text,
  level int not null default 1,
  xp int not null default 0,
  streak_weeks int not null default 0,
  updated_at timestamptz not null default now()
);
alter table leaderboard enable row level security;
drop policy if exists "leaderboard_read" on leaderboard;
create policy "leaderboard_read" on leaderboard for select using (true);
drop policy if exists "leaderboard_write" on leaderboard;
create policy "leaderboard_write" on leaderboard for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Social layer
--
-- Three rules are enforced here rather than in the client, because a
-- client-side rule is a request and a database rule is a fact:
--
--   1. A post is readable by anyone signed in, writable only by its author.
--   2. A like belongs to exactly one person and cannot be forged.
--   3. A post whose numbers do not describe something a human body can
--      do is refused, whatever the client claims about it.
--
-- What is deliberately NOT here: any table that could hold a position
-- while someone is moving. There is no live-location table because
-- there is no live-location feature, and the absence is the guarantee.
-- ─────────────────────────────────────────────────────────────

-- Handles are public identities, separate from profiles.name, which is
-- whatever someone typed when the app asked what to call them.
create table if not exists handles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table handles enable row level security;
drop policy if exists "handles_read" on handles;
create policy "handles_read" on handles for select to authenticated using (true);
drop policy if exists "handles_own" on handles;
create policy "handles_own" on handles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  created_at timestamptz not null default now(),
  -- Coarse grid cell, several km across. The only location a post holds.
  cell text not null,
  sport text not null,
  title text not null,
  distance_m int not null,
  duration_sec int not null,
  moving_sec int not null default 0,
  elev_m int not null default 0,
  verdict text not null default 'unverified' check (verdict in ('verified','partial','unverified')),
  -- Trimmed, thinned [[lat,lng],...]. Never the raw track.
  route jsonb,
  like_count int not null default 0,

  -- Physical plausibility, checked by the database. The client computes a
  -- richer verdict, but the client can be lied to; these cannot.
  constraint posts_duration_sane check (duration_sec > 0 and duration_sec <= 172800),
  constraint posts_distance_sane check (distance_m >= 0 and distance_m <= 1000000),
  constraint posts_moving_sane check (moving_sec >= 0 and moving_sec <= duration_sec),
  constraint posts_elev_sane check (elev_m >= 0 and elev_m <= 30000),
  -- 30 m/s is 108 km/h. Nothing self-propelled sustains that, so anything
  -- above it is a vehicle or a fabrication either way.
  constraint posts_speed_sane check (distance_m <= duration_sec * 30),
  -- A published route must be trimmed and thinned before it arrives. A payload
  -- larger than this is a raw track, and raw tracks are not publishable.
  constraint posts_route_thinned check (route is null or (jsonb_typeof(route) = 'array' and jsonb_array_length(route) <= 240))
);
alter table posts enable row level security;
create index if not exists posts_cell_idx on posts (cell, created_at desc);
create index if not exists posts_user_idx on posts (user_id, created_at desc);

drop policy if exists "posts_read" on posts;
-- `to authenticated` matters: without it the anon key that ships in the app
-- bundle is enough to read every route anyone ever published. Signing up is a
-- low bar, but it is a bar, and it makes scraping attributable.
create policy "posts_read" on posts for select to authenticated using (true);
drop policy if exists "posts_own_insert" on posts;
create policy "posts_own_insert" on posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts_own_update" on posts;
create policy "posts_own_update" on posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts_own_delete" on posts;
create policy "posts_own_delete" on posts for delete using (auth.uid() = user_id);

-- RLS decides WHICH rows you may touch; it says nothing about which columns.
-- Without this, an author could PATCH their own post and set like_count to
-- whatever they fancied — the row is theirs, so every policy above says yes.
-- Column grants are how Postgres answers that question, so like_count is
-- simply not in the set of columns this role may write. The counter trigger
-- below runs as the table owner and is unaffected.
revoke all on posts from authenticated;
grant select, delete on posts to authenticated;
grant insert (id, user_id, handle, cell, sport, title, distance_m, duration_sec, moving_sec, elev_m, verdict, route) on posts to authenticated;
-- id and user_id are in the update list because an upsert re-sends them on
-- conflict; RLS still decides whose rows may be touched, and the WITH CHECK
-- above refuses any update that would hand a post to somebody else.
grant update (id, user_id, handle, title, cell, sport, distance_m, duration_sec, moving_sec, elev_m, verdict, route) on posts to authenticated;

create table if not exists post_likes (
  post_id text not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;
create index if not exists post_likes_user_idx on post_likes (user_id);

drop policy if exists "post_likes_read" on post_likes;
create policy "post_likes_read" on post_likes for select to authenticated using (true);
drop policy if exists "post_likes_own_insert" on post_likes;
create policy "post_likes_own_insert" on post_likes for insert with check (auth.uid() = user_id);
drop policy if exists "post_likes_own_delete" on post_likes;
create policy "post_likes_own_delete" on post_likes for delete using (auth.uid() = user_id);

-- like_count is maintained here so that two people liking at once cannot
-- overwrite each other, which is exactly what a read-then-write from the
-- client would do.
-- `security definer` without a pinned search_path is a privilege-escalation
-- hole: the function would resolve `posts` through the caller's search_path,
-- and a caller who can create a schema can therefore choose which table this
-- runs against. Pinning it closes that.
create or replace function forge_like_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists post_likes_count on post_likes;
create trigger post_likes_count after insert or delete on post_likes
  for each row execute function forge_like_count();

-- The trigger runs as its owner so it can touch a row the liker does not own.
-- Everything else about that row stays untouchable: the policies above still
-- decide who may write posts, and this function only ever moves the counter.
