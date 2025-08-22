-- Fix RLS policy for profiles table to prevent data harvesting
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;

-- Create more restrictive policy - users can only view their own profiles
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Allow users to view profiles of users they have rides with (for safety/verification)
CREATE POLICY "Users can view profiles of co-passengers" ON public.profiles
FOR SELECT
USING (
  user_id IN (
    SELECT DISTINCT 
      CASE 
        WHEN r.driver_id = auth.uid() THEN b.passenger_id
        WHEN b.passenger_id = auth.uid() THEN r.driver_id
        ELSE NULL
      END
    FROM rides r
    JOIN bookings b ON r.id = b.ride_id
    WHERE (r.driver_id = auth.uid() OR b.passenger_id = auth.uid())
    AND b.status = 'confirmed'
  )
);

-- Enable RLS for public_profiles table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_profiles') THEN
    ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for public_profiles - only allow viewing if user has interacted
    CREATE POLICY "View public profiles of ride participants" ON public.public_profiles
    FOR SELECT
    USING (
      user_id IN (
        SELECT DISTINCT 
          CASE 
            WHEN r.driver_id = auth.uid() THEN b.passenger_id
            WHEN b.passenger_id = auth.uid() THEN r.driver_id
            ELSE NULL
          END
        FROM rides r
        JOIN bookings b ON r.id = b.ride_id
        WHERE (r.driver_id = auth.uid() OR b.passenger_id = auth.uid())
        AND b.status = 'confirmed'
      )
    );
  END IF;
END $$;