import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Clock, Users, Star, Phone, MessageCircle, Car, DollarSign, Cigarette, PawPrint, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import Map from '@/components/Map';
import { getEstimatedDuration, formatDuration } from '@/constants/travelTimes';

interface RideDetails {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  description: string;
  status: string;
  vehicle_make: string | null;
  vehicle_color: string | null;
  smoking_allowed: boolean | null;
  pets_allowed: boolean | null;
  luggage_size: string | null;
  driver_profile?: {
    user_id: string;
    full_name: string;
    avatar_url: string;
    rating: number;
    total_rides: number;
    phone_number?: string;
  };
}

const RideDetails = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [stops, setStops] = useState<{ city: string; stop_order: number; price_from_start: number | null }[]>([]);

  useEffect(() => {
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId]);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      
      // First get the ride details
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('status', 'active')
        .single();

      if (rideError) throw rideError;

      // Then get the driver profile (using public view)
      const { data: profileData, error: profileError } = await supabase
        .from('safe_profiles')
        .select('user_id, full_name, avatar_url, rating, total_rides')
        .eq('user_id', rideData.driver_id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      setRide({
        ...rideData,
        driver_profile: profileData
      });

      // Fetch stops
      const { data: stopsData } = await supabase
        .from('ride_stops')
        .select('city, stop_order, price_from_start')
        .eq('ride_id', rideId)
        .order('stop_order', { ascending: true });

      if (stopsData) setStops(stopsData);
    } catch (error: any) {
      console.error('Error fetching ride details:', error);
      toast.error('Failed to load ride details');
      navigate('/find-ride');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timeString: string) => {
    const date = new Date(timeString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    };
  };

  const handleBookRide = () => {
    if (!user) {
      toast.error('Please sign in to book a ride');
      navigate('/auth');
      return;
    }

    if (!ride) return;

    navigate(`/book-ride/${ride.id}`);
  };

  const handleContactDriver = () => {
    if (ride?.driver_profile?.phone_number) {
      window.open(`tel:${ride.driver_profile.phone_number}`);
    } else {
      toast.error('Driver phone number not available');
    }
  };

  const handleChatDriver = () => {
    if (!user) {
      toast.error('Please sign in to chat with driver');
      return;
    }
    navigate(`/chat/${ride?.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p>Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Ride not found</h2>
          <p className="text-muted-foreground mb-4">This ride may no longer be available</p>
          <Button onClick={() => navigate('/find-ride')}>
            Back to Search
          </Button>
        </div>
      </div>
    );
  }

  const { date, time } = formatDateTime(ride.departure_time);
  const isOwnRide = user?.id === ride.driver_profile?.user_id;
  const estimatedDuration = getEstimatedDuration(ride.departure_city, ride.arrival_city);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Ride Details</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8">
          {/* Route Information */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-xl font-semibold">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{ride.departure_city}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{ride.arrival_city}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">€{ride.price_per_seat}</div>
                  <div className="text-sm text-muted-foreground">per person</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{time}</div>
                    <div className="text-sm text-muted-foreground">{date}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{ride.available_seats} seats available</div>
                    <div className="text-sm text-muted-foreground">Book your seat</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">€{ride.price_per_seat}</div>
                    <div className="text-sm text-muted-foreground">Total per passenger</div>
                  </div>
                </div>
              </div>
              {/* Estimated Duration */}
              {estimatedDuration && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Estimated trip: {formatDuration(estimatedDuration)}</span>
                </div>
              )}

              {/* Intermediate Stops */}
              {stops.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Route Stops</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{ride.departure_city}</Badge>
                    {stops.map((stop) => (
                      <React.Fragment key={stop.stop_order}>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline">
                          {stop.city}
                          {stop.price_from_start != null && (
                            <span className="ml-1 text-xs text-muted-foreground">€{stop.price_from_start}</span>
                          )}
                        </Badge>
                      </React.Fragment>
                    ))}
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="secondary">{ride.arrival_city}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle & Preferences */}
          {(ride.vehicle_make || ride.smoking_allowed || ride.pets_allowed || (ride.luggage_size && ride.luggage_size !== 'medium')) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle & Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {ride.vehicle_make && (
                    <Badge variant="outline" className="py-1 px-3">
                      <Car className="h-3 w-3 mr-1" />
                      {ride.vehicle_color} {ride.vehicle_make}
                    </Badge>
                  )}
                  {ride.smoking_allowed && (
                    <Badge variant="outline" className="py-1 px-3">
                      <Cigarette className="h-3 w-3 mr-1" />
                      Smoking OK
                    </Badge>
                  )}
                  {ride.pets_allowed && (
                    <Badge variant="outline" className="py-1 px-3">
                      <PawPrint className="h-3 w-3 mr-1" />
                      Pets OK
                    </Badge>
                  )}
                  {ride.luggage_size && (
                    <Badge variant="outline" className="py-1 px-3">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {ride.luggage_size} luggage
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-8">
            {/* Driver Information */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Driver Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={ride.driver_profile?.avatar_url} />
                      <AvatarFallback className="text-lg">
                        {ride.driver_profile?.full_name?.split(' ').map(n => n[0]).join('') || 'D'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{ride.driver_profile?.full_name || 'Unknown Driver'}</h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{ride.driver_profile?.rating?.toFixed(1) || '5.0'}</span>
                          <span className="text-muted-foreground">rating</span>
                        </div>
                        <Badge variant="secondary">
                          {ride.driver_profile?.total_rides || 0} trips completed
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {!isOwnRide && (
                    <>
                      <Separator />
                      <div className="flex space-x-4">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={handleContactDriver}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Driver
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={handleChatDriver}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              {ride.description && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Trip Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{ride.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Route Map */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Route Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <Map 
                    className="w-full h-64 rounded-lg"
                    markers={[
                      { coordinates: [33.3792, 35.1872], title: ride.departure_city, description: "Departure" },
                      { coordinates: [33.0572, 34.7582], title: ride.arrival_city, description: "Arrival" }
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Booking Section */}
            <div>
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Book This Ride</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isOwnRide ? (
                    <div className="text-center py-4">
                      <Car className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">This is your ride</p>
                      <Button 
                        variant="outline" 
                        className="mt-4 w-full"
                        onClick={() => navigate('/my-trips')}
                      >
                        Manage Ride
                      </Button>
                    </div>
                  ) : ride.available_seats === 0 ? (
                    <div className="text-center py-4">
                      <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">Ride is full</p>
                      <p className="text-sm text-muted-foreground">No seats available</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Price per seat:</span>
                          <span className="font-semibold">€{ride.price_per_seat}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Available seats:</span>
                          <span className="font-semibold">{ride.available_seats}</span>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <Button 
                        size="lg" 
                        className="w-full"
                        onClick={handleBookRide}
                        disabled={booking}
                      >
                        {booking ? 'Booking...' : 'Book This Ride'}
                      </Button>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        You'll be able to contact the driver after booking
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RideDetails;