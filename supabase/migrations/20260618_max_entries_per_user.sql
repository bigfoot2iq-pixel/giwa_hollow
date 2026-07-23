-- Cap raffle participation per wallet by ENTRY COUNT, not raw token spend.
-- Entry cost is already fixed by tokens_required, so a per-user entry cap is the
-- meaningful limit. The old token cap could be set below tokens_required, making a
-- raffle unenterable (maxEntries floored to 0 in the UI).

alter table litvm_raffle_raffles
  rename column max_tokens_per_user to max_entries_per_user;

-- Convert existing token caps to entry caps (floor; min 1 so no raffle is unenterable).
update litvm_raffle_raffles
  set max_entries_per_user = greatest(
    1,
    floor(max_entries_per_user::numeric / nullif(tokens_required, 0))::int
  );
