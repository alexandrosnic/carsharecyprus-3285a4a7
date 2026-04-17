-- Phone OTP codes table for BudgetSMS-based verification
CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_user
  ON public.phone_otp_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_expires
  ON public.phone_otp_codes(expires_at);

-- Enable RLS — only service_role (edge functions) can access
ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- No public policies. Default-deny means clients cannot read/write directly.
-- Edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS automatically.

-- Explicit service-role-only policy for clarity
CREATE POLICY "Service role full access to phone_otp_codes"
  ON public.phone_otp_codes
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');