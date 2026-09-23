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
