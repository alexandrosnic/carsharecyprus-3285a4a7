-- Create driver verification system
CREATE TABLE public.driver_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  license_number TEXT,
  license_image_url TEXT,
  vehicle_registration TEXT,
  vehicle_image_url TEXT,
  insurance_document_url TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Drivers can view their own verification" ON public.driver_verifications
FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own verification" ON public.driver_verifications
FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own verification when pending" ON public.driver_verifications
FOR UPDATE USING (auth.uid() = driver_id AND verification_status = 'pending');

-- Create dispute resolution system
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  complainant_id UUID NOT NULL,
  respondent_id UUID NOT NULL,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('payment', 'no_show', 'behavior', 'vehicle_issue', 'other')),
  description TEXT NOT NULL,
  evidence_urls TEXT[], -- Array of image/document URLs
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view disputes they are involved in" ON public.disputes
FOR SELECT USING (auth.uid() = complainant_id OR auth.uid() = respondent_id);

CREATE POLICY "Users can create disputes for their bookings" ON public.disputes
FOR INSERT WITH CHECK (auth.uid() = complainant_id);

-- Create push notification tokens table
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own push tokens" ON public.push_tokens
FOR ALL USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_driver_verifications_updated_at
BEFORE UPDATE ON public.driver_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();