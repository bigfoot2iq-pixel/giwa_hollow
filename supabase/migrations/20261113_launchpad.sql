-- Migration: 20261113_launchpad.sql
-- Adds the NFT launchpad request inbox and its config defaults.
--
-- Run in the Supabase SQL editor after deploying the API routes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Launchpad collection requests ────────────────────────────────────
CREATE TABLE IF NOT EXISTS litvm_launchpad_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_name VARCHAR(120) NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  description TEXT NOT NULL,
  chain VARCHAR(32) NOT NULL DEFAULT 'giwa-sepolia',
  supply INTEGER NOT NULL CHECK (supply > 0),
  mint_price VARCHAR(78) NOT NULL,
  launch_date TIMESTAMPTZ NOT NULL,
  creator_wallet VARCHAR(42),
  contact_email VARCHAR(320),
  contact_x VARCHAR(100),
  website_url TEXT,
  x_url TEXT,
  discord_url TEXT,
  artwork_url TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'launched')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT litvm_launchpad_requests_contact
    CHECK (contact_email IS NOT NULL OR contact_x IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS litvm_launchpad_requests_status_created_idx
  ON litvm_launchpad_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS litvm_launchpad_requests_wallet_idx
  ON litvm_launchpad_requests (lower(creator_wallet));

-- Requests are only written/read by server routes using the service role.
ALTER TABLE litvm_launchpad_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE litvm_launchpad_requests FROM anon, authenticated;
GRANT ALL ON TABLE litvm_launchpad_requests TO service_role;

-- ─── Config defaults ──────────────────────────────────────────────────
-- Holder gate defaults: 0.001 ETH on Ethereum/Base/Ink and 0.003 BNB on
-- BNB Chain. The chain and native currency are fixed; admins edit only the
-- minimum amount (or disable a chain) from /admin/launchpad.
INSERT INTO litvm_raffle_config (key, value)
VALUES (
  'launchpad_holder_requirements',
  '[{"chain":"ethereum","minAmount":"0.001"},{"chain":"base","minAmount":"0.001"},{"chain":"ink","minAmount":"0.001"},{"chain":"bnb","minAmount":"0.003"}]'
)
ON CONFLICT (key) DO NOTHING;

-- Raffles page starts in maintenance mode; the admin dashboard can toggle it.
INSERT INTO litvm_raffle_config (key, value)
VALUES ('raffles_maintenance', 'true')
ON CONFLICT (key) DO NOTHING;
