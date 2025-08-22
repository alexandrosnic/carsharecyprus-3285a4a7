-- Enable RLS on stripe_events table
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Create policy for service role to manage stripe events
CREATE POLICY "Service role can manage stripe events" ON public.stripe_events
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');