import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, MapPin, Clock, Users, Star, CheckCircle, XCircle, AlertCircle, Ban } from 'lucide-react';
import { BRAND_LOGO } from '@/constants/brand';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';

interface Trip {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  status: string;
  type: 'driver' | 'passenger';
  booking_status?: string;
  seats_booked?: number;
  total_amount?: number;
  other_party?: {
    full_name: string;
    avatar_url: string;
    rating: number;
  };
}

const MyTrips = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showDriverAcceptedNotification } = useNotifications();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    if (user) {
      fetchTrips();
    }
  }, [user]);

  const fetchTrips = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch rides where user is the driver
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .order('departure_time', { ascending: true });

      if (driverError) throw driverError;

      // Fetch bookings where user is the passenger
      const { data: passengerBookings, error: passengerError } = await supabase
        .from('bookings')
        .select(`
          *,
          rides (
            departure_city,
            arrival_city,
            departure_time,
            price_per_seat,
            driver_id
          )
        `)
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false });

      if (passengerError) throw passengerError;

      // Get driver profiles for passenger bookings (using public view)
      const driverIds = passengerBookings?.map(booking => (booking.rides as any)?.driver_id).filter(Boolean) || [];
      const { data: driverProfiles } = await supabase
        .from('safe_profiles')
        .select('user_id, full_name, avatar_url, rating')
        .in('user_id', driverIds);

      // Get passenger profiles for driver rides (if there are bookings)
      const rideIds = driverRides?.map(ride => ride.id) || [];
      const { data: rideBookings } = await supabase
        .from('bookings')
        .select(`
          ride_id,
          passenger_id,
          status,
          profiles (
            user_id,
            full_name,
            avatar_url,
            rating
          )
        `)
        .in('ride_id', rideIds);

      // Process driver rides
      const driverTrips: Trip[] = driverRides?.map(ride => ({
        id: ride.id,
        departure_city: ride.departure_city,
        arrival_city: ride.arrival_city,
        departure_time: ride.departure_time,
        available_seats: ride.available_seats,
        price_per_seat: ride.price_per_seat,
        status: ride.status,
        type: 'driver'
      })) || [];

      // Process passenger bookings
      const passengerTrips: Trip[] = passengerBookings?.map(booking => {
        const ride = booking.rides as any;
        const driver = driverProfiles?.find(p => p.user_id === ride?.driver_id);
        
        return {
          id: booking.id,
          departure_city: ride?.departure_city || '',
          arrival_city: ride?.arrival_city || '',
          departure_time: ride?.departure_time || '',
          available_seats: 0,
          price_per_seat: ride?.price_per_seat || 0,
          status: ride?.status || 'active',
          type: 'passenger',
          booking_status: booking.status,
          seats_booked: booking.seats_booked,
          total_amount: booking.total_amount,
          other_party: driver ? {
            full_name: driver.full_name,
            avatar_url: driver.avatar_url,
            rating: driver.rating
          } : undefined
        };
      }) || [];

      setTrips([...driverTrips, ...passengerTrips]);
    } catch (error: any) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (error) throw error;

      showDriverAcceptedNotification();
      toast.success('Booking accepted!');
      fetchTrips();
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      toast.error('Failed to accept booking');
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .eq('id', bookingId);

      if (error) throw error;

      toast.success('Booking rejected');
      fetchTrips();
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      toast.error('Failed to reject booking');
    }
  };

  const formatDateTime = (timeString: string) => {
    const date = new Date(timeString);
    const now = new Date();
    const isUpcoming = date > now;
    
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      isUpcoming
    };
  };

  const getStatusBadge = (trip: Trip) => {
    if (trip.type === 'passenger') {
      switch (trip.booking_status) {
        case 'pending':
          return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
        case 'confirmed':
          return <Badge variant="outline" className="text-green-600 border-green-600">Confirmed</Badge>;
        case 'rejected':
          return <Badge variant="outline" className="text-red-600 border-red-600">Rejected</Badge>;
        case 'completed':
          return <Badge variant="outline" className="text-blue-600 border-blue-600">Completed</Badge>;
        default:
          return <Badge variant="outline">Unknown</Badge>;
      }
    } else {
      switch (trip.status) {
        case 'active':
          return <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>;
        case 'completed':
          return <Badge variant="outline" className="text-blue-600 border-blue-600">Completed</Badge>;
        case 'cancelled':
          return <Badge variant="outline" className="text-red-600 border-red-600">Cancelled</Badge>;
        default:
          return <Badge variant="outline">Unknown</Badge>;
      }
    }
  };

  const upcomingTrips = trips.filter(trip => {
    const { isUpcoming } = formatDateTime(trip.departure_time);
    return isUpcoming;
  });

  const pastTrips = trips.filter(trip => {
    const { isUpcoming } = formatDateTime(trip.departure_time);
    return !isUpcoming;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img 
            src={BRAND_LOGO} 
            alt="Car Share Cyprus Logo" 
            className="h-12 w-12 animate-spin mx-auto mb-4" 
          />
          <p>Loading your trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold text-foreground">My Trips</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming Trips ({upcomingTrips.length})</TabsTrigger>
            <TabsTrigger value="past">Past Trips ({pastTrips.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {upcomingTrips.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <img 
                    src={BRAND_LOGO} 
                    alt="Car Share Cyprus Logo" 
                    className="h-16 w-16 mx-auto mb-4 opacity-50" 
                  />
                  <h3 className="text-xl font-semibold mb-2">No upcoming trips</h3>
                  <p className="text-muted-foreground mb-6">
                    Start planning your next journey
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => navigate('/find-ride')}>
                      Find a Ride
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/register-ride')}>
                      Offer a Ride
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingTrips.map((trip) => {
                  const { date, time } = formatDateTime(trip.departure_time);
                  
                  return (
                    <Card key={trip.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-2">
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{trip.departure_city}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">{trip.arrival_city}</span>
                              </div>
                              <Badge variant={trip.type === 'driver' ? 'default' : 'secondary'}>
                                {trip.type === 'driver' ? 'Driving' : 'Passenger'}
                              </Badge>
                              {getStatusBadge(trip)}
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4" />
                                <span>{time} • {date}</span>
                              </div>
                              {trip.type === 'passenger' && trip.seats_booked && (
                                <div className="flex items-center space-x-1">
                                  <Users className="h-4 w-4" />
                                  <span>{trip.seats_booked} seat{trip.seats_booked > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {trip.other_party && (
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="font-medium">{trip.other_party.full_name}</div>
                                <div className="flex items-center space-x-1 text-sm">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span>{trip.other_party.rating?.toFixed(1) || '5.0'}</span>
                                </div>
                              </div>
                              <Avatar>
                                <AvatarImage src={trip.other_party.avatar_url} />
                                <AvatarFallback>
                                  {trip.other_party.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}

                          <div className="text-right ml-6">
                            <div className="text-lg font-bold text-primary">
                              €{trip.type === 'passenger' ? trip.total_amount?.toFixed(2) : trip.price_per_seat}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {trip.type === 'passenger' ? 'total paid' : 'per seat'}
                            </div>
                          </div>
                        </div>

                        {trip.type === 'driver' && trip.booking_status === 'pending' && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span>Pending booking request</span>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleRejectBooking(trip.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => handleAcceptBooking(trip.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastTrips.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <img 
                    src={BRAND_LOGO} 
                    alt="Car Share Cyprus Logo" 
                    className="h-16 w-16 mx-auto mb-4 opacity-50" 
                  />
                  <h3 className="text-xl font-semibold mb-2">No past trips</h3>
                  <p className="text-muted-foreground">
                    Your completed trips will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastTrips.map((trip) => {
                  const { date, time } = formatDateTime(trip.departure_time);
                  
                  return (
                    <Card key={trip.id} className="opacity-75">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-2">
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{trip.departure_city}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">{trip.arrival_city}</span>
                              </div>
                              <Badge variant={trip.type === 'driver' ? 'default' : 'secondary'}>
                                {trip.type === 'driver' ? 'Drove' : 'Passenger'}
                              </Badge>
                              {getStatusBadge(trip)}
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4" />
                                <span>{time} • {date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-bold text-muted-foreground">
                              €{trip.type === 'passenger' ? trip.total_amount?.toFixed(2) : trip.price_per_seat}
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => navigate(`/rate/${trip.id}`)}
                            >
                              Rate {trip.type === 'driver' ? 'Passenger' : 'Driver'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MyTrips;