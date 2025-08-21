-- Fix critical security issues
-- 1. Fix public_profiles view security
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker=true) AS
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.rating,
  p.total_rides,
  p.created_at
FROM profiles p;

-- 2. Enable replica identity for real-time
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL; 
ALTER TABLE rides REPLICA IDENTITY FULL;

-- 3. Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;