-- Fix the update_user_rating function search path
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the rated user's average rating
  UPDATE public.profiles 
  SET 
    rating = (
      SELECT COALESCE(AVG(rating::DECIMAL), 5.0)
      FROM public.ratings 
      WHERE rated_user_id = NEW.rated_user_id
    ),
    updated_at = now()
  WHERE user_id = NEW.rated_user_id;
  
  RETURN NEW;
END;
$$;

-- Check for any security definer views and remove them if they exist
DO $$
DECLARE 
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
          AND definition ILIKE '%security definer%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(view_record.schemaname) || '.' || quote_ident(view_record.viewname);
    END LOOP;
END $$;