-- Add phone verification tracking to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Reset phone_verified whenever the phone_number changes
CREATE OR REPLACE FUNCTION public.reset_phone_verified_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    NEW.phone_verified := false;
    NEW.phone_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_phone_verified ON public.profiles;
CREATE TRIGGER trg_reset_phone_verified
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.reset_phone_verified_on_change();

-- Track OTP send attempts for rate limiting (max 3/hour per user)
CREATE TABLE IF NOT EXISTS public.phone_otp_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_attempts_user_time 
  ON public.phone_otp_attempts(user_id, created_at DESC);

ALTER TABLE public.phone_otp_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own OTP attempts"
  ON public.phone_otp_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OTP attempts"
  ON public.phone_otp_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
