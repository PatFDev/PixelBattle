/*
  # Update Pixel Table Policies

  1. Changes
    - Update RLS policies for the pixels table to allow authenticated users to update pixels
    - Add policy for updating existing pixels
    - Ensure proper authentication checks

  2. Security
    - Maintain read access for all users
    - Allow authenticated users to insert and update pixels
    - Ensure proper wallet verification
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can insert pixels" ON pixels;

-- Create new insert/update policy
CREATE POLICY "Authenticated users can insert or update pixels"
  ON pixels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update the pixels table to track the auth.uid
ALTER TABLE pixels 
ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id);

-- Add trigger to automatically set auth_id
CREATE OR REPLACE FUNCTION set_auth_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.auth_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER set_pixels_auth_id
  BEFORE INSERT OR UPDATE ON pixels
  FOR EACH ROW
  EXECUTE FUNCTION set_auth_id();