-- Read-only audit for the shared Supabase project.
--
-- Lists every function in `public` that `anon` or `authenticated` can EXECUTE,
-- flagging SECURITY DEFINER ones. The project hosts many apps that all share
-- the same public anon key, so any of these can be called by anyone who has it
-- (the key ships in every front-end bundle).
--
-- Run in the Supabase SQL editor, then for each function decide:
--   - called only by server code (API routes/cron with the service key)
--     -> revoke execute from public, anon, authenticated; grant to service_role
--   - genuinely called from the browser with no verification
--     -> move behind an API route first, then revoke
--
-- Priority review: set_admin, setup_initial_admin, set_current_user_wallet,
-- process_user_claim, tampiyo_apply_delta, and the *_game_score / upsert_* RPCs.

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (
    has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute')
  )
order by p.prosecdef desc, p.proname;
