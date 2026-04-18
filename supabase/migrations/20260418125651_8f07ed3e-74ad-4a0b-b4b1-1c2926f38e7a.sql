
-- 1. Private bucket for driver verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-docs', 'driver-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for driver-docs bucket
-- Drivers upload to their own folder: {user_id}/license.jpg, {user_id}/vehicle.jpg
CREATE POLICY "Drivers can upload own docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can update own docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can read own docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can read all driver docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-docs'
  AND public.has_role(auth.uid(), 'admin'::user_role)
);

-- 2. Add AI verification columns to driver_verifications
ALTER TABLE public.driver_verifications
  ADD COLUMN IF NOT EXISTS ai_verification_score numeric,
  ADD COLUMN IF NOT EXISTS ai_verification_result jsonb,
  ADD COLUMN IF NOT EXISTS ai_verified_at timestamp with time zone;
