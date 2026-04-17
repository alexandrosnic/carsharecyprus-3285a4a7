-- Add escrow tracking columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS passenger_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Allowed values: none | held | released | refunded | frozen
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payout_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payout_status_check
  CHECK (payout_status IN ('none','held','released','refunded','frozen'));

CREATE INDEX IF NOT EXISTS idx_bookings_payout_status ON public.bookings(payout_status);
CREATE INDEX IF NOT EXISTS idx_bookings_auto_release_at ON public.bookings(auto_release_at) WHERE payout_status = 'held';

-- Allow service_role to update the new payout fields without tripping the protected-fields trigger.
-- The existing validate_booking_update trigger already allows service_role to bypass restrictions, so no change needed there.

-- Function: mark booking as released (called from edge function after successful Stripe transfer)
CREATE OR REPLACE FUNCTION public.mark_booking_released(
  p_booking_id UUID,
  p_stripe_transfer_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can mark bookings as released';
  END IF;

  UPDATE public.bookings
     SET payout_status = 'released',
         stripe_transfer_id = p_stripe_transfer_id,
         released_at = now(),
         updated_at = now()
   WHERE id = p_booking_id
     AND payout_status = 'held';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not in held state';
  END IF;
END;
$$;

-- Function: freeze a booking's payout (called when dispute is created)
CREATE OR REPLACE FUNCTION public.freeze_booking_payout(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
     SET payout_status = 'frozen',
         updated_at = now()
   WHERE id = p_booking_id
     AND payout_status IN ('held','none');
END;
$$;

-- Trigger: when a dispute is inserted, freeze the related booking's payout
CREATE OR REPLACE FUNCTION public.freeze_booking_on_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.freeze_booking_payout(NEW.booking_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_booking_on_dispute ON public.disputes;
CREATE TRIGGER trg_freeze_booking_on_dispute
AFTER INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.freeze_booking_on_dispute();

-- Allow passenger to update their own booking to record arrival confirmation (passenger_confirmed_at only)
-- The existing validate_booking_update trigger blocks regular users from changing protected fields.
-- We need to allow passenger_confirmed_at updates by passenger.
CREATE OR REPLACE FUNCTION public.validate_booking_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If the update is coming from service_role, allow everything
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, only allow changes to status, cancelled_at, cancellation_reason, passenger_confirmed_at
  IF NEW.seats_booked IS DISTINCT FROM OLD.seats_booked
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.driver_amount IS DISTINCT FROM OLD.driver_amount
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.ride_id IS DISTINCT FROM OLD.ride_id
     OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id
     OR NEW.payout_status IS DISTINCT FROM OLD.payout_status
     OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id
     OR NEW.released_at IS DISTINCT FROM OLD.released_at
     OR NEW.auto_release_at IS DISTINCT FROM OLD.auto_release_at
  THEN
    RAISE EXCEPTION 'Cannot modify protected booking fields';
  END IF;

  RETURN NEW;
END;
$function$;