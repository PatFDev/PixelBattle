/*
  # Fix RLS policies for pixel updates

  1. Changes
    - Update RLS policies for the pixels table to allow authenticated users to modify pixels
    - Add policy for unauthenticated reads
    - Add policy for authenticated updates
    
  2. Security
    - Maintain read access for all users
    - Allow authenticated users to modify pixels
    - Ensure proper authentication checks
*/

-- Drop existing policies for pixels table
DROP POLICY IF EXISTS "Anyone can read pixels" ON pixels;
DROP POLICY IF EXISTS "Authenticated users can insert or update pixels" ON pixels;

-- Create new policies
CREATE POLICY "Enable read access for all users"
  ON pixels FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert/update for authenticated users"
  ON pixels FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON pixels FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;