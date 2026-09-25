-- FORGE: everything to run ONCE in Supabase (SQL Editor -> New query -> paste all -> Run).
-- The six files of this folder, in order. Each part is safe to run again.

-- ===================== schema.sql =====================
-- FORGE — Supabase schema v1
-- Run in the SQL editor of your Supabase project. Every table stores the
-- local-first record as JSONB (same shape as src/lib/types.ts) so the app
-- schema can evolve without migrations for now; RLS keeps rows per user.

create extension if not exists "pgcrypto";

-- Rows are keyed per user, (user_id, id): local ids are only unique on one
-- device. Stats is always "me" and a day of nutrition, readiness or weigh-in
-- is keyed by its date, so on "id" alone the second athlete to sync collides
-- with the first and RLS rejects the write.
create or replace function forge_table(name text) returns void language plpgsql as $$
begin
  execute format('
    create table if not exists %I (
      id text not null,
      user_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
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

-- Account deletion: see delete-account.sql for why.
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- ===================== social.sql =====================
-- Social for FORGE Ride: the riders' rating (the "cote FORGE"), following
-- friends, clubs, and who is riding right now is Realtime presence (no table).
-- Run once in the Supabase SQL editor, after schema.sql. Safe to run again.
--
-- The rules live HERE, not in the app (the app runs on the rider's device):
--   * Everyone writes only their own rows (user_id forced to auth.uid()).
--   * A rating moves at most 120 points per update and stays in 100..3500, and
--     a rider can update it at most 30 times an hour.
--   * A club is created by its owner; people join and leave by themselves;
--     only the owner can change or delete the club.
-- Everybody signed in can read ratings, follows and clubs (handles are public already).

-- ── Ratings ────────────────────────────────────────────────────────────────
create table if not exists rider_ratings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  rating int not null check (rating between 100 and 3500),
  races int not null default 0 check (races >= 0),
  category text not null check (category in ('A', 'B', 'C', 'D')),
  club_tag text check (club_tag is null or club_tag ~ '^[A-Z0-9]{2,4}$'),
  updated_at timestamptz not null default now()
);
create index if not exists rider_ratings_board on rider_ratings (rating desc);
alter table rider_ratings enable row level security;
drop policy if exists "rider_ratings_read" on rider_ratings;
create policy "rider_ratings_read" on rider_ratings for select to authenticated using (true);
drop policy if exists "rider_ratings_insert_own" on rider_ratings;
create policy "rider_ratings_insert_own" on rider_ratings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "rider_ratings_update_own" on rider_ratings;
create policy "rider_ratings_update_own" on rider_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists rider_rating_writes (user_id uuid not null, at timestamptz not null default now());
alter table rider_rating_writes enable row level security; -- no policy: only the trigger (security definer) writes it

create or replace function rider_ratings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.updated_at := now();
  if tg_op = 'UPDATE' and abs(new.rating - old.rating) > 120 then
    raise exception 'rating change too large';
  end if;
  if tg_op = 'INSERT' and new.rating not between 700 and 1800 then
    raise exception 'a first rating starts from the category baseline';
  end if;
  if (select count(*) from rider_rating_writes where user_id = new.user_id and at > now() - interval '1 hour') >= 30 then
    raise exception 'too many rating updates, try again later';
  end if;
  insert into rider_rating_writes (user_id) values (new.user_id);
  return new;
end $$;
drop trigger if exists rider_ratings_guard on rider_ratings;
create trigger rider_ratings_guard before insert or update on rider_ratings
  for each row execute function rider_ratings_guard();

-- ── Follows (friends) ─────────────────────────────────────────────────────
create table if not exists follows (
  follower uuid not null default auth.uid() references auth.users(id) on delete cascade,
  followee uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee on follows (followee);
alter table follows enable row level security;
drop policy if exists "follows_read" on follows;
create policy "follows_read" on follows for select to authenticated using (true);
drop policy if exists "follows_insert_own" on follows;
create policy "follows_insert_own" on follows for insert to authenticated with check (follower = auth.uid());
drop policy if exists "follows_delete_own" on follows;
create policy "follows_delete_own" on follows for delete to authenticated using (follower = auth.uid());

-- ── Clubs ────────────────────────────────────────────────────────────────
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 32),
  tag text not null unique check (tag ~ '^[A-Z0-9]{2,4}$'),
  color text not null default '#FF2E78' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  about text check (about is null or char_length(about) <= 160),
  created_at timestamptz not null default now()
);
alter table clubs enable row level security;
drop policy if exists "clubs_read" on clubs;
create policy "clubs_read" on clubs for select to authenticated using (true);
drop policy if exists "clubs_insert_own" on clubs;
create policy "clubs_insert_own" on clubs for insert to authenticated with check (owner = auth.uid());
drop policy if exists "clubs_update_owner" on clubs;
create policy "clubs_update_owner" on clubs for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "clubs_delete_owner" on clubs;
create policy "clubs_delete_owner" on clubs for delete to authenticated using (owner = auth.uid());

-- One club per rider (their tag shows next to their name in the game).
create table if not exists club_members (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists club_members_club on club_members (club_id);
alter table club_members enable row level security;
drop policy if exists "club_members_read" on club_members;
create policy "club_members_read" on club_members for select to authenticated using (true);
drop policy if exists "club_members_join_self" on club_members;
create policy "club_members_join_self" on club_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "club_members_leave_self" on club_members;
create policy "club_members_leave_self" on club_members for delete to authenticated using (user_id = auth.uid());

-- At most 3 clubs created per rider per day (no flooding the list).
create or replace function clubs_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner := auth.uid();
  new.created_at := now();
  if (select count(*) from clubs where owner = new.owner and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too many clubs created today';
  end if;
  return new;
end $$;
drop trigger if exists clubs_rate_limit on clubs;
create trigger clubs_rate_limit before insert on clubs for each row execute function clubs_rate_limit();

-- ===================== segments.sql =====================
-- Segment leaderboards for the Unity indoor game (FORGE Ride): the best time
-- of every rider on every climb and sprint, worldwide and by race category.
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- The rules live HERE, not in the app, because the app runs on the rider's
-- device and can be tampered with:
--   1. A rider can only insert their own times (user_id is forced to auth.uid()).
--   2. Only efforts the app measured with a sensor are accepted ("measured").
--      Estimated (heart rate, speed sensor) and typed efforts never reach a board.
--   3. Times must be physically possible for the segment: at most 25 m/s
--      (90 km/h) on average, and never under 10 s.
--   4. At most 60 inserts per rider per hour, so a script cannot flood a board.
-- Everybody signed in can read the boards; only a first name is stored.

create table if not exists segment_efforts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  segment text not null check (char_length(segment) between 3 and 64),   -- "<route key>:<start metre>", e.g. "c8:3000"
  length_m real not null check (length_m between 100 and 50000),
  seconds real not null check (seconds >= 10),
  category text not null check (category in ('A', 'B', 'C', 'D')),
  quality text not null check (quality = 'measured'),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now(),
  check (length_m / seconds <= 25)
);
create index if not exists segment_efforts_board on segment_efforts (segment, seconds);
create index if not exists segment_efforts_rider on segment_efforts (user_id, created_at desc);

alter table segment_efforts enable row level security;
drop policy if exists "segment_efforts_read" on segment_efforts;
create policy "segment_efforts_read" on segment_efforts for select to authenticated using (true);
drop policy if exists "segment_efforts_insert_own" on segment_efforts;
create policy "segment_efforts_insert_own" on segment_efforts for insert to authenticated
  with check (user_id = auth.uid());
-- No update or delete policy: a time, once set, cannot be edited from the app.

create or replace function segment_efforts_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from segment_efforts where user_id = new.user_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many segment efforts, try again later';
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end $$;
drop trigger if exists segment_efforts_rate_limit on segment_efforts;
create trigger segment_efforts_rate_limit before insert on segment_efforts
  for each row execute function segment_efforts_rate_limit();

-- The board: each rider's best time, ranked. `cat` null = everyone.
create or replace function segment_board(seg text, cat text default null, top int default 10)
returns table (rank bigint, user_id uuid, name text, seconds real, category text, riders bigint)
language sql stable security invoker set search_path = public as $$
  with best as (
    select distinct on (e.user_id) e.user_id, e.name, e.seconds, e.category
    from segment_efforts e
    where e.segment = seg and (cat is null or e.category = cat)
    order by e.user_id, e.seconds
  ), ranked as (
    select rank() over (order by b.seconds) as rank, b.*, count(*) over () as riders from best b
  )
  select r.rank, r.user_id, r.name, r.seconds, r.category, r.riders from ranked r
  where r.rank <= greatest(1, least(top, 50)) or r.user_id = auth.uid()
  order by r.rank;
$$;
grant execute on function segment_board(text, text, int) to authenticated;

-- ===================== rewards.sql =====================
-- Rewards: gifts the owner decides, claimed in the app, approved by hand.
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- Three rules are enforced HERE, not in the app, because the app runs on
-- the user's phone and can be tampered with:
--   1. Only admins create or change campaigns, and only admins change a
--      claim's status. A user can only file a claim for themselves, and it
--      always starts as "requested": nothing ships without the owner.
--   2. A claim is refused by the database when the campaign is paused, out
--      of its dates, out of stock, or past its daily cap — so a bug or a
--      script cannot produce 40,000 claims in a day.
--   3. One claim per person per campaign (unique key).
-- Shipping addresses are readable only by their owner and by admins, and
-- are erased 120 days after a claim is shipped or rejected.

-- ── Who is an admin ──────────────────────────────────────────────────────
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table admins enable row level security;
drop policy if exists "admins_self_read" on admins;
create policy "admins_self_read" on admins for select using (auth.uid() = user_id);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function is_admin() to authenticated;

-- The owner's account. Sign in to the app with this email at least once
-- first (so the account exists), then run this file.
insert into admins (user_id)
select id from auth.users where lower(email) = lower('solutionnetplus@gmail.com')
on conflict do nothing;

-- ── Campaigns ─────────────────────────────────────────────────────────────
create table if not exists reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  image_url text,
  -- Who qualifies: a rank ("gold" or "gold:III"), a level ("25"), a badge id,
  -- a week streak ("8"), or sessions done in the calendar month ("12").
  rule_type text not null check (rule_type in ('rank', 'level', 'badge', 'streak', 'sessions_month')),
  rule_value text not null check (char_length(rule_value) between 1 and 40),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  stock int not null check (stock between 0 and 100000),
  daily_cap int not null default 50 check (daily_cap between 1 and 5000),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table reward_campaigns enable row level security;
drop policy if exists "campaigns_read" on reward_campaigns;
create policy "campaigns_read" on reward_campaigns for select using (active or is_admin());
drop policy if exists "campaigns_admin" on reward_campaigns;
create policy "campaigns_admin" on reward_campaigns for all using (is_admin()) with check (is_admin());

-- ── Claims ────────────────────────────────────────────────────────────────
create table if not exists reward_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references reward_campaigns(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'shipped', 'rejected')),
  ship_name text check (char_length(ship_name) <= 120),
  ship_line1 text check (char_length(ship_line1) <= 200),
  ship_line2 text check (char_length(ship_line2) <= 200),
  ship_city text check (char_length(ship_city) <= 120),
  ship_region text check (char_length(ship_region) <= 120),
  ship_postal text check (char_length(ship_postal) <= 30),
  ship_country text check (char_length(ship_country) = 2),
  ship_phone text check (char_length(ship_phone) <= 40),
  -- What the athlete had done when they claimed (see src/lib/rewards.ts).
  report jsonb not null default '{}'::jsonb,
  tracking text check (char_length(tracking) <= 200),
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (campaign_id, user_id)
);
create index if not exists reward_claims_campaign_idx on reward_claims (campaign_id, created_at desc);
alter table reward_claims enable row level security;

