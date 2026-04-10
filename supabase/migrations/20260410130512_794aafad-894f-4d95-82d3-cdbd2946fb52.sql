
-- Fix driver_verification_audit INSERT policy: replace current_setting with auth.role()
DROP POLICY IF EXISTS "System can insert audit logs" ON public.driver_verification_audit;

CREATE POLICY "System can insert audit logs"
  ON public.driver_verification_audit
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');
