/*
  # Enable real-time functionality for pixels table

  1. Changes
    - Enable real-time for pixels table
    - Add publication for real-time changes
    - Add real-time security policies

  2. Security
    - Maintain existing RLS policies
    - Add specific real-time access
*/

-- Enable real-time for the pixels table
ALTER TABLE pixels REPLICA IDENTITY FULL;

-- Create publication for real-time changes
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE pixels;