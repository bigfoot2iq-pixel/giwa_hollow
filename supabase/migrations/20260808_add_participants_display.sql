-- Display-count override for raffles whose entry rows were pruned.
--
-- WHY: the ARIWA launch raffle drew ~10k distinct wallets, each a row in
-- litvm_raffle_entries. On the Supabase hobby tier that volume (and the egress
-- from bots re-reading it) was untenable, so the rows were deleted. But the card
-- "Joined" count and the detail "Participants" stat are both derived by counting
-- those rows, so deletion made every count collapse to 0.
--
-- These columns let a raffle carry a *display* joiner/entry total that is
-- independent of how many entry rows physically remain. Null = fall back to the
-- real row count (the existing behaviour), so every other raffle is unaffected.
-- Read-only: settlement/endRaffle still builds its participant array from the
-- actual entry rows, never from these.

alter table litvm_raffle_raffles
  add column if not exists participants_display integer,
  add column if not exists entries_display integer;

comment on column litvm_raffle_raffles.participants_display is
  'Overrides the displayed joiner count when set. Null = count entry rows. Display only.';
comment on column litvm_raffle_raffles.entries_display is
  'Overrides the displayed total-entries count when set. Null = sum entry rows. Display only.';

-- Fold the override into the cards RPC so GET /api/raffles keeps its single
-- round trip. coalesce order: explicit override, else counted rows, else 0.
create or replace function litvm_raffle_page_meta(p_raffle_ids uuid[])
returns table(raffle_id uuid, participants bigint, prizes jsonb) as $$
  select
    ids.id as raffle_id,
    coalesce(r.participants_display, entry_counts.participants, 0)::bigint as participants,
    coalesce(prize_rows.prizes, '[]'::jsonb) as prizes
  from unnest(p_raffle_ids) as ids(id)
  left join litvm_raffle_raffles r on r.id = ids.id
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
