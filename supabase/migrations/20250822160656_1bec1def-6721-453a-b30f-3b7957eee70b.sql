-- Create admin role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'driver', 'passenger');
    END IF;
END $$;

-- Create user_roles table if it doesn't exist for admin access control
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create policy for users to view their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for admins to manage all roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

-- Drop existing policies on driver_verifications to recreate with stronger security
DROP POLICY IF EXISTS "Drivers can insert their own verification" ON public.driver_verifications;
DROP POLICY IF EXISTS "Drivers can update their own verification when pending" ON public.driver_verifications;
DROP POLICY IF EXISTS "Drivers can view their own verification" ON public.driver_verifications;

-- Create comprehensive RLS policies for driver_verifications
-- Policy 1: Drivers can view only their own verification records
CREATE POLICY "Drivers can view own verification" ON public.driver_verifications
FOR SELECT
USING (
    auth.uid() = driver_id OR 
    public.has_role(auth.uid(), 'admin'::user_role)
);

-- Policy 2: Drivers can insert their own verification records
CREATE POLICY "Drivers can insert own verification" ON public.driver_verifications
FOR INSERT
WITH CHECK (
    auth.uid() = driver_id AND
    verification_status = 'pending'
);

-- Policy 3: Drivers can update their own verification when pending, admins can update any
CREATE POLICY "Drivers can update own pending verification" ON public.driver_verifications
FOR UPDATE
USING (
    (auth.uid() = driver_id AND verification_status = 'pending') OR
    public.has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
    (auth.uid() = driver_id AND verification_status IN ('pending', 'resubmitted')) OR
    public.has_role(auth.uid(), 'admin'::user_role)
);

-- Policy 4: Only admins can delete verification records (for data retention compliance)
CREATE POLICY "Admins can delete verification records" ON public.driver_verifications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Create audit log table for sensitive operations on driver verifications
CREATE TABLE IF NOT EXISTS public.driver_verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID REFERENCES public.driver_verifications(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'viewed', 'updated', 'approved', 'rejected'
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB,
    ip_address INET
);

-- Enable RLS on audit table
ALTER TABLE public.driver_verification_audit ENABLE ROW LEVEL SECURITY;

-- Only admins and the driver can view audit logs for their verification
CREATE POLICY "View verification audit logs" ON public.driver_verification_audit
FOR SELECT
USING (
    public.has_role(auth.uid(), 'admin'::user_role) OR
    auth.uid() = (SELECT driver_id FROM public.driver_verifications WHERE id = verification_id)
);

-- Only system (service role) can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.driver_verification_audit
FOR INSERT
WITH CHECK (current_setting('role') = 'service_role');

-- Add additional constraints to ensure data integrity
ALTER TABLE public.driver_verifications 
ADD CONSTRAINT check_license_number_not_empty 
CHECK (license_number IS NULL OR length(trim(license_number)) > 0);

ALTER TABLE public.driver_verifications 
ADD CONSTRAINT check_vehicle_registration_not_empty 
CHECK (vehicle_registration IS NULL OR length(trim(vehicle_registration)) > 0);