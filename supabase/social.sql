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