drop policy if exists "claims_read" on reward_claims;
create policy "claims_read" on reward_claims for select using (auth.uid() = user_id or is_admin());
drop policy if exists "claims_insert_own" on reward_claims;
create policy "claims_insert_own" on reward_claims for insert
  with check (auth.uid() = user_id and status = 'requested' and tracking is null and admin_note is null and decided_at is null);
drop policy if exists "claims_admin_update" on reward_claims;
create policy "claims_admin_update" on reward_claims for update using (is_admin()) with check (is_admin());
drop policy if exists "claims_admin_delete" on reward_claims;
create policy "claims_admin_delete" on reward_claims for delete using (is_admin());

-- The guard: open campaign, in stock, under today's cap.
create or replace function reward_claim_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c reward_campaigns%rowtype;
  taken int;
  today int;
begin
  select * into c from reward_campaigns where id = new.campaign_id for update;
  if not found or not c.active then raise exception 'This reward is not open.'; end if;
  if now() < c.starts_at or (c.ends_at is not null and now() > c.ends_at) then raise exception 'This reward is not open right now.'; end if;
  select count(*) into taken from reward_claims where campaign_id = c.id and status <> 'rejected';
  if taken >= c.stock then raise exception 'This reward is out of stock.'; end if;
  select count(*) into today from reward_claims where campaign_id = c.id and created_at >= date_trunc('day', now());
  if today >= c.daily_cap then raise exception 'Today''s rewards are all claimed. Try again tomorrow.'; end if;
  return new;
