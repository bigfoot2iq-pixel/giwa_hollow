-- Add free mint reservation flag for first-come reserve flow
ALTER TABLE litvm_raffle_users
  ADD COLUMN IF NOT EXISTS free_mint_reserved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_litvm_raffle_users_free_mint_reserved
  ON litvm_raffle_users(free_mint_reserved)
  WHERE free_mint_reserved = TRUE;

-- Reserve a free mint spot atomically with a hard cap.
CREATE OR REPLACE FUNCTION litvm_raffle_reserve_free_mint_spot(
  p_wallet VARCHAR(42),
  p_max_spots INTEGER DEFAULT 200
)
RETURNS TABLE (
  success BOOLEAN,
  already_reserved BOOLEAN,
  reserved_count INTEGER
) AS $$
DECLARE
  v_already_reserved BOOLEAN := FALSE;
  v_reserved_count INTEGER := 0;
BEGIN
  -- Serialize reservations to enforce the cap safely.
  PERFORM pg_advisory_xact_lock(hashtext('litvm_raffle_free_mint_reserve'));

  INSERT INTO litvm_raffle_users (wallet_address)
  VALUES (LOWER(p_wallet))
  ON CONFLICT (wallet_address) DO NOTHING;

  SELECT free_mint_reserved
  INTO v_already_reserved
  FROM litvm_raffle_users
  WHERE wallet_address = LOWER(p_wallet);

  IF COALESCE(v_already_reserved, FALSE) THEN
    SELECT COUNT(*)::INTEGER
    INTO v_reserved_count
    FROM litvm_raffle_users
    WHERE free_mint_reserved = TRUE;

    RETURN QUERY SELECT TRUE, TRUE, v_reserved_count;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_reserved_count
  FROM litvm_raffle_users
  WHERE free_mint_reserved = TRUE;

  IF v_reserved_count >= p_max_spots THEN
    RETURN QUERY SELECT FALSE, FALSE, v_reserved_count;
    RETURN;
  END IF;

  UPDATE litvm_raffle_users
  SET free_mint_reserved = TRUE
  WHERE wallet_address = LOWER(p_wallet)
    AND free_mint_reserved = FALSE;

  RETURN QUERY SELECT TRUE, FALSE, v_reserved_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
