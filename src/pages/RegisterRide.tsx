import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Car, MapPin, Calendar, Users, DollarSign, Map, Plus, Clock, Trash2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { getEstimatedDuration, formatDuration } from '@/constants/travelTimes';

interface RideFormData {
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: string;
  description: string;
  luggage_size: string;
  smoking_allowed: boolean;
  pets_allowed: boolean;
  return_ride: boolean;
  vehicle_make: string;
  vehicle_color: string;
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_end_date: string;
}

interface StopData {
  city: string;
  price_from_start: string;
}

const cities = [
  'Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia',
  'Protaras', 'Ayia Napa', 'Troodos', 'Polis', 'Paralimni'
];

const RegisterRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stops, setStops] = useState<StopData[]>([]);
  const [formData, setFormData] = useState<RideFormData>({
    departure_city: '',
    arrival_city: '',
    departure_time: '',
    available_seats: 1,
    price_per_seat: '',
    description: '',
    luggage_size: '',
    smoking_allowed: false,
    pets_allowed: false,
    return_ride: false,
    vehicle_make: '',
    vehicle_color: '',
    is_recurring: false,
    recurrence_pattern: '',
    recurrence_end_date: '',
  });

  const handleInputChange = (field: keyof RideFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addStop = () => {
    if (stops.length >= 5) {
      toast.error('Maximum 5 intermediate stops');
      return;
    }
    setStops(prev => [...prev, { city: '', price_from_start: '' }]);
  };

  const removeStop = (index: number) => {
    setStops(prev => prev.filter((_, i) => i !== index));
  };

  const updateStop = (index: number, field: keyof StopData, value: string) => {
    setStops(prev => prev.map((stop, i) => i === index ? { ...stop, [field]: value } : stop));
  };

  const estimatedDuration = formData.departure_city && formData.arrival_city
    ? getEstimatedDuration(formData.departure_city, formData.arrival_city)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to create a ride');
      return;
    }

    if (!formData.departure_city || !formData.arrival_city) {
      toast.error('Please select departure and destination cities');
      return;
    }

    if (!formData.departure_time) {
      toast.error('Please select departure date and time');
      return;
    }

    if (!formData.price_per_seat || parseFloat(formData.price_per_seat) <= 0) {
      toast.error('Please enter a valid price per seat');
      return;
    }

    setLoading(true);
    try {
      // Create the ride
      const { data: rideData, error } = await supabase
        .from('rides')
        .insert({
          driver_id: user.id,
          departure_city: formData.departure_city,
          arrival_city: formData.arrival_city,
          departure_time: formData.departure_time,
          available_seats: formData.available_seats,
          price_per_seat: parseFloat(formData.price_per_seat),
          description: formData.description,
          status: 'active',
          vehicle_make: formData.vehicle_make || null,
          vehicle_color: formData.vehicle_color || null,
          smoking_allowed: formData.smoking_allowed,
          pets_allowed: formData.pets_allowed,
          luggage_size: formData.luggage_size || 'medium',
          is_recurring: formData.is_recurring,
          recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
          recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Insert intermediate stops
      if (stops.length > 0 && rideData) {
        const validStops = stops.filter(s => s.city);
        if (validStops.length > 0) {
          const { error: stopsError } = await supabase
            .from('ride_stops')
            .insert(
              validStops.map((stop, index) => ({
                ride_id: rideData.id,
                city: stop.city,
                stop_order: index + 1,
                price_from_start: stop.price_from_start ? parseFloat(stop.price_from_start) : null,
              }))
            );

          if (stopsError) {
            console.error('Error creating stops:', stopsError);
            toast.error('Ride created but failed to add stops');
          }
        }
      }

      // If recurring, create future rides
      if (formData.is_recurring && formData.recurrence_pattern && formData.recurrence_end_date) {
        await createRecurringRides(rideData.id);
      }

      toast.success('Ride created successfully!');
      navigate('/my-trips');
    } catch (error: any) {
      console.error('Error creating ride:', error);
      toast.error('Failed to create ride: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createRecurringRides = async (originalRideId: string) => {
    if (!user) return;

    const baseDate = new Date(formData.departure_time);
    const endDate = new Date(formData.recurrence_end_date);
    const rides: any[] = [];
    let currentDate = new Date(baseDate);

    const getNextDate = (date: Date): Date => {
      const next = new Date(date);
      switch (formData.recurrence_pattern) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekdays':
          next.setDate(next.getDate() + 1);
          while (next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
          }
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
      }
      return next;
    };

    currentDate = getNextDate(currentDate);

    while (currentDate <= endDate && rides.length < 30) { // Max 30 recurring rides
      rides.push({
        driver_id: user.id,
        departure_city: formData.departure_city,
        arrival_city: formData.arrival_city,
        departure_time: currentDate.toISOString(),
        available_seats: formData.available_seats,
        price_per_seat: parseFloat(formData.price_per_seat),
        description: formData.description,
        status: 'active',
        vehicle_make: formData.vehicle_make || null,
        vehicle_color: formData.vehicle_color || null,
        smoking_allowed: formData.smoking_allowed,
        pets_allowed: formData.pets_allowed,
        luggage_size: formData.luggage_size || 'medium',
        is_recurring: true,
        recurrence_pattern: formData.recurrence_pattern,
      });
      currentDate = getNextDate(currentDate);
    }

    if (rides.length > 0) {
      const { error } = await supabase.from('rides').insert(rides);
      if (error) {
        console.error('Error creating recurring rides:', error);
        toast.error('Failed to create some recurring rides');
      } else {
        toast.success(`Created ${rides.length} additional recurring rides`);
      }
    }
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Register a Ride</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Route Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Route Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departure">From *</Label>
                  <Select value={formData.departure_city} onValueChange={(value) => handleInputChange('departure_city', value)}>
                    <SelectTrigger><SelectValue placeholder="Select departure city" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination">To *</Label>
                  <Select value={formData.arrival_city} onValueChange={(value) => handleInputChange('arrival_city', value)}>
                    <SelectTrigger><SelectValue placeholder="Select destination city" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estimated Duration */}
              {estimatedDuration && (
                <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Estimated trip duration: {formatDuration(estimatedDuration)}
                  </span>
                </div>
              )}

              {/* Intermediate Stops */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Intermediate Stops (optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStop}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Stop
                  </Button>
                </div>

                {stops.length > 0 && (
                  <div className="space-y-3">
                    {stops.map((stop, index) => (
                      <div key={index} className="flex items-end gap-3 p-3 border rounded-lg">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Stop {index + 1}</Label>
                          <Select value={stop.city} onValueChange={(value) => updateStop(index, 'city', value)}>
                            <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                            <SelectContent>
                              {cities
                                .filter(c => c !== formData.departure_city && c !== formData.arrival_city)
                                .map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-xs">Price (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={stop.price_from_start}
                            onChange={(e) => updateStop(index, 'price_from_start', e.target.value)}
                            placeholder="€"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeStop(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Set pickup price from departure for each stop. Passengers can book from any stop.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trip Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Trip Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departure_time">Departure Date & Time *</Label>
                  <Input
                    id="departure_time"
                    type="datetime-local"
                    value={formData.departure_time}
                    onChange={(e) => handleInputChange('departure_time', e.target.value)}
                    min={getTomorrow()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seats">Available Seats *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Select value={formData.available_seats.toString()} onValueChange={(value) => handleInputChange('available_seats', parseInt(value))}>
                      <SelectTrigger className="pl-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num} seat{num > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price per Seat (€) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="price" type="number" step="0.01" min="0" value={formData.price_per_seat} onChange={(e) => handleInputChange('price_per_seat', e.target.value)} className="pl-9" placeholder="15.00" required />
                </div>
                <p className="text-sm text-muted-foreground">Set a fair price considering fuel, tolls, and your time</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Add any additional information about your ride..." rows={3} />
              </div>

              {/* Recurring Ride */}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => handleInputChange('is_recurring', checked as boolean)}
                  />
                  <Label htmlFor="is_recurring" className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    This is a recurring ride
                  </Label>
                </div>

                {formData.is_recurring && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select value={formData.recurrence_pattern} onValueChange={(value) => handleInputChange('recurrence_pattern', value)}>
                        <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Every day</SelectItem>
                          <SelectItem value="weekdays">Weekdays only (Mon-Fri)</SelectItem>
                          <SelectItem value="weekly">Once a week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Until</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => handleInputChange('recurrence_end_date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground col-span-full">
                      Up to 30 rides will be auto-created. Each ride will have the same route, time, and preferences.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vehicle & Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Car className="h-5 w-5 mr-2" />
                Vehicle & Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_make">Vehicle Make/Model</Label>
                  <Input id="vehicle_make" value={formData.vehicle_make} onChange={(e) => handleInputChange('vehicle_make', e.target.value)} placeholder="e.g. Toyota Yaris" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_color">Vehicle Color</Label>
                  <Input id="vehicle_color" value={formData.vehicle_color} onChange={(e) => handleInputChange('vehicle_color', e.target.value)} placeholder="e.g. White" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="luggage">Luggage Size Allowed</Label>
                <Select value={formData.luggage_size} onValueChange={(value) => handleInputChange('luggage_size', value)}>
                  <SelectTrigger><SelectValue placeholder="Select luggage size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (backpack only)</SelectItem>
                    <SelectItem value="medium">Medium (small suitcase)</SelectItem>
                    <SelectItem value="large">Large (multiple bags allowed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Trip Preferences</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="return_ride" checked={formData.return_ride} onCheckedChange={(checked) => handleInputChange('return_ride', checked as boolean)} />
                    <Label htmlFor="return_ride">This is a return ride</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="smoking" checked={formData.smoking_allowed} onCheckedChange={(checked) => handleInputChange('smoking_allowed', checked as boolean)} />
                    <Label htmlFor="smoking">Smoking allowed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pets" checked={formData.pets_allowed} onCheckedChange={(checked) => handleInputChange('pets_allowed', checked as boolean)} />
                    <Label htmlFor="pets">Pets allowed</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col space-y-4">
                <Button type="submit" size="lg" disabled={loading} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? 'Creating Ride...' : 'Create Ride'}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  By creating this ride, you agree to pick up passengers as scheduled and follow our community guidelines.
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
};

export default RegisterRide;
