-- Create a secure public profile view that excludes sensitive data
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  rating,
  total_rides,
  created_at
FROM public.profiles;

-- Grant access to authenticated users only
GRANT SELECT ON public.safe_profiles TO authenticated;

-- Update the overly permissive co-passenger policy to use the safe view
DROP POLICY IF EXISTS "Users can view profiles of co-passengers" ON public.profiles;

-- Create a new restrictive policy that only allows users to see their own full profile
CREATE POLICY "Users can view own full profile" ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Create a security definer function to get phone numbers only for active bookings
CREATE OR REPLACE FUNCTION public.get_contact_info_for_booking(booking_id_param UUID)
RETURNS TABLE(user_id UUID, full_name TEXT, phone_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return contact info if the requesting user is part of the booking
  -- and the booking is confirmed and the ride hasn't happened yet
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.phone_number
  FROM profiles p
  JOIN bookings b ON (p.user_id = b.passenger_id OR p.user_id IN (
    SELECT r.driver_id FROM rides r WHERE r.id = b.ride_id
  ))
  WHERE b.id = booking_id_param
    AND b.status = 'confirmed'
    AND (
      -- User must be either the passenger or driver of this booking
      auth.uid() = b.passenger_id OR 
      auth.uid() = (SELECT driver_id FROM rides WHERE id = b.ride_id)
    )
    AND (
      -- Only show contact info for bookings with future or current rides
      (SELECT departure_time FROM rides WHERE id = b.ride_id) >= NOW() - INTERVAL '2 hours'
    );
END;
$$;