-- Reschedule the raffle settlement cron from every 30 seconds to every 30 minutes.
--
-- WHY: at '30 seconds' this job POSTs 2x/minute forever -- ~86,400 invocations a
-- month with zero users -- into the most expensive route in the app
-- (/api/cron/settle-raffles: maxDuration 60, on-chain reads plus settlement
-- transactions). That alone was enough to exhaust the Vercel free tier's 4h
-- Fluid Active CPU allowance and get the project paused. At '*/30' it is ~1,440
-- invocations a month, a 60x reduction.
--
-- WHAT THIS COSTS: the job does two things.
--   * Ending raffles past end_date -- latency here is invisible; the draw simply
--     happens up to 30 minutes after the advertised close.
--   * Activating raffles whose start_date has passed -- this one IS user-facing.
--     RaffleEntryForm requires the on-chain state to be ACTIVE before it will
--     let anyone enter, so between a raffle's start time and the next cron run
--     it reads as open but rejects entries. Activate new raffles from the admin
--     UI at launch rather than waiting for the cron, or schedule start_date
--     30 minutes earlier than the time you advertise.
--
-- Batch size is unchanged (SETTLE_BATCH_SIZE, default 20 raffles per run), which
-- at 48 runs/day is far more headroom than this platform needs.
--
-- Replace <CRON_SECRET> with the value of the CRON_SECRET env var set in Vercel
-- before running. Do NOT commit the real secret: cron.job is readable by the
-- postgres role and this file is tracked in git. Paste the filled statement into
-- the Supabase SQL editor, or use the Vault variant at the bottom.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop the existing job (whatever its current schedule) first.
select cron.unschedule('settle-expired-raffles')
where exists (select 1 from cron.job where jobname = 'settle-expired-raffles');

select cron.schedule(
  'settle-expired-raffles',
  '*/30 * * * *',
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

-- Verify the new schedule and watch the next few runs:
--   select jobname, schedule, active from cron.job
--     where jobname = 'settle-expired-raffles';
--   select status, start_time, end_time from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'settle-expired-raffles')
--     order by start_time desc limit 10;

-- ---------------------------------------------------------------------------
-- ALTERNATIVE (recommended for production): keep the URL and secret out of the
-- job definition via Vault.
--
--   select vault.create_secret('https://litvm-raffle.vercel.app', 'app_url');
--   select vault.create_secret('your-cron-secret', 'cron_secret');
--
--   select cron.schedule(
--     'settle-expired-raffles',
--     '*/30 * * * *',
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
