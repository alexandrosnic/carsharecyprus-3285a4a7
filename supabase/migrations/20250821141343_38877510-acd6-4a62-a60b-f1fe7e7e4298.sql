-- Fix security definer view issue by dropping and recreating without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_profiles;

-- Create view without SECURITY DEFINER (regular view)
CREATE VIEW public.public_profiles AS 
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  rating,
  total_rides,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Fix function search path issues
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Validate seat availability
  IF (SELECT available_seats FROM rides WHERE id = NEW.ride_id) < NEW.seats_booked THEN
    RAISE EXCEPTION 'Insufficient seats available';
  END IF;
  
  -- Validate pricing matches ride pricing
  IF NEW.total_amount != (SELECT price_per_seat FROM rides WHERE id = NEW.ride_id) * NEW.seats_booked THEN
    RAISE EXCEPTION 'Invalid pricing calculation';
  END IF;
  
  -- Ensure commission calculation is correct (10% commission)
  IF NEW.commission_amount != NEW.total_amount * 0.10 THEN
    RAISE EXCEPTION 'Invalid commission calculation';
  END IF;
  
  -- Ensure driver amount is correct
  IF NEW.driver_amount != NEW.total_amount - NEW.commission_amount THEN
    RAISE EXCEPTION 'Invalid driver amount calculation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix the existing handle_new_user function search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;