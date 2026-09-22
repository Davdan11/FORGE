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
