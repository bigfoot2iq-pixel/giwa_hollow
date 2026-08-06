-- Fix raffle slug collisions that stranded escrowed prizes.
-- Run this in Supabase SQL Editor.
--
-- Background: the admin create flow escrows the prize on-chain, then writes the
-- raffle row. That row write used to leave `slug` unset, so this trigger derived
-- it from the title alone (e.g. "Ariwa" -> "ariwa"). A second raffle with the same
-- title hit the litvm_raffle_raffles_slug_key UNIQUE constraint AFTER the prize was
-- already locked in the contract -> "failed to create raffle, your prize is
-- escrowed on chain".
--
-- The app now always supplies a slug of the form `<title>-<chain_raffle_id>`, which
-- is globally unique because chain_raffle_id is UNIQUE. Two problems remained here:
--   1. The ELSE branch stripped the hyphen ([^a-zA-Z0-9\s] removes '-'), turning
--      "ariwa-8" into "ariwa8" and losing the clean separator.
--   2. The auto-generate fallback still produced a title-only slug, so any future
--      row inserted without an explicit slug could collide again.
-- This migration preserves hyphens in a provided slug and makes the fallback append
-- a unique suffix.

-- Slug from title: lowercase, non-alphanumeric runs -> single hyphen, trimmed.
CREATE OR REPLACE FUNCTION litvm_raffle_generate_raffle_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(
    both '-' FROM
    lower(regexp_replace(coalesce(title, ''), '[^a-zA-Z0-9]+', '-', 'g'))
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION litvm_raffle_set_raffle_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    -- No slug supplied: derive one and guarantee uniqueness with the on-chain id
    -- when we have it, otherwise the row's uuid.
    NEW.slug = litvm_raffle_generate_raffle_slug(COALESCE(NEW.title, NEW.id::TEXT))
      || '-' || COALESCE(NEW.chain_raffle_id::TEXT, NEW.id::TEXT);
  ELSE
    -- Normalize a provided slug WITHOUT dropping hyphens, so "ariwa-8" survives.
    NEW.slug = trim(
      both '-' FROM
      lower(regexp_replace(NEW.slug, '[^a-zA-Z0-9-]+', '-', 'g'))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS litvm_raffle_trigger_set_raffle_slug ON litvm_raffle_raffles;
CREATE TRIGGER litvm_raffle_trigger_set_raffle_slug
  BEFORE INSERT ON litvm_raffle_raffles
  FOR EACH ROW
  EXECUTE FUNCTION litvm_raffle_set_raffle_slug();
