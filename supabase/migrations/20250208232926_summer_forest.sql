/*
  # Fix Public Access Policies

  1. Changes
    - Remove authentication requirements
    - Enable public access for all operations
    - Simplify policy structure

  2. Security
    - Note: This is for demo purposes only
    - In production, you would want stricter policies
*/

-- First, disable RLS temporarily to ensure clean policy updates
ALTER TABLE pixels DISABLE ROW LEVEL SECURITY;
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can read pixels" ON pixels;
DROP POLICY IF EXISTS "Authenticated users can modify pixels" ON pixels;
DROP POLICY IF EXISTS "Anyone can read deposits" ON deposits;
DROP POLICY IF EXISTS "Anyone can insert deposits" ON deposits;
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
DROP POLICY IF EXISTS "Anyone can vote" ON votes;

-- Re-enable RLS
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create new, simplified policies that allow public access
CREATE POLICY "Public full access to pixels"
  ON pixels
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public full access to deposits"
  ON deposits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public full access to votes"
  ON votes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);