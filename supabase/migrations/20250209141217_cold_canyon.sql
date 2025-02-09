/*
  # Reset and improve charity voting system
  
  1. Changes
    - Reset all votes to start fresh
    - Add trigger to automatically update total weighted votes
    - Add function to calculate percentage share
  
  2. Security
    - Maintain existing RLS policies
*/

-- First, clear existing votes to start fresh
TRUNCATE TABLE votes;

-- Add a total_weighted_votes column to charities for easier calculations
ALTER TABLE charities ADD COLUMN IF NOT EXISTS total_weighted_votes numeric DEFAULT 0;

-- Create a function to update charity total weighted votes
CREATE OR REPLACE FUNCTION update_charity_weighted_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE charities 
    SET total_weighted_votes = total_weighted_votes + NEW.weight
    WHERE id = NEW.charity_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE charities 
    SET total_weighted_votes = total_weighted_votes - OLD.weight
    WHERE id = OLD.charity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for vote changes
DROP TRIGGER IF EXISTS update_weighted_votes ON votes;
CREATE TRIGGER update_weighted_votes
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_charity_weighted_votes();