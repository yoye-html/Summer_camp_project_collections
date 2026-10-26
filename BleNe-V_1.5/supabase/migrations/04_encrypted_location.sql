-- 04_encrypted_location.sql
-- BleNe Connect Cryptographic Location Privacy Layer

-- Add columns for AES-256-GCM encrypted location payloads
ALTER TABLE public.requests 
  ADD COLUMN IF NOT EXISTS encrypted_location text,
  ADD COLUMN IF NOT EXISTS location_iv text,
  ADD COLUMN IF NOT EXISTS is_location_encrypted boolean DEFAULT false;

-- Add comment documentation
COMMENT ON COLUMN public.requests.encrypted_location IS 'Base64 AES-256-GCM ciphertext of exact GPS coordinates (lat, lng, accuracy)';
COMMENT ON COLUMN public.requests.location_iv IS 'Base64 96-bit Initialization Vector (IV) for AES-GCM';
COMMENT ON COLUMN public.requests.is_location_encrypted IS 'Whether exact GPS location has been cryptographically secured';
COMMENT ON COLUMN public.requests.location IS 'PostGIS spatial point: stores coarse/fuzzed coordinates for discovery, while exact GPS remains encrypted';

