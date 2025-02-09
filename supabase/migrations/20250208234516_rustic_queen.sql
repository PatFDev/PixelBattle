/*
  # Add available pixels tracking

  1. Changes
    - Add available_pixels column to user_stats table
    - Update trigger to handle available pixels

  2. Security
    - Inherits existing RLS policies
*/

-- Add available_pixels column to user_stats
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS available_pixels integer DEFAULT 0;

-- Update the deposit trigger to add available pixels
CREATE OR REPLACE FUNCTION update_user_stats_on_deposit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (wallet, total_deposited, available_pixels, last_active)
  VALUES (
    NEW.wallet, 
    NEW.amount, 
    FLOOR(NEW.amount / 0.0001)::integer,  -- Calculate pixels from deposit amount
    now()
  )
  ON CONFLICT (wallet) DO UPDATE
  SET 
    total_deposited = user_stats.total_deposited + NEW.amount,
    available_pixels = user_stats.available_pixels + FLOOR(NEW.amount / 0.0001)::integer,
    last_active = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the pixel paint trigger to decrease available pixels
CREATE OR REPLACE FUNCTION update_user_stats_on_pixel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (wallet, pixels_painted, available_pixels, last_active)
  VALUES (NEW.owner, 1, -1, now())
  ON CONFLICT (wallet) DO UPDATE
  SET 
    pixels_painted = user_stats.pixels_painted + 1,
    available_pixels = GREATEST(user_stats.available_pixels - 1, 0),  -- Prevent negative values
    last_active = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;