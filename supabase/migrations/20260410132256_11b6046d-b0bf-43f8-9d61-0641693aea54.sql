-- Fix: Restrict passenger booking updates to only cancellation-related fields
-- Drop the existing overly-permissive update policy
DROP POLICY IF EXISTS "Passengers can cancel bookings" ON public.bookings;

-- Recreate with column-level restrictions using a trigger
-- Since Postgres RLS can't restrict columns directly, we use a trigger to prevent modification of financial fields
CREATE OR REPLACE FUNCTION public.validate_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the update is coming from service_role, allow everything
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, only allow changes to status, cancelled_at, and cancellation_reason
  IF NEW.seats_booked IS DISTINCT FROM OLD.seats_booked
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.driver_amount IS DISTINCT FROM OLD.driver_amount
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.ride_id IS DISTINCT FROM OLD.ride_id
     OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id
  THEN
    RAISE EXCEPTION 'Cannot modify protected booking fields';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_booking_update_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_update();

-- Recreate the cancellation policy (same access rules, trigger enforces column safety)
CREATE POLICY "Passengers can cancel bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = passenger_id) AND (status IN ('pending', 'confirmed')))
  WITH CHECK ((auth.uid() = passenger_id) AND (status IN ('pending', 'confirmed', 'cancelled')));