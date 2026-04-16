import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, X, ArrowRight } from 'lucide-react';

interface UnratedRide {
  rideId: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  role: 'driver' | 'passenger';
}

const RatingPrompt = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unratedRides, setUnratedRides] = useState<UnratedRide[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) fetchUnratedRides();
  }, [user]);

  const fetchUnratedRides = async () => {
    if (!user) return;

    try {
      // Get existing ratings by this user
      const { data: existingRatings } = await supabase
        .from('ratings')
        .select('ride_id')
        .eq('rater_id', user.id);

      const ratedRideIds = new Set(existingRatings?.map(r => r.ride_id) || []);

      // Check dismissed from session
      const sessionDismissed = sessionStorage.getItem('dismissed_ratings');
      if (sessionDismissed) {
        setDismissed(new Set(JSON.parse(sessionDismissed)));
      }

      const now = new Date().toISOString();
      const results: UnratedRide[] = [];

      // 1. Rides where user was DRIVER with confirmed bookings (past rides)
      const { data: driverRides } = await supabase
        .from('rides')
        .select('id, departure_city, arrival_city, departure_time')
        .eq('driver_id', user.id)
        .lt('departure_time', now)
        .limit(20);

      if (driverRides && driverRides.length > 0) {
        const rideIds = driverRides.map(r => r.id);
        const { data: bookings } = await supabase
          .from('bookings')
          .select('ride_id, passenger_id')
          .in('ride_id', rideIds)
          .eq('status', 'confirmed');

        if (bookings) {
          const passengerIds = [...new Set(bookings.map(b => b.passenger_id))];
          const { data: profiles } = await supabase
            .from('safe_profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', passengerIds);

          for (const booking of bookings) {
            if (ratedRideIds.has(booking.ride_id)) continue;
            const ride = driverRides.find(r => r.id === booking.ride_id);
            const profile = profiles?.find(p => p.user_id === booking.passenger_id);
            if (ride && profile) {
              results.push({
                rideId: ride.id,
                departureCity: ride.departure_city,
                arrivalCity: ride.arrival_city,
                departureTime: ride.departure_time,
                otherUserId: booking.passenger_id,
                otherUserName: profile.full_name || 'Passenger',
                otherUserAvatar: profile.avatar_url,
                role: 'driver',
              });
            }
          }
        }
      }

      // 2. Bookings where user was PASSENGER (past rides)
      const { data: passengerBookings } = await supabase
        .from('bookings')
        .select('ride_id, rides(id, departure_city, arrival_city, departure_time, driver_id)')
        .eq('passenger_id', user.id)
        .eq('status', 'confirmed')
        .limit(20);

      if (passengerBookings) {
        const driverIds = [...new Set(
          passengerBookings.map(b => (b.rides as any)?.driver_id).filter(Boolean)
        )];
        const { data: driverProfiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', driverIds);

        for (const booking of passengerBookings) {
          const ride = booking.rides as any;
          if (!ride || new Date(ride.departure_time) > new Date()) continue;
          if (ratedRideIds.has(ride.id)) continue;
          const profile = driverProfiles?.find(p => p.user_id === ride.driver_id);
          if (profile) {
            results.push({
              rideId: ride.id,
              departureCity: ride.departure_city,
              arrivalCity: ride.arrival_city,
              departureTime: ride.departure_time,
              otherUserId: ride.driver_id,
              otherUserName: profile.full_name || 'Driver',
              otherUserAvatar: profile.avatar_url,
              role: 'passenger',
            });
          }
        }
      }

      // Sort by most recent first, limit to 3
      results.sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());
      setUnratedRides(results.slice(0, 3));
    } catch (error) {
      console.error('Error fetching unrated rides:', error);
    }
  };

  const handleDismiss = (rideId: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(rideId);
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissed_ratings', JSON.stringify([...newDismissed]));
  };

  const visibleRides = unratedRides.filter(r => !dismissed.has(r.rideId));

  if (visibleRides.length === 0) return null;

  return (
    <div className="space-y-3 mb-8">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-400" />
        Rate your recent rides
      </h3>
      {visibleRides.map((ride) => (
        <Card key={ride.rideId} className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={ride.otherUserAvatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {ride.otherUserName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    How was your ride with <span className="text-primary">{ride.otherUserName}</span>?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ride.departureCity} → {ride.arrivalCity} •{' '}
                    {new Date(ride.departureTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(ride.rideId)}
                  className="text-muted-foreground"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/rate/${ride.rideId}`)}
                >
                  Rate
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RatingPrompt;
