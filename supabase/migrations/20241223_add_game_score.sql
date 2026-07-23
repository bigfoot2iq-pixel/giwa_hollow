-- Add game_score column to litvm_raffle_game_users table
ALTER TABLE litvm_raffle_game_users 
ADD COLUMN IF NOT EXISTS game_score INTEGER DEFAULT 0;

-- Add index for leaderboard queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_litvm_raffle_game_users_game_score ON litvm_raffle_game_users(game_score DESC);

-- Create function to update game score (only if score is higher)
CREATE OR REPLACE FUNCTION litvm_raffle_update_game_score(
  user_wallet TEXT,
  new_score INTEGER
)
RETURNS JSON AS $$
DECLARE
  current_score INTEGER;
  updated BOOLEAN := false;
  user_rank INTEGER;
  user_record litvm_raffle_game_users;
BEGIN
  -- Get current user and score
  SELECT * INTO user_record 
  FROM litvm_raffle_game_users 
  WHERE wallet_address = user_wallet;
  
  -- If user doesn't exist, return error
  IF user_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'updated', false,
      'current_score', 0,
      'rank', null,
      'message', 'User not found'
    );
  END IF;
  
  current_score := COALESCE(user_record.game_score, 0);
  
  -- Only update if new score is higher
  IF new_score > current_score THEN
    UPDATE litvm_raffle_game_users 
    SET game_score = new_score, updated_at = NOW()
    WHERE wallet_address = user_wallet;
    updated := true;
    current_score := new_score;
  END IF;
  
  -- Get user's current rank
  SELECT COUNT(*) + 1 INTO user_rank
  FROM litvm_raffle_game_users 
  WHERE game_score > current_score;
  
  RETURN json_build_object(
    'success', true,
    'updated', updated,
    'current_score', current_score,
    'rank', user_rank,
    'message', CASE 
      WHEN updated THEN 'New high score achieved!'
      ELSE 'Score not updated - current score is higher'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to get leaderboard with pagination
CREATE OR REPLACE FUNCTION litvm_raffle_get_leaderboard(
  limit_count INTEGER DEFAULT 10,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  username TEXT,
  image_url TEXT,
  x_avatar_url TEXT,
  game_score INTEGER,
  is_registered BOOLEAN,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY u.game_score DESC, u.updated_at ASC) as user_rank,
      u.wallet_address,
      u.username,
      u.image_url,
      u.x_avatar_url,
      u.game_score,
      u.is_registered,
      COUNT(*) OVER() as total_users
    FROM litvm_raffle_game_users u
    WHERE u.game_score > 0
    ORDER BY u.game_score DESC, u.updated_at ASC
  )
  SELECT 
    ru.user_rank,
    ru.wallet_address,
    ru.username,
    ru.image_url,
    ru.x_avatar_url,
    ru.game_score,
    ru.is_registered,
    ru.total_users
  FROM ranked_users ru
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to allow reading game scores
-- (CREATE POLICY has no IF NOT EXISTS; drop-then-create is the idempotent form)
DROP POLICY IF EXISTS "Anyone can read game scores" ON litvm_raffle_game_users;
CREATE POLICY "Anyone can read game scores"
  ON litvm_raffle_game_users FOR SELECT
  USING (true);