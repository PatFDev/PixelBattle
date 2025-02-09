/*
  # Add leaderboard functionality

  1. New Tables
    - `user_stats`
      - `wallet` (text, primary key)
      - `pixels_painted` (integer)
      - `total_deposited` (numeric)
      - `last_active` (timestamp)

  2. Changes
    - Add trigger to update user stats on pixel paint
    - Add trigger to update user stats on deposit

  3. Security
    - Enable RLS
    - Add policies for public access
*/

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  wallet text PRIMARY KEY,
  pixels_painted integer DEFAULT 0,
  total_deposited numeric DEFAULT 0,
  last_active timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can read user stats"
  ON user_stats
  FOR SELECT
  TO public
  USING (true);

-- Create policy for public insert/update
CREATE POLICY "Public can modify user stats"
  ON user_stats
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Function to update user stats on pixel paint
CREATE OR REPLACE FUNCTION update_user_stats_on_pixel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (wallet, pixels_painted, last_active)
  VALUES (NEW.owner, 1, now())
  ON CONFLICT (wallet) DO UPDATE
  SET 
    pixels_painted = user_stats.pixels_painted + 1,
    last_active = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user stats on deposit
CREATE OR REPLACE FUNCTION update_user_stats_on_deposit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (wallet, total_deposited, last_active)
  VALUES (NEW.wallet, NEW.amount, now())
  ON CONFLICT (wallet) DO UPDATE
  SET 
    total_deposited = user_stats.total_deposited + NEW.amount,
    last_active = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS update_stats_on_pixel ON pixels;
CREATE TRIGGER update_stats_on_pixel
  AFTER INSERT OR UPDATE ON pixels
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_pixel();

DROP TRIGGER IF EXISTS update_stats_on_deposit ON deposits;
CREATE TRIGGER update_stats_on_deposit
  AFTER INSERT ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_deposit();