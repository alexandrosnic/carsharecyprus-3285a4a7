import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, CreditCard, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import Map from '@/components/Map';

interface RideBookingData {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  driver_profile?: {
    full_name: string;
    phone_number?: string;
  };
}

const BookRide = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showWaitingForDriverNotification } = useNotifications();
  const [ride, setRide] = useState<RideBookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [seatsToBook, setSeatsToBook] = useState(1);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId, user]);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      
      // Get ride details
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('status', 'active')
        .single();

      if (rideError) throw rideError;

      // Get driver profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', rideData.driver_id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      setRide({
        ...rideData,
        driver_profile: profileData
      });
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

  const calculateTotal = () => {
    if (!ride) return 0;
    return ride.price_per_seat * seatsToBook;
  };

  const handleBooking = async () => {
    if (!user || !ride) return;

    if (seatsToBook > ride.available_seats) {
      toast.error('Not enough seats available');
      return;
    }

    setBooking(true);
    try {
      const totalAmount = calculateTotal();
      const commissionRate = 0.1; // 10% commission
      const commissionAmount = totalAmount * commissionRate;
      const driverAmount = totalAmount - commissionAmount;

      // Create booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          ride_id: ride.id,
          passenger_id: user.id,
          seats_booked: seatsToBook,
          total_amount: totalAmount,
          commission_amount: commissionAmount,
          driver_amount: driverAmount,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Update ride seats
      const { error: updateError } = await supabase
        .from('rides')
        .update({
          available_seats: ride.available_seats - seatsToBook
        })
        .eq('id', ride.id);

      if (updateError) throw updateError;

      // Create payment session
      const { data: paymentData, error: paymentError } = await supabase.functions
        .invoke('create-payment', {
          body: {
            bookingId: bookingData.id,
            amount: totalAmount,
            description: `Carpool from ${ride.departure_city} to ${ride.arrival_city}`
          }
        });

      if (paymentError) throw paymentError;

      // Redirect to Stripe Checkout
      if (paymentData?.url) {
        window.open(paymentData.url, '_blank');
      }

      // Show notification
      showWaitingForDriverNotification();

      toast.success('Booking created! Complete payment to confirm.');
      navigate('/my-trips');
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking: ' + error.message);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(`/ride/${ride.id}`)}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ride
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Book This Ride</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Ride Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Ride Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div className="flex items-center space-x-2 text-lg font-medium">
                    <span>{ride.departure_city}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{ride.arrival_city}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{time}</div>
                    <div className="text-sm text-muted-foreground">{date}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div className="font-medium">
                    Driver: {ride.driver_profile?.full_name || 'Unknown'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seats">Number of Seats</Label>
                  <Select
                    value={seatsToBook.toString()}
                    onValueChange={(value) => setSeatsToBook(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: Math.min(ride.available_seats, 4) }, (_, i) => i + 1).map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} seat{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {ride.available_seats} seats available
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Map */}
            <Card>
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

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Secure payment with Stripe</p>
                  <p className="text-sm">Complete your booking with a secure card payment</p>
                  <p className="text-sm mt-2">Payment processed after driver approval</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Price Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Price per seat:</span>
                    <span>€{ride.price_per_seat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of seats:</span>
                    <span>{seatsToBook}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>€{calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Service fee:</span>
                    <span>€0.00</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-primary">€{calculateTotal().toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={handleBooking}
                  disabled={booking}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {booking ? 'Sending Request...' : 'Send Booking Request'}
                </Button>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Your booking request will be sent to the driver</p>
                  <p>• You'll be redirected to secure payment</p>
                  <p>• Payment processed only after driver approval</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookRide;