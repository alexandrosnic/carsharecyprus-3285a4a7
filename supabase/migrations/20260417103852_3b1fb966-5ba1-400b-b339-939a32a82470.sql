-- Track which admin resolved a dispute
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- Admins can view all disputes
CREATE POLICY "Admins can view all disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update disputes (to resolve them)
CREATE POLICY "Admins can update disputes"
ON public.disputes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));