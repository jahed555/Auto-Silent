/*
# Create mosques table (single-tenant, no auth)

1. New Tables
- `mosques`
  - `id` (uuid, primary key)
  - `name` (text, not null) — user-given name for the mosque
  - `photo` (text, not null) — base64-encoded photo data URI captured from camera
  - `latitude` (double precision, not null) — mosque GPS latitude
  - `longitude` (double precision, not null) — mosque GPS longitude
  - `radius` (integer, not null, default 150) — geofence radius in meters
  - `auto_silent` (boolean, not null, default true) — whether auto-silent triggers on entry
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `mosques`.
- Grant CRUD to `anon` + `authenticated` so the Data API can reach the table.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no sign-in app).
*/

CREATE TABLE IF NOT EXISTS mosques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius integer NOT NULL DEFAULT 150,
  auto_silent boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mosques ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON mosques TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_mosques" ON mosques;
CREATE POLICY "anon_select_mosques" ON mosques FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mosques" ON mosques;
CREATE POLICY "anon_insert_mosques" ON mosques FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mosques" ON mosques;
CREATE POLICY "anon_update_mosques" ON mosques FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mosques" ON mosques;
CREATE POLICY "anon_delete_mosques" ON mosques FOR DELETE
  TO anon, authenticated USING (true);
