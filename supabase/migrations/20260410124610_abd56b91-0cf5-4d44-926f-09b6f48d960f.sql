
-- Create ride_stops table for intermediate waypoints
CREATE TABLE public.ride_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  city text NOT NULL,
  stop_order integer NOT NULL,
  price_from_start numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ride_stops ENABLE ROW LEVEL SECURITY;

-- Anyone can view stops for active rides
CREATE POLICY "Anyone can view ride stops"
ON public.ride_stops
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_stops.ride_id AND rides.status = 'active')
);

-- Driver can manage stops for their rides
CREATE POLICY "Drivers can insert stops for their rides"
ON public.ride_stops
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_stops.ride_id AND rides.driver_id = auth.uid())
);

CREATE POLICY "Drivers can update stops for their rides"
ON public.ride_stops
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_stops.ride_id AND rides.driver_id = auth.uid())
);

CREATE POLICY "Drivers can delete stops for their rides"
ON public.ride_stops
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_stops.ride_id AND rides.driver_id = auth.uid())
);

-- Add index for performance
CREATE INDEX idx_ride_stops_ride_id ON public.ride_stops(ride_id);

-- Add recurring ride columns to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern text,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;
