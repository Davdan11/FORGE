-- FORGE: checks that setup-all.sql went in (SQL Editor -> New query -> paste -> Run). Changes nothing.
-- One line per piece: OK or MISSING. Everything should say OK.
with wanted(kind, name) as (values
  ('table','profiles'),('table','plans'),('table','sessions'),('table','sets'),('table','logs'),
  ('table','readiness'),('table','activities'),('table','nutrition'),('table','stats'),('table','weights'),
  ('table','injuries'),('table','leaderboard'),('table','handles'),('table','posts'),('table','post_likes'),
  ('table','rider_ratings'),('table','rider_rating_writes'),('table','follows'),('table','clubs'),
  ('table','club_members'),('table','segment_efforts'),('table','admins'),('table','reward_campaigns'),
  ('table','reward_claims'),('table','voice_reports'),
  ('function','segment_board'),('function','purge_reward_addresses'),('function','is_admin'),
  ('function','delete_my_account'),
  ('bucket','rewards')
)
select w.kind as "type", w.name as "nom",
  case when (
    (w.kind = 'table' and exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = w.name))
    or (w.kind = 'function' and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = w.name))
    or (w.kind = 'bucket' and exists (select 1 from storage.buckets b where b.id = w.name))
  ) then 'OK' else 'MISSING' end as "etat",
  case when w.kind = 'table' then coalesce((select case when c.relrowsecurity then 'protected (RLS on)' else 'RLS OFF' end
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = w.name), '') else '' end as "securite"
from wanted w
order by 3 desc, 1, 2;
