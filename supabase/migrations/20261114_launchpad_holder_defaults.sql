-- Migration: 20261114_launchpad_holder_defaults.sql
-- Applies the default launchpad holder minimums to databases that already ran
-- 20261113_launchpad.sql and therefore still have the old empty default.
--
-- Defaults:
--   Ethereum  0.001 ETH
--   Base      0.001 ETH
--   Ink       0.001 ETH
--   BNB Chain 0.003 BNB
--
-- This is a one-time upgrade for the empty default created by the previous
-- migration. Any non-empty holder gate saved by an admin is left untouched;
-- after this migration, saving an empty list still disables the gate.

UPDATE litvm_raffle_config
SET value = '[{"chain":"ethereum","minAmount":"0.001"},{"chain":"base","minAmount":"0.001"},{"chain":"ink","minAmount":"0.001"},{"chain":"bnb","minAmount":"0.003"}]',
    updated_at = NOW()
WHERE key = 'launchpad_holder_requirements'
  AND value = '[]';
