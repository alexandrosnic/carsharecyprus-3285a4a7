ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS driver_certification_accepted_at TIMESTAMPTZ;