end $$;
drop trigger if exists reward_claim_guard on reward_claims;
create trigger reward_claim_guard before insert on reward_claims for each row execute function reward_claim_guard();

-- Addresses are kept only as long as they are needed.
create or replace function purge_reward_addresses() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update reward_claims set ship_name = null, ship_line1 = null, ship_line2 = null, ship_city = null,
    ship_region = null, ship_postal = null, ship_phone = null
  where status in ('shipped', 'rejected') and decided_at < now() - interval '120 days' and ship_line1 is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_reward_addresses() from public, anon;
grant execute on function purge_reward_addresses() to authenticated;

-- ── Photos of the gifts ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('rewards', 'rewards', true)
on conflict (id) do update set public = true;
drop policy if exists "rewards_images_read" on storage.objects;
create policy "rewards_images_read" on storage.objects for select using (bucket_id = 'rewards');
drop policy if exists "rewards_images_admin_write" on storage.objects;
create policy "rewards_images_admin_write" on storage.objects for insert with check (bucket_id = 'rewards' and is_admin());
drop policy if exists "rewards_images_admin_update" on storage.objects;
create policy "rewards_images_admin_update" on storage.objects for update using (bucket_id = 'rewards' and is_admin());
drop policy if exists "rewards_images_admin_delete" on storage.objects;
create policy "rewards_images_admin_delete" on storage.objects for delete using (bucket_id = 'rewards' and is_admin());

notify pgrst, 'reload schema';

-- ===================== voice-reports.sql =====================
-- Reports from proximity voice in the Unity indoor game (FORGE Ride): a rider
-- flags someone they heard. Run once in the Supabase SQL editor. Safe to run again.
--
-- Nothing is recorded — no audio, ever. A report is who, whom, where and why.
--   1. The reporter is always the signed-in rider (reporter is forced to auth.uid()).
--   2. Riders can insert reports but never read, edit or delete them; only the
--      project owner reads them (dashboard / service role).
--   3. At most 20 reports per rider per day, so the table cannot be flooded.

create table if not exists voice_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reported uuid not null references auth.users(id) on delete cascade,
  reported_name text not null check (char_length(reported_name) between 1 and 24),
  room text not null check (char_length(room) between 1 and 120),
  reason text not null check (reason in ('abuse', 'harassment', 'hate', 'sexual', 'spam', 'other')),
  created_at timestamptz not null default now(),
  check (reporter <> reported)
);
create index if not exists voice_reports_reported on voice_reports (reported, created_at desc);

alter table voice_reports enable row level security;
drop policy if exists "voice_reports_insert_own" on voice_reports;
create policy "voice_reports_insert_own" on voice_reports for insert to authenticated
  with check (reporter = auth.uid());
-- No select, update or delete policy for riders.

create or replace function voice_reports_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from voice_reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports';
  end if;
  return new;
end $$;
drop trigger if exists voice_reports_rate_limit on voice_reports;
create trigger voice_reports_rate_limit before insert on voice_reports
  for each row execute function voice_reports_rate_limit();

-- ===================== delete-account.sql =====================
-- Account deletion, run once in the Supabase SQL editor (also in schema.sql).
--
-- Apple, Google and the GDPR all require that a user can delete their account
-- from inside the app. A client cannot delete from auth.users, so this runs as
-- the function's owner — but only ever on the caller's own id. Every table
-- that holds user data references auth.users with ON DELETE CASCADE, so one
-- delete removes the profile, plan, logs, activities, posts, likes, handle and
-- leaderboard row with it.
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
