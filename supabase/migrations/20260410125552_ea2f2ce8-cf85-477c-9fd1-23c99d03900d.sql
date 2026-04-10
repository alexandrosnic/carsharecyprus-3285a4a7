
-- ============================================================
-- FIX 1: Prevent privilege escalation on user_roles
-- Drop the overly permissive ALL policy and replace with
-- explicit per-command policies + restrictive INSERT guard
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can update roles
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Admins can delete roles
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- RESTRICTIVE: Only service_role can insert new roles
CREATE POLICY "Only service role can insert roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- ============================================================
-- FIX 2: Replace current_setting('role') with auth.role()
-- on bookings and stripe_events tables
-- ============================================================

-- Bookings: drop and recreate service role policy
DROP POLICY IF EXISTS "Service role can confirm bookings" ON public.bookings;

CREATE POLICY "Service role can confirm bookings"
  ON public.bookings FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Stripe events: drop and recreate service role policy
DROP POLICY IF EXISTS "Service role can manage stripe events" ON public.stripe_events;

CREATE POLICY "Service role can manage stripe events"
  ON public.stripe_events FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
