-- Add slug column to raffles table for URL-friendly access
-- Run this in Supabase SQL Editor

-- Add slug column (nullable first to allow existing data to be migrated)
ALTER TABLE litvm_raffle_raffles ADD COLUMN slug VARCHAR(255) UNIQUE;

-- Create a function to generate slug from title
CREATE OR REPLACE FUNCTION litvm_raffle_generate_raffle_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Convert to lowercase, replace spaces with underscores, remove special characters
  RETURN lower(
    regexp_replace(
      regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+',
      '_',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing raffles with generated slugs
UPDATE litvm_raffle_raffles
SET slug = litvm_raffle_generate_raffle_slug(title)
WHERE slug IS NULL;

-- Make slug NOT NULL after populating existing data
ALTER TABLE litvm_raffle_raffles ALTER COLUMN slug SET NOT NULL;

-- Create index for slug lookups
CREATE INDEX idx_litvm_raffle_raffles_slug ON litvm_raffle_raffles(slug);

-- Create a trigger to auto-generate slug on insert if not provided
CREATE OR REPLACE FUNCTION litvm_raffle_set_raffle_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = litvm_raffle_generate_raffle_slug(COALESCE(NEW.title, NEW.id::TEXT));
  ELSE
    -- Ensure provided slug is properly formatted
    NEW.slug = lower(
      regexp_replace(
        regexp_replace(NEW.slug, '[^a-zA-Z0-9\s]', '', 'g'),
        '\s+',
        '_',
        'g'
      )
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