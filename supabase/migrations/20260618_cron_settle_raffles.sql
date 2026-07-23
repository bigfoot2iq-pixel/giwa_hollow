-- Settle expired raffles on a schedule using Supabase Cron (pg_cron + pg_net).
-- A Postgres cron job POSTs to the Next.js endpoint; the endpoint activates due
-- raffles and ends raffles past their end_date on-chain.
--
-- Both extensions are included free on all Supabase plans. The app URL is filled
-- in below; replace the one remaining placeholder before running:
--   <CRON_SECRET>  must match the CRON_SECRET env var set in the app (Vercel).
--                  Do NOT commit the real secret here -- cron.job is readable by
--                  the postgres role and this file is tracked in git. Paste the
--                  filled statement into the Supabase SQL editor instead, or use
--                  the Vault variant at the bottom.
--
-- NOTE: schedule is '30 seconds' (pg_cron sub-minute syntax). The endpoint now
--       processes at most SETTLE_BATCH_SIZE (default 20) raffles per run, oldest
--       first, so each invocation stays short. Short intervals can still overlap
--       (two POSTs in flight) -> watchdog nonce collisions; bump to '1 minute' if
--       you see nonce errors, or guard the endpoint with a DB advisory lock.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop a previous version of the job before (re)creating it.
select cron.unschedule('settle-expired-raffles')
where exists (select 1 from cron.job where jobname = 'settle-expired-raffles');

select cron.schedule(
  'settle-expired-raffles',
  '30 seconds',
  $$
  select net.http_post(
    url     := 'https://litvm-raffle.vercel.app/api/cron/settle-raffles',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Inspect the schedule and recent runs:
--   select * from cron.job where jobname = 'settle-expired-raffles';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'settle-expired-raffles')
--     order by start_time desc limit 10;
--   select * from net._http_response order by created desc limit 10;

-- ---------------------------------------------------------------------------
-- ALTERNATIVE (recommended for production): keep the URL and secret out of the
-- job definition (cron.job is world-readable to the postgres role) via Vault.
--
--   select vault.create_secret('https://litvm-raffle.vercel.app', 'app_url');
--   select vault.create_secret('your-cron-secret', 'cron_secret');
--
--   select cron.schedule(
--     'settle-expired-raffles',
--     '30 seconds',
--     $$
--     select net.http_post(
--       url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
--              || '/api/cron/settle-raffles',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' ||
--           (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
--       ),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 60000
--     );
--     $$
--   );
