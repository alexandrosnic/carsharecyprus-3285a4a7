-- Create ratings table for driver-passenger ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL,
  rater_id UUID NOT NULL,
  rated_user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ride_id, rater_id, rated_user_id)
);

-- Enable Row Level Security
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for ratings
CREATE POLICY "Users can view ratings about themselves" 
ON public.ratings 
FOR SELECT 
USING (rated_user_id = auth.uid());

CREATE POLICY "Users can view ratings they gave" 
ON public.ratings 
FOR SELECT 
USING (rater_id = auth.uid());

CREATE POLICY "Users can create ratings" 
ON public.ratings 
FOR INSERT 
WITH CHECK (rater_id = auth.uid());

-- Create function to update user ratings
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update ratings
CREATE TRIGGER update_user_rating_trigger
AFTER INSERT ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();