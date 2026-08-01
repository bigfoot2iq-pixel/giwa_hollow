-- Collapse the per-page fan-out on GET /api/raffles into a single round trip.
--
-- WHY: the route made three separate PostgREST calls per invocation — the raffle
-- rows, then the prizes for the visible page, then litvm_raffle_entry_counts.
-- A PostgREST response costs ~1.2 KB in headers regardless of body size, so on
-- the app's highest-traffic route the round-trip count is what drives Supabase
-- egress, not the amount of data. Merging prizes and counts takes the route from
-- three calls to two.
--
-- The raffle rows still have to be fetched separately: scope filtering keys off
-- the on-chain creator, which is not a DB column, so the page slice is not known
-- until after that first read returns.
--
-- Supersedes litvm_raffle_entry_counts (20260729_add_entries_synced_block.sql),
-- which is left in place because dropping it would break any deployment still
-- serving the previous revision during a rollout.

create or replace function litvm_raffle_page_meta(p_raffle_ids uuid[])
returns table(raffle_id uuid, participants bigint, prizes jsonb) as $$
  -- Driven off unnest so a raffle with neither entries nor prizes still comes
  -- back with zero/[] rather than being absent from the result.
  select
    ids.id as raffle_id,
    coalesce(entry_counts.participants, 0)::bigint as participants,
    coalesce(prize_rows.prizes, '[]'::jsonb) as prizes
  from unnest(p_raffle_ids) as ids(id)
  left join (
    select e.raffle_id as rid, count(*)::bigint as participants
    from litvm_raffle_entries e
    where e.raffle_id = any(p_raffle_ids)
    group by e.raffle_id
  ) entry_counts on entry_counts.rid = ids.id
  left join (
    select
      pr.raffle_id as rid,
      jsonb_agg(
        jsonb_build_object(
          'prize_type', pr.prize_type,
          'prize_token_address', pr.prize_token_address,
          'prize_amount', pr.prize_amount,
          'prize_token_id', pr.prize_token_id
        ) order by pr.created_at
      ) as prizes
    from litvm_raffle_prizes pr
    where pr.raffle_id = any(p_raffle_ids)
    group by pr.raffle_id
  ) prize_rows on prize_rows.rid = ids.id;
$$ language sql stable security definer;
