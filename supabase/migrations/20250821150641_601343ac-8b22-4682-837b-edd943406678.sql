-- Create function to safely decrement ride seats
CREATE OR REPLACE FUNCTION public.decrement_seats(ride_id UUID, seats_to_book INTEGER)
RETURNS INTEGER AS $$
DECLARE
  current_seats INTEGER;
BEGIN
  -- Get current available seats with row lock
  SELECT available_seats INTO current_seats
  FROM rides 
  WHERE id = ride_id 
  FOR UPDATE;
  
  -- Check if enough seats available
  IF current_seats < seats_to_book THEN
    RAISE EXCEPTION 'Insufficient seats available';
  END IF;
  
  -- Return new seat count
  RETURN current_seats - seats_to_book;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;