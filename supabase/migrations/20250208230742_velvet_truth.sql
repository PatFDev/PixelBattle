/*
  # Pixel Battle Database Schema

  1. New Tables
    - `pixels`
      - `x` (integer) - X coordinate
      - `y` (integer) - Y coordinate
      - `color` (text) - Hex color value
      - `owner` (text) - Wallet address of owner
      - `created_at` (timestamp) - When pixel was claimed
    - `deposits`
      - `id` (uuid) - Unique identifier
      - `wallet` (text) - User's wallet address
      - `amount` (numeric) - Amount in SOL
      - `created_at` (timestamp) - When deposit was made
    - `charities`
      - `id` (text) - Unique identifier (e.g., 'children', 'environment')
      - `name` (text) - Charity name
      - `description` (text) - Charity description
      - `icon` (text) - Icon identifier
    - `votes`
      - `id` (uuid) - Unique identifier
      - `wallet` (text) - Voter's wallet address
      - `charity_id` (text) - References charities.id
      - `created_at` (timestamp) - When vote was cast

  2. Security
    - Enable RLS on all tables
    - Public read access for pixels and charities
    - Authenticated write access for pixels (when deposited)
    - Authenticated write access for votes (one per wallet)
*/

-- Create pixels table
CREATE TABLE IF NOT EXISTS pixels (
  x integer NOT NULL,
  y integer NOT NULL,
  color text NOT NULL,
  owner text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (x, y)
);

-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create charities table
CREATE TABLE IF NOT EXISTS charities (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  charity_id text REFERENCES charities(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (wallet)
);

-- Enable RLS
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policies for pixels table
CREATE POLICY "Anyone can read pixels"
  ON pixels FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert pixels"
  ON pixels FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for charities table
CREATE POLICY "Anyone can read charities"
  ON charities FOR SELECT
  TO public
  USING (true);

-- Policies for deposits table
CREATE POLICY "Authenticated users can read own deposits"
  ON deposits FOR SELECT
  TO authenticated
  USING (wallet = auth.jwt() ->> 'sub');

CREATE POLICY "Authenticated users can insert deposits"
  ON deposits FOR INSERT
  TO authenticated
  WITH CHECK (wallet = auth.jwt() ->> 'sub');

-- Policies for votes table
CREATE POLICY "Anyone can read vote counts"
  ON votes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can vote once"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (
    wallet = auth.jwt() ->> 'sub' AND
    NOT EXISTS (
      SELECT 1 FROM votes
      WHERE wallet = auth.jwt() ->> 'sub'
    )
  );

-- Insert initial charities
INSERT INTO charities (id, name, description, icon) VALUES
  ('children', 'Children''s Education Fund', 'Supporting education for underprivileged children worldwide', 'Heart'),
  ('homeless', 'Homeless Support Initiative', 'Providing shelter and support for homeless individuals', 'Users'),
  ('environment', 'Environmental Protection', 'Fighting climate change and protecting ecosystems', 'Leaf'),
  ('animals', 'Animal Welfare', 'Supporting animal shelters and wildlife conservation', 'Dog')
ON CONFLICT (id) DO NOTHING;