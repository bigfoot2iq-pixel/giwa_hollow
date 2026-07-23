-- LitVM Raffles Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE litvm_raffle_prize_type AS ENUM ('erc20', 'erc721', 'erc6220');
CREATE TYPE litvm_raffle_raffle_status AS ENUM ('pending', 'active', 'ended', 'cancelled', 'distributed');
CREATE TYPE litvm_raffle_transaction_type AS ENUM ('token_purchase', 'raffle_entry', 'prize_distribution');

-- Raffles table
CREATE TABLE litvm_raffle_raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_raffle_id INTEGER UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  tokens_required INTEGER NOT NULL CHECK (tokens_required > 0),
  max_tokens_per_user INTEGER NOT NULL CHECK (max_tokens_per_user > 0),
  max_participants INTEGER NOT NULL CHECK (max_participants > 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  prize_type litvm_raffle_prize_type NOT NULL,
  prize_token_address VARCHAR(42) NOT NULL,
  prize_amount VARCHAR(78), -- For ERC20 (up to uint256)
  prize_token_id VARCHAR(78), -- For NFTs
  number_of_winners INTEGER NOT NULL CHECK (number_of_winners > 0),
  status litvm_raffle_raffle_status NOT NULL DEFAULT 'pending',
  current_participants INTEGER NOT NULL DEFAULT 0,
  tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT litvm_raffle_valid_dates CHECK (end_date > start_date),
  CONSTRAINT litvm_raffle_valid_prize CHECK (
    (prize_type = 'erc20' AND prize_amount IS NOT NULL) OR
    (prize_type IN ('erc721', 'erc6220') AND prize_token_id IS NOT NULL)
  )
);

-- Users table
CREATE TABLE litvm_raffle_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  total_entries INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entries table
CREATE TABLE litvm_raffle_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES litvm_raffle_raffles(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  tokens_spent INTEGER NOT NULL CHECK (tokens_spent > 0),
  entry_count INTEGER NOT NULL CHECK (entry_count > 0),
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT litvm_raffle_unique_entry_per_raffle_per_wallet UNIQUE (raffle_id, wallet_address)
);

-- Winners table
CREATE TABLE litvm_raffle_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES litvm_raffle_raffles(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  prize_amount VARCHAR(78),
  prize_token_id VARCHAR(78),
  distribution_tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE litvm_raffle_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  type litvm_raffle_transaction_type NOT NULL,
  amount VARCHAR(78) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  raffle_id UUID REFERENCES litvm_raffle_raffles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin logs table
CREATE TABLE litvm_raffle_admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_wallet VARCHAR(42) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_litvm_raffle_raffles_status ON litvm_raffle_raffles(status);
CREATE INDEX idx_litvm_raffle_raffles_dates ON litvm_raffle_raffles(start_date, end_date);
CREATE INDEX idx_litvm_raffle_raffles_status_dates ON litvm_raffle_raffles(status, start_date, end_date);
CREATE INDEX idx_litvm_raffle_entries_raffle ON litvm_raffle_entries(raffle_id);
CREATE INDEX idx_litvm_raffle_entries_wallet ON litvm_raffle_entries(wallet_address);
CREATE INDEX idx_litvm_raffle_winners_raffle ON litvm_raffle_winners(raffle_id);
CREATE INDEX idx_litvm_raffle_winners_wallet ON litvm_raffle_winners(wallet_address);
CREATE INDEX idx_litvm_raffle_transactions_wallet ON litvm_raffle_transactions(wallet_address);
CREATE INDEX idx_litvm_raffle_transactions_type ON litvm_raffle_transactions(type);
CREATE INDEX idx_litvm_raffle_users_wallet ON litvm_raffle_users(wallet_address);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION litvm_raffle_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger
CREATE TRIGGER litvm_raffle_update_raffles_updated_at
  BEFORE UPDATE ON litvm_raffle_raffles
  FOR EACH ROW EXECUTE FUNCTION litvm_raffle_update_updated_at_column();

CREATE TRIGGER litvm_raffle_update_users_updated_at
  BEFORE UPDATE ON litvm_raffle_users
  FOR EACH ROW EXECUTE FUNCTION litvm_raffle_update_updated_at_column();

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE litvm_raffle_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE litvm_raffle_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE litvm_raffle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE litvm_raffle_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE litvm_raffle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE litvm_raffle_admin_logs ENABLE ROW LEVEL SECURITY;

-- Raffles: readable by all, writable by service role only
CREATE POLICY "Raffles are viewable by everyone" ON litvm_raffle_raffles
  FOR SELECT USING (true);

CREATE POLICY "Raffles are insertable by service role" ON litvm_raffle_raffles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Raffles are updatable by service role" ON litvm_raffle_raffles
  FOR UPDATE USING (auth.role() = 'service_role');

-- Users: users can read their own data
CREATE POLICY "Users can view their own profile" ON litvm_raffle_users
  FOR SELECT USING (true);

CREATE POLICY "Users are insertable by service role" ON litvm_raffle_users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users are updatable by service role" ON litvm_raffle_users
  FOR UPDATE USING (auth.role() = 'service_role');

-- Entries: readable by all (for transparency), writable by service role
CREATE POLICY "Entries are viewable by everyone" ON litvm_raffle_entries
  FOR SELECT USING (true);

CREATE POLICY "Entries are insertable by service role" ON litvm_raffle_entries
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Winners: readable by all (for transparency)
CREATE POLICY "Winners are viewable by everyone" ON litvm_raffle_winners
  FOR SELECT USING (true);

CREATE POLICY "Winners are insertable by service role" ON litvm_raffle_winners
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Winners are updatable by service role" ON litvm_raffle_winners
  FOR UPDATE USING (auth.role() = 'service_role');

-- Transactions: readable by all for transparency
CREATE POLICY "Transactions are viewable by everyone" ON litvm_raffle_transactions
  FOR SELECT USING (true);

CREATE POLICY "Transactions are insertable by service role" ON litvm_raffle_transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admin logs: only service role can access
CREATE POLICY "Admin logs are viewable by service role" ON litvm_raffle_admin_logs
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Admin logs are insertable by service role" ON litvm_raffle_admin_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
