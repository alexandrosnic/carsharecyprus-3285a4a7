-- Create stripe_events table for idempotency
CREATE TABLE public.stripe_events (
  event_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on bookings stripe_payment_intent_id
ALTER TABLE public.bookings ADD CONSTRAINT bookings_stripe_payment_intent_id_unique UNIQUE (stripe_payment_intent_id);

-- Drop existing overly permissive policies on bookings
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

-- Create strict INSERT policy for bookings
CREATE POLICY "Users can create pending bookings" ON public.bookings
FOR INSERT
WITH CHECK (
  auth.uid() = passenger_id AND
  status = 'pending' AND
  stripe_payment_intent_id IS NULL AND
  seats_booked > 0
);

-- Create limited UPDATE policy for bookings (only passengers can cancel pending bookings)
CREATE POLICY "Passengers can cancel pending bookings" ON public.bookings
FOR UPDATE
USING (auth.uid() = passenger_id AND status = 'pending')
WITH CHECK (auth.uid() = passenger_id AND status IN ('pending', 'cancelled'));

-- Create policy for service role to confirm bookings
CREATE POLICY "Service role can confirm bookings" ON public.bookings
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Add triggers to enforce validation on bookings
CREATE TRIGGER validate_booking_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

CREATE TRIGGER validate_booking_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- Create security definer RPC for atomic booking confirmation
CREATE OR REPLACE FUNCTION public.confirm_booking_and_decrement(
  p_ride_id UUID,
  p_passenger_id UUID,
  p_seats_booked INTEGER,
  p_total_amount NUMERIC,
  p_commission_amount NUMERIC,
  p_driver_amount NUMERIC,
  p_stripe_payment_intent_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  booking_id UUID;
  current_seats INTEGER;
  ride_price NUMERIC;
BEGIN
  -- Validate input parameters
  IF p_seats_booked <= 0 THEN
    RAISE EXCEPTION 'Invalid seats_booked: must be greater than 0';
  END IF;
  
  -- Lock the ride and get current data
  SELECT available_seats, price_per_seat INTO current_seats, ride_price
  FROM rides 
  WHERE id = p_ride_id 
  FOR UPDATE;
  
  -- Check if ride exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  
  -- Check seat availability
  IF current_seats < p_seats_booked THEN
    RAISE EXCEPTION 'Insufficient seats available';
  END IF;
  
  -- Validate pricing (server-side calculation takes precedence)
  IF p_total_amount != ride_price * p_seats_booked THEN
    RAISE EXCEPTION 'Invalid total amount calculation';
  END IF;
  
  IF p_commission_amount != p_total_amount * 0.10 THEN
    RAISE EXCEPTION 'Invalid commission calculation';
  END IF;
  
  IF p_driver_amount != p_total_amount - p_commission_amount THEN
    RAISE EXCEPTION 'Invalid driver amount calculation';
  END IF;
  
  -- Insert confirmed booking
  INSERT INTO bookings (
    ride_id, 
    passenger_id, 
    seats_booked, 
    total_amount, 
    commission_amount, 
    driver_amount, 
    status, 
    stripe_payment_intent_id
  ) VALUES (
    p_ride_id,
    p_passenger_id,
    p_seats_booked,
    p_total_amount,
    p_commission_amount,
    p_driver_amount,
    'confirmed',
    p_stripe_payment_intent_id
  ) RETURNING id INTO booking_id;
  
  -- Update ride seats
  UPDATE rides 
  SET available_seats = current_seats - p_seats_booked
  WHERE id = p_ride_id;
  
  RETURN booking_id;
END;
$$;

-- Fix push_tokens policies
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.push_tokens;

CREATE POLICY "Users can view their own push tokens" ON public.push_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens" ON public.push_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" ON public.push_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" ON public.push_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Adjust public_profiles view permissions (remove anon access)
REVOKE SELECT ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;