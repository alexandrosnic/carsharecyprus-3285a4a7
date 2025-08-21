-- Fix profiles table RLS - restrict PII access
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Only allow viewing basic profile info, not PII like phone numbers
CREATE POLICY "Users can view basic profile info" ON public.profiles
FOR SELECT USING (
  CASE 
    WHEN auth.uid() = user_id THEN true  -- Users can see their own full profile
    ELSE phone_number IS NULL OR phone_number = ''  -- Others only see profiles without phone numbers, or we could limit to specific columns
  END
);

-- Better approach: Create a view for public profile data
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

-- Fix bookings RLS - ensure proper access control
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;

-- More restrictive booking access
CREATE POLICY "Users can view their own bookings as passenger" ON public.bookings
FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Drivers can view bookings for their rides" ON public.bookings
FOR SELECT USING (
  auth.uid() = (
    SELECT driver_id 
    FROM rides 
    WHERE rides.id = bookings.ride_id
  )
);

-- Add missing message update policy for read receipts
CREATE POLICY "Users can update messages they received for read receipts" ON public.messages
FOR UPDATE USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Add validation trigger for bookings to prevent manipulation
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for booking validation
CREATE TRIGGER validate_booking_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking();