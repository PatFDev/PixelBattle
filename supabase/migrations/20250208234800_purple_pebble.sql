/*
  # Fix deposit pixels functionality

  1. Changes
    - Update trigger to properly handle pixel calculations
    - Add logging for debugging
*/

-- Update the deposit trigger to properly handle pixel calculations
CREATE OR REPLACE FUNCTION update_user_stats_on_deposit()
RETURNS TRIGGER AS $$
DECLARE
  pixel_count integer;
BEGIN
  -- Calculate number of pixels from deposit amount (0.0001 SOL per pixel)
  pixel_count := FLOOR(NEW.amount / 0.0001)::integer;
  
  -- Debug log
  RAISE NOTICE 'Processing deposit: Amount %, Pixels %', NEW.amount, pixel_count;
  
  INSERT INTO user_stats (
    wallet,
    total_deposited,
    available_pixels,
    last_active
  ) VALUES (
    NEW.wallet,
    NEW.amount,
    pixel_count,
    now()
  ) ON CONFLICT (wallet) DO UPDATE
  SET 
    total_deposited = user_stats.total_deposited + NEW.amount,
    available_pixels = user_stats.available_pixels + pixel_count,
    last_active = now();
    
  -- Debug log
  RAISE NOTICE 'Updated user_stats for wallet: %', NEW.wallet;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;