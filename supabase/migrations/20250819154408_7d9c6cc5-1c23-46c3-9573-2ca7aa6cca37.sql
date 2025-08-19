-- Add foreign key constraint from rides to profiles
ALTER TABLE public.rides 
ADD CONSTRAINT rides_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;