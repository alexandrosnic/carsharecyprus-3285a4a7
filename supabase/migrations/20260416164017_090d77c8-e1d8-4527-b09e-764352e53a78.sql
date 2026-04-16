ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.driver_verifications ADD COLUMN IF NOT EXISTS insurance_covers_passengers boolean NOT NULL DEFAULT false;