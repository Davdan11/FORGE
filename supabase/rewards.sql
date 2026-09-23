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
