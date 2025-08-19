import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Star, Send } from 'lucide-react';
import { toast } from 'sonner';

interface RideInfo {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  driver_id: string;
  rated_user: {
    user_id: string;
    full_name: string;
    avatar_url: string;
    rating: number;
  };
  user_role: 'driver' | 'passenger';
}

const RatingPage = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rideInfo, setRideInfo] = useState<RideInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (rideId) {
      fetchRideInfo();
    }
  }, [rideId, user]);

  const fetchRideInfo = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get ride details
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;

      // Determine user role and who to rate
      const isDriver = rideData.driver_id === user.id;
      let userToRate: string;
      let userRole: 'driver' | 'passenger';

      if (isDriver) {
        // Driver rating passenger - get passenger from bookings
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('passenger_id')
          .eq('ride_id', rideId)
          .eq('status', 'completed')
          .single();

        if (bookingError) throw bookingError;
        userToRate = bookingData.passenger_id;
        userRole = 'driver';
      } else {
        // Passenger rating driver
        userToRate = rideData.driver_id;
        userRole = 'passenger';
      }

      // Get user profile to rate
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, rating')
        .eq('user_id', userToRate)
        .single();

      if (profileError) throw profileError;

      setRideInfo({
        ...rideData,
        rated_user: profileData,
        user_role: userRole
      });
    } catch (error: any) {
      console.error('Error fetching ride info:', error);
      toast.error('Failed to load ride information');
      navigate('/my-trips');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!user || !rideInfo || rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .insert({
          ride_id: rideId,
          rater_id: user.id,
          rated_user_id: rideInfo.rated_user.user_id,
          rating,
          comment: comment.trim() || null
        });

      if (error) throw error;

      toast.success('Rating submitted successfully!');
      navigate('/my-trips');
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Star className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading rating information...</p>
        </div>
      </div>
    );
  }

  if (!rideInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Rating not available</h2>
          <p className="text-muted-foreground mb-4">This ride cannot be rated at this time</p>
          <Button onClick={() => navigate('/my-trips')}>
            Back to My Trips
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/my-trips')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Trips
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Rate Your Experience</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Ride Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Trip Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-2">
                <div className="text-lg font-semibold">
                  {rideInfo.departure_city} → {rideInfo.arrival_city}
                </div>
                <div className="text-muted-foreground">
                  {formatDateTime(rideInfo.departure_time)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rating Form */}
          <Card>
            <CardHeader>
              <CardTitle>
                Rate Your {rideInfo.user_role === 'driver' ? 'Passenger' : 'Driver'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User to Rate */}
              <div className="flex items-center justify-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={rideInfo.rated_user.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {rideInfo.rated_user.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-xl font-semibold">{rideInfo.rated_user.full_name}</h3>
                  <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>Current rating: {rideInfo.rated_user.rating?.toFixed(1) || '5.0'}</span>
                  </div>
                </div>
              </div>

              {/* Star Rating */}
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h4 className="text-lg font-medium">How was your experience?</h4>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="p-1 transition-transform hover:scale-110"
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => setRating(star)}
                      >
                        <Star
                          className={`h-10 w-10 ${
                            star <= (hoveredRating || rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rating === 0 && 'Click to rate'}
                    {rating === 1 && 'Poor'}
                    {rating === 2 && 'Fair'}
                    {rating === 3 && 'Good'}
                    {rating === 4 && 'Very Good'}
                    {rating === 5 && 'Excellent'}
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <label htmlFor="comment" className="text-sm font-medium">
                  Leave a comment (optional)
                </label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`Share your experience with ${rideInfo.rated_user.full_name}...`}
                  rows={3}
                  maxLength={500}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {comment.length}/500 characters
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                size="lg" 
                className="w-full"
                onClick={handleSubmitRating}
                disabled={submitting || rating === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting Rating...' : 'Submit Rating'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Your rating helps improve the carpool community for everyone
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RatingPage;