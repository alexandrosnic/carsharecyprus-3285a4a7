
-- Allow anyone to view all ratings (for driver reviews on ride details)
CREATE POLICY "Anyone can view ratings"
ON public.ratings
FOR SELECT
USING (true);

-- Create ride_requests table for passengers
CREATE TABLE public.ride_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id UUID NOT NULL,
  departure_city TEXT NOT NULL,
  arrival_city TEXT NOT NULL,
  desired_date DATE NOT NULL,
  desired_time TIME,
  seats_needed INTEGER NOT NULL DEFAULT 1,
  max_price NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ride requests"
ON public.ride_requests
FOR SELECT
USING (status = 'active');

CREATE POLICY "Users can view their own ride requests"
ON public.ride_requests
FOR SELECT
USING (auth.uid() = passenger_id);

CREATE POLICY "Users can create their own ride requests"
ON public.ride_requests
FOR INSERT
WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Users can update their own ride requests"
ON public.ride_requests
FOR UPDATE
USING (auth.uid() = passenger_id);

CREATE POLICY "Users can delete their own ride requests"
ON public.ride_requests
FOR DELETE
USING (auth.uid() = passenger_id);

CREATE TRIGGER update_ride_requests_updated_at
BEFORE UPDATE ON public.ride_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
