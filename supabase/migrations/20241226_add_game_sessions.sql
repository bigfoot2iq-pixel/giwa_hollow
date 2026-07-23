-- Create litvm_raffle_game_sessions table for pay-to-play tracking
CREATE TABLE IF NOT EXISTS litvm_raffle_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES litvm_raffle_game_users(id) ON DELETE CASCADE,
  tx_hash TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  final_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_litvm_raffle_game_sessions_user_id ON litvm_raffle_game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_litvm_raffle_game_sessions_status ON litvm_raffle_game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_litvm_raffle_game_sessions_tx_hash ON litvm_raffle_game_sessions(tx_hash);

-- Enable RLS
ALTER TABLE litvm_raffle_game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own sessions" 
  ON litvm_raffle_game_sessions FOR SELECT 
  USING (true);

CREATE POLICY "Server can insert sessions" 
  ON litvm_raffle_game_sessions FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Server can update sessions" 
  ON litvm_raffle_game_sessions FOR UPDATE 
  USING (true);

-- Function to create a new game session after payment verification
CREATE OR REPLACE FUNCTION litvm_raffle_create_game_session(
  user_wallet TEXT,
  payment_tx_hash TEXT
)
RETURNS JSON AS $$
DECLARE
  user_record litvm_raffle_game_users;
  session_record litvm_raffle_game_sessions;
  existing_active_session litvm_raffle_game_sessions;
BEGIN
  -- Get user by wallet
  SELECT * INTO user_record 
  FROM litvm_raffle_game_users 
  WHERE wallet_address = user_wallet;
  
  IF user_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check if tx_hash already used
  IF EXISTS (SELECT 1 FROM litvm_raffle_game_sessions WHERE tx_hash = payment_tx_hash) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Transaction already used'
    );
  END IF;

  -- Expire any old active sessions for this user (cleanup)
  UPDATE litvm_raffle_game_sessions 
  SET status = 'expired', completed_at = NOW()
  WHERE user_id = user_record.id 
    AND status = 'active' 
    AND expires_at < NOW();

  -- Check for existing active session
  SELECT * INTO existing_active_session
  FROM litvm_raffle_game_sessions
  WHERE user_id = user_record.id 
    AND status = 'active'
    AND expires_at > NOW()
  LIMIT 1;

  IF existing_active_session.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Active session already exists',
      'session_id', existing_active_session.id
    );
  END IF;

  -- Create new session
  INSERT INTO litvm_raffle_game_sessions (user_id, tx_hash)
  VALUES (user_record.id, payment_tx_hash)
  RETURNING * INTO session_record;

  RETURN json_build_object(
    'success', true,
    'session_id', session_record.id,
    'expires_at', session_record.expires_at
  );
END;
$$ LANGUAGE plpgsql;


-- Function to complete game session AND update high score atomically
CREATE OR REPLACE FUNCTION litvm_raffle_complete_game_session(
  p_session_id UUID,
  p_user_wallet TEXT,
  p_final_score INTEGER
)
RETURNS JSON AS $$
DECLARE
  session_record litvm_raffle_game_sessions;
  user_record litvm_raffle_game_users;
  current_high_score INTEGER;
  score_updated BOOLEAN := false;
  user_rank INTEGER;
BEGIN
  -- Get user
  SELECT * INTO user_record 
  FROM litvm_raffle_game_users 
  WHERE wallet_address = p_user_wallet;
  
  IF user_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Get and validate session
  SELECT * INTO session_record
  FROM litvm_raffle_game_sessions
  WHERE id = p_session_id 
    AND user_id = user_record.id;

  IF session_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session not found or does not belong to user'
    );
  END IF;

  IF session_record.status != 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Session is not active',
      'status', session_record.status
    );
  END IF;

  IF session_record.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE litvm_raffle_game_sessions 
    SET status = 'expired', completed_at = NOW()
    WHERE id = p_session_id;
    
    RETURN json_build_object(
      'success', false,
      'error', 'Session has expired'
    );
  END IF;

  -- Complete the session
  UPDATE litvm_raffle_game_sessions 
  SET 
    status = 'completed',
    final_score = p_final_score,
    completed_at = NOW()
  WHERE id = p_session_id;

  -- Update high score if new score is higher
  current_high_score := COALESCE(user_record.game_score, 0);
  
  IF p_final_score > current_high_score THEN
    UPDATE litvm_raffle_game_users 
    SET game_score = p_final_score, updated_at = NOW()
    WHERE id = user_record.id;
    
    score_updated := true;
    current_high_score := p_final_score;
  END IF;

  -- Get user's current rank
  SELECT COUNT(*) + 1 INTO user_rank
  FROM litvm_raffle_game_users 
  WHERE game_score > current_high_score;

  RETURN json_build_object(
    'success', true,
    'session_completed', true,
    'score_updated', score_updated,
    'final_score', p_final_score,
    'high_score', current_high_score,
    'rank', user_rank,
    'message', CASE 
      WHEN score_updated THEN 'New high score achieved!'
      ELSE 'Session completed. Score not updated - current high score is higher.'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check for active session
CREATE OR REPLACE FUNCTION litvm_raffle_get_active_session(
  p_user_wallet TEXT
)
RETURNS JSON AS $$
DECLARE
  user_record litvm_raffle_game_users;
  session_record litvm_raffle_game_sessions;
BEGIN
  -- Get user
  SELECT * INTO user_record 
  FROM litvm_raffle_game_users 
  WHERE wallet_address = p_user_wallet;
  
  IF user_record.id IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'has_active_session', false,
      'reason', 'User not found'
    );
  END IF;

  -- Expire old sessions first
  UPDATE litvm_raffle_game_sessions 
  SET status = 'expired', completed_at = NOW()
  WHERE user_id = user_record.id 
    AND status = 'active' 
    AND expires_at < NOW();

  -- Check for active session
  SELECT * INTO session_record
  FROM litvm_raffle_game_sessions
  WHERE user_id = user_record.id 
    AND status = 'active'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF session_record.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'has_active_session', true,
      'session_id', session_record.id,
      'expires_at', session_record.expires_at,
      'created_at', session_record.created_at
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'has_active_session', false
  );
END;
$$ LANGUAGE plpgsql;
