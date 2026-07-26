-- Durable throttle for chain<->DB entry reconciliation.
--
-- Anyone can call joinRaffle directly on the contract, which emits EntrySubmitted
-- but never writes litvm_raffle_entries (only POST /api/entries does). The sync in
-- lib/raffles/sync-entries.ts replays those logs to close the gap.
--
-- The throttle was in-memory, which does not survive serverless: on Vercel each
-- lambda instance keeps its own Map, so a cold start or a second concurrent
-- instance re-fetches immediately. Persisting the timestamp makes the rate limit
-- global and durable across instances, cold starts, and redeploys.

alter table litvm_raffle_raffles
  add column if not exists entries_synced_at timestamptz;

-- Sync only ever targets deployed raffles, and it skips ones already settled far
-- in the past, so the lookup is always "deployed AND stale".
create index if not exists litvm_raffle_raffles_entries_synced_at_idx
  on litvm_raffle_raffles (entries_synced_at)
  where chain_raffle_id is not null;

comment on column litvm_raffle_raffles.entries_synced_at is
  'Last time EntrySubmitted logs were reconciled into litvm_raffle_entries. Throttles the sync; null means never synced.';
