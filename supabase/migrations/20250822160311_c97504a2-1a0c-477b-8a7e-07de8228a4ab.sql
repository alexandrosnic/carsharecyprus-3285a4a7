-- Fix security definer view by recreating with security invoker
DROP VIEW public.safe_profiles;

CREATE VIEW public.safe_profiles 
WITH (security_invoker = true) AS
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