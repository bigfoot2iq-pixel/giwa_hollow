-- Additional database functions for the Katana Raffles platform
-- Run this after 001_initial_schema.sql

-- Function to increment user entries
CREATE OR REPLACE FUNCTION litvm_raffle_increment_user_entries(p_wallet VARCHAR(42), p_count INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO litvm_raffle_users (wallet_address, total_entries)
  VALUES (p_wallet, p_count)
  ON CONFLICT (wallet_address)
  DO UPDATE SET total_entries = litvm_raffle_users.total_entries + p_count, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user wins
CREATE OR REPLACE FUNCTION litvm_raffle_increment_user_wins(p_wallet VARCHAR(42))
RETURNS VOID AS $$
BEGIN
  INSERT INTO litvm_raffle_users (wallet_address, total_wins)
  VALUES (p_wallet, 1)
  ON CONFLICT (wallet_address)
  DO UPDATE SET total_wins = litvm_raffle_users.total_wins + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin stats
CREATE OR REPLACE FUNCTION litvm_raffle_get_admin_stats()
RETURNS TABLE(
  total_raffles BIGINT,
  active_raffles BIGINT,
  total_entries BIGINT,
  total_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM litvm_raffle_raffles)::BIGINT AS total_raffles,
    (SELECT COUNT(*) FROM litvm_raffle_raffles WHERE status = 'active')::BIGINT AS active_raffles,
    (SELECT COALESCE(SUM(entry_count), 0) FROM litvm_raffle_entries)::BIGINT AS total_entries,
    (SELECT COUNT(*) FROM litvm_raffle_users)::BIGINT AS total_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
