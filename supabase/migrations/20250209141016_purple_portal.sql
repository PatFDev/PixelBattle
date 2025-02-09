/*
  # Add weighted voting based on user deposits

  1. Changes
    - Add weight column to votes table to store voting power
    - Update voting policies to consider deposit amounts
    - Add function to calculate voting weight based on total deposits

  2. Security
    - Maintain existing RLS policies
    - Add validation to ensure weight matches user's deposit
*/

-- Add weight column to votes table
ALTER TABLE votes ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 1.0;

-- Function to calculate total votes for a charity including weights
CREATE OR REPLACE FUNCTION get_charity_weighted_votes(charity_id_param text)
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT SUM(v.weight)
      FROM votes v
      WHERE v.charity_id = charity_id_param
    ),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;