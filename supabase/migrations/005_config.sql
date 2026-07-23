-- Migration: 005_config.sql
-- Creates config table for storing site configuration values

CREATE TABLE IF NOT EXISTS litvm_raffle_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default waitlist participants count
INSERT INTO litvm_raffle_config (key, value)
VALUES ('waitlist_participants', '12847')
ON CONFLICT (key) DO NOTHING;
