-- Add refund + no-show tracking to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS no_show_reported_by uuid,
  ADD COLUMN IF NOT EXISTS no_show_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_type text;

-- Allow service_role to update refund/no-show fields (validate_booking_update already lets service_role through)

-- RPC: report no-show. Either party can report; freezes payout for admin review.
CREATE OR REPLACE FUNCTION public.report_no_show(
  p_booking_id uuid,
  p_no_show_type text  -- 'driver' or 'passenger'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_passenger uuid;
  v_driver uuid;
  v_departure timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_no_show_type NOT IN ('driver', 'passenger') THEN
    RAISE EXCEPTION 'Invalid no_show_type';
  END IF;

  SELECT b.passenger_id, r.driver_id, r.departure_time
    INTO v_passenger, v_driver, v_departure
  FROM bookings b
  JOIN rides r ON r.id = b.ride_id
  WHERE b.id = p_booking_id;

  IF v_passenger IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Only the counterparty can report a no-show
  IF p_no_show_type = 'driver' AND v_caller <> v_passenger THEN
    RAISE EXCEPTION 'Only passenger can report driver no-show';
  END IF;
  IF p_no_show_type = 'passenger' AND v_caller <> v_driver THEN
    RAISE EXCEPTION 'Only driver can report passenger no-show';
  END IF;

  -- Must be at or after departure time
  IF now() < v_departure THEN
    RAISE EXCEPTION 'Cannot report no-show before departure time';
  END IF;

  UPDATE bookings
     SET no_show_reported_by = v_caller,
         no_show_reported_at = now(),
         no_show_type = p_no_show_type,
         payout_status = CASE WHEN payout_status IN ('held','none') THEN 'frozen' ELSE payout_status END,
         updated_at = now()
   WHERE id = p_booking_id;
END;
$$;