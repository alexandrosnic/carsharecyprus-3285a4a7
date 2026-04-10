
-- Drop existing policy and recreate with broader cancellation support
DROP POLICY IF EXISTS "Passengers can cancel pending bookings" ON public.bookings;

CREATE POLICY "Passengers can cancel bookings"
ON public.bookings
FOR UPDATE
USING (
  (auth.uid() = passenger_id) AND (status IN ('pending', 'confirmed'))
)
WITH CHECK (
  (auth.uid() = passenger_id) AND (status IN ('pending', 'confirmed', 'cancelled'))
);
