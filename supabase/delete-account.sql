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
