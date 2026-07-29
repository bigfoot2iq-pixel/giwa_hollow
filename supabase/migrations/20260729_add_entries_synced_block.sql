-- Incremental cursor for chain<->DB entry reconciliation, plus a bulk user-stat
-- increment.
--
-- Two problems this addresses:
--
-- 1. The sync refetched the raffle's whole log history on every run. GIWA's
--    Blockscout caps `getLogs` at 1000 rows and ignores page/offset, so the only
--    way to read past the cap is to walk fromBlock forward. Walking from the
--    contract deploy block every time costs ~11s for a raffle with 10k entries,
--    which overruns the function budget on the public routes. Remembering how far
--    the last run got makes the steady state a single call.
--
-- 2. The sync called litvm_raffle_increment_user_entries once per reconciled
--    wallet, awaited serially. At 10k entrants that is 10k round trips and the
--    invocation dies long before finishing, so user stats silently drifted.

alter table litvm_raffle_raffles
  add column if not exists entries_synced_block bigint;

comment on column litvm_raffle_raffles.entries_synced_block is
  'Highest block whose EntrySubmitted logs have been reconciled into litvm_raffle_entries. Null means never synced; the sync then starts from RAFFLES_DEPLOY_BLOCK. Logs in this exact block are re-read each run and deduped, since a block can straddle the explorer page limit.';

-- Folds a whole reconciliation batch into litvm_raffle_users in one statement.
-- Wallets are aggregated first so a wallet appearing twice in the input still
-- produces a single increment, which ON CONFLICT alone would not guarantee.
create or replace function litvm_raffle_increment_user_entries_bulk(
  p_wallets varchar(42)[],
  p_counts integer[]
)
returns void as $$
begin
  if p_wallets is null or array_length(p_wallets, 1) is null then
    return;
  end if;

  insert into litvm_raffle_users (wallet_address, total_entries)
  select wallet, sum(cnt)::integer
  from unnest(p_wallets, p_counts) as t(wallet, cnt)
  group by wallet
  on conflict (wallet_address)
  do update set
    total_entries = litvm_raffle_users.total_entries + excluded.total_entries,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- Participant counts for a set of raffles, aggregated in the database.
--
-- The routes used to fetch every matching entry row and tally them in JS, which
-- PostgREST silently capped at 1000 rows — a raffle at its 10,000 cap reported
-- 1,000 participants. Counting here is both correct and far less data over the
-- wire, which matters on a per-duration billing plan.
create or replace function litvm_raffle_entry_counts(p_raffle_ids uuid[])
returns table(raffle_id uuid, participants bigint) as $$
  select e.raffle_id, count(*)::bigint
  from litvm_raffle_entries e
  where e.raffle_id = any(p_raffle_ids)
  group by e.raffle_id;
$$ language sql stable security definer;
