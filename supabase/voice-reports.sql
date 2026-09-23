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
