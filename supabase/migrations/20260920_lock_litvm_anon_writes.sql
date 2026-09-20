-- Lock down anon access to the LitVM raffle/game write paths.
--
-- Context: the browser used to talk to PostgREST directly with the public anon
-- key, so every write RPC and the permissive INSERT/UPDATE policies below were
-- callable by anyone. Automated traffic used `upsert_litvm_raffle_game_user`
-- to create ~396k junk profiles (Aug-Sep 2026) and could bypass the signature
-- and on-chain-payment checks performed by the /api routes.
--
-- APPLY THIS ONLY AFTER deploying the API-route changes that move every write
-- behind the service-role client (app/api/game-user, app/api/game-session,
-- app/api/game-score). Otherwise the live site cannot create profiles/sessions.
--
-- Run in the Supabase SQL editor.

-- 1. Revoke client execute from all server-only functions; service_role keeps
--    access. Looked up by name so every overload and exact signature is caught.
do $$
declare
  target text;
  fn record;
  fns text[] := array[
    'upsert_litvm_raffle_game_user',
    'litvm_raffle_create_game_session',
    'litvm_raffle_complete_game_session',
    'litvm_raffle_get_active_session',
    'litvm_raffle_update_game_score',
    'litvm_raffle_increment_user_entries',
    'litvm_raffle_increment_user_wins',
    'litvm_raffle_increment_user_entries_bulk',
    'litvm_raffle_get_leaderboard',
    'litvm_raffle_get_admin_stats',
    'litvm_raffle_entry_counts',
    'litvm_raffle_page_meta',
    'litvm_raffle_generate_raffle_slug',
    'litvm_raffle_set_raffle_slug'
  ];
begin
  foreach target in array fns loop
    for fn in
      select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = target
    loop
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        fn.signature
      );
      execute format(
        'grant execute on function %s to service_role',
        fn.signature
      );
    end loop;
  end loop;
end $$;

-- 2. Close direct Data API writes. Reads stay public (leaderboard/profiles are
--    public data by design); the service role bypasses RLS for server writes.
drop policy if exists "Game users are insertable by anyone" on litvm_raffle_game_users;
drop policy if exists "Game users are updatable by anyone" on litvm_raffle_game_users;
drop policy if exists "Server can insert sessions" on litvm_raffle_game_sessions;
drop policy if exists "Server can update sessions" on litvm_raffle_game_sessions;

-- 3. Only well-formed EVM addresses may be stored.
alter table litvm_raffle_game_users
  drop constraint if exists litvm_raffle_game_users_wallet_address_format;
alter table litvm_raffle_game_users
  add constraint litvm_raffle_game_users_wallet_address_format
  check (wallet_address ~ '^0x[a-fA-F0-9]{40}$') not valid;
alter table litvm_raffle_game_users
  validate constraint litvm_raffle_game_users_wallet_address_format;

-- 4. Free-mint reservations: the cap must not come from the caller. The old
--    2-arg version accepted `p_max_spots`, so anyone could reserve unlimited
--    spots for arbitrary wallets.
drop function if exists litvm_raffle_reserve_free_mint_spot(character varying, integer);
create or replace function litvm_raffle_reserve_free_mint_spot(
  p_wallet character varying(42)
)
returns table (success boolean, already_reserved boolean, reserved_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_spots constant integer := 200;
  v_already_reserved boolean := false;
  v_reserved_count integer := 0;
begin
  -- Serialize reservations to enforce the cap safely.
  perform pg_advisory_xact_lock(hashtext('litvm_raffle_free_mint_reserve'));

  insert into litvm_raffle_users (wallet_address)
  values (lower(p_wallet))
  on conflict (wallet_address) do nothing;

  select free_mint_reserved
  into v_already_reserved
  from litvm_raffle_users
  where wallet_address = lower(p_wallet);

  if coalesce(v_already_reserved, false) then
    select count(*)::integer
    into v_reserved_count
    from litvm_raffle_users
    where free_mint_reserved;

    return query select true, true, v_reserved_count;
    return;
  end if;

  select count(*)::integer
  into v_reserved_count
  from litvm_raffle_users
  where free_mint_reserved;

  if v_reserved_count >= v_max_spots then
    return query select false, false, v_reserved_count;
    return;
  end if;

  update litvm_raffle_users
  set free_mint_reserved = true
  where wallet_address = lower(p_wallet)
    and free_mint_reserved = false;

  return query select true, false, v_reserved_count + 1;
end;
$$;

revoke execute on function litvm_raffle_reserve_free_mint_spot(character varying)
  from public, anon, authenticated;
grant execute on function litvm_raffle_reserve_free_mint_spot(character varying)
  to service_role;

-- 5. Verify: these should return false for anon and true for service_role.
-- select
--   has_function_privilege('anon', 'public.upsert_litvm_raffle_game_user(text,text)', 'execute') as anon_can_upsert,
--   has_function_privilege('service_role', 'public.upsert_litvm_raffle_game_user(text,text)', 'execute') as service_can_upsert;
