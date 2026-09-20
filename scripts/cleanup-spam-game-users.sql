-- Remove junk profiles created through the public upsert RPC (Aug-Sep 2026).
--
-- Keeps: registered users, users with a score, users with a name, and any user
-- referenced by a game session (deleting those would cascade their sessions).
-- Safe to re-run; deletes in batches to avoid one long lock.
--
-- Run in the Supabase SQL editor. Set statement_timeout if needed.

create index if not exists idx_game_users_unregistered_cleanup
  on litvm_raffle_game_users (id)
  where is_registered = false and coalesce(game_score, 0) = 0;

do $$
declare
  deleted integer;
  total integer := 0;
begin
  loop
    with batch as (
      select u.id
      from litvm_raffle_game_users u
      where u.is_registered = false
        and coalesce(u.game_score, 0) = 0
        and nullif(btrim(coalesce(u.username, '')), '') is null
        and not exists (
          select 1
          from litvm_raffle_game_sessions s
          where s.user_id = u.id
        )
      limit 5000
    )
    delete from litvm_raffle_game_users u
    using batch
    where u.id = batch.id;

    get diagnostics deleted = row_count;
    total := total + deleted;
    raise notice 'deleted % rows (total %)', deleted, total;
    exit when deleted = 0;
  end loop;
end $$;

analyze litvm_raffle_game_users;

-- Optional: reclaim disk space. Run separately (VACUUM cannot run inside a
-- transaction, which is how the SQL editor executes scripts):
--   vacuum (analyze) litvm_raffle_game_users;

-- Verify what remains:
-- select count(*) as remaining from litvm_raffle_game_users;
