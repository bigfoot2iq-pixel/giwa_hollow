-- Base table for the game/leaderboard user profiles.
-- This MUST run before 20241223_add_game_score.sql (which adds game_score)
-- and 20241226_add_game_sessions.sql (which references this table).
--
-- Separate from litvm_raffle_users (the raffle/waitlist table): the game ports
-- its own profile table from the-hollow project.

CREATE TABLE IF NOT EXISTS litvm_raffle_game_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  wallet_type TEXT NOT NULL DEFAULT 'evm',
  username TEXT,
  is_registered BOOLEAN NOT NULL DEFAULT FALSE,
  is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE,
  x_username TEXT,
  x_avatar_url TEXT,
  x_user_id TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on direct UPDATEs (reuses the function from 001).
DROP TRIGGER IF EXISTS litvm_raffle_update_game_users_updated_at ON litvm_raffle_game_users;
CREATE TRIGGER litvm_raffle_update_game_users_updated_at
  BEFORE UPDATE ON litvm_raffle_game_users
  FOR EACH ROW EXECUTE FUNCTION litvm_raffle_update_updated_at_column();

-- Row Level Security. Client uses the anon key, so permissive policies are
-- required for reads/writes (mirrors litvm_raffle_game_sessions).
ALTER TABLE litvm_raffle_game_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game users are viewable by everyone" ON litvm_raffle_game_users;
CREATE POLICY "Game users are viewable by everyone"
  ON litvm_raffle_game_users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Game users are insertable by anyone" ON litvm_raffle_game_users;
CREATE POLICY "Game users are insertable by anyone"
  ON litvm_raffle_game_users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Game users are updatable by anyone" ON litvm_raffle_game_users;
CREATE POLICY "Game users are updatable by anyone"
  ON litvm_raffle_game_users FOR UPDATE
  USING (true);

-- Upsert on wallet connection. SECURITY DEFINER so the insert path works
-- regardless of RLS. Arg names (wallet, wallet_type) match the supabase.rpc call.
CREATE OR REPLACE FUNCTION upsert_litvm_raffle_game_user(
  wallet TEXT,
  wallet_type TEXT DEFAULT 'evm'
)
RETURNS litvm_raffle_game_users AS $$
DECLARE
  result litvm_raffle_game_users;
BEGIN
  INSERT INTO litvm_raffle_game_users (wallet_address, wallet_type)
  VALUES (wallet, wallet_type)
  ON CONFLICT (wallet_address)
  DO UPDATE SET updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
