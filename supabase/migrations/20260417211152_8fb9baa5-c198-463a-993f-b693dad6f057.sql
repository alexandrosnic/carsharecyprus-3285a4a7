-- Add ID verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS id_verification_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_identity_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_verification_payment_intent_id TEXT;

-- Recreate public_profiles view to expose id_verified (badge is public trust signal)
DROP VIEW IF EXISTS public.public_profiles CASCADE;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  rating,
  total_rides,
  id_verified,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Recreate safe_profiles view too (used elsewhere)
DROP VIEW IF EXISTS public.safe_profiles CASCADE;
CREATE VIEW public.safe_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  rating,
  total_rides,
  id_verified,
  created_at
FROM public.profiles;

GRANT SELECT ON public.safe_profiles TO anon, authenticated;

-- Manual review queue for failed Stripe Identity attempts
CREATE TABLE IF NOT EXISTS public.id_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_identity_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.id_verification_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view review queue"
  ON public.id_verification_reviews
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update review queue"
  ON public.id_verification_reviews
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own review entries"
  ON public.id_verification_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to review queue"
  ON public.id_verification_reviews
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE TRIGGER update_id_verification_reviews_updated_at
  BEFORE UPDATE ON public.id_verification_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_id_verification_reviews_status
  ON public.id_verification_reviews(status, created_at DESC);