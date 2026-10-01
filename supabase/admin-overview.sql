-- ─────────────────────────────────────────────────────────────
-- The owner's panel (/admin, "Tableau de bord"): the accounts.
--
-- One function, readable only by an admin (the `admins` table and
-- is_admin() from rewards.sql). It runs as the database owner so it
-- can read auth.users, and refuses everyone else before reading
-- anything. No secret key anywhere: the app calls it with the
-- signed-in admin's own session.
--
-- Run once in Supabase → SQL Editor. Safe to run again.
-- ─────────────────────────────────────────────────────────────

-- Who is an admin (the same as rewards.sql: created here too if that file was never run).
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

-- The owner's account.
insert into admins (user_id)
select id from auth.users where lower(email) = lower('solutionnetplus@gmail.com')
on conflict do nothing;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total',    (select count(*) from auth.users),
    'new_7d',   (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_7d',(select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active_1d',(select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as d, count(*) as n
        from auth.users where created_at > now() - interval '30 days'
        group by 1
      ) s
    ),
    'users', (
      select coalesce(jsonb_agg(u order by u.created_at desc), '[]'::jsonb)
      from (
        select
          au.id,
          au.email,
          coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name') as name,
          coalesce(au.raw_app_meta_data ->> 'provider', 'email') as provider,
          au.created_at,
          au.last_sign_in_at
        from auth.users au
        order by au.created_at desc
        limit 2000
      ) u
    )
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
