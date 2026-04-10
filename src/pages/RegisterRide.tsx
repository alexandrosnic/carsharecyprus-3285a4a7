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
import { ArrowLeft, Car, MapPin, Calendar, Users, Euro, Plus, Clock, Trash2, Repeat, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getEstimatedDuration, formatDuration } from '@/constants/travelTimes';
import LocationInput, { LocationResult } from '@/components/LocationInput';
import ClickableMap, { MapMarkerData } from '@/components/ClickableMap';

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
  return_time: string;
  vehicle_make: string;
  vehicle_color: string;
  is_recurring: boolean;
  recurrence_pattern: string;
  recurrence_end_date: string;
  custom_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface StopData {
  city: string;
  price_from_start: string;
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RegisterRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stops, setStops] = useState<StopData[]>([]);
  const [departureCoords, setDepartureCoords] = useState<[number, number] | null>(null);
  const [arrivalCoords, setArrivalCoords] = useState<[number, number] | null>(null);
  const [mapSelectMode, setMapSelectMode] = useState<string | null>(null);
  const [stopCoords, setStopCoords] = useState<Array<[number, number] | null>>([]);
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
    return_time: '',
    vehicle_make: '',
    vehicle_color: '',
    is_recurring: false,
    recurrence_pattern: '',
    recurrence_end_date: '',
    custom_days: [],
  });

  const handleInputChange = (field: keyof RideFormData, value: string | number | boolean | number[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCustomDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      custom_days: prev.custom_days.includes(day)
        ? prev.custom_days.filter(d => d !== day)
        : [...prev.custom_days, day].sort(),
    }));
  };

  const addStop = () => {
    if (stops.length >= 5) { toast.error('Maximum 5 intermediate stops'); return; }
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

  const buildRidePayload = (overrides: Partial<{
    departure_city: string; arrival_city: string; departure_time: string;
  }> = {}) => ({
    driver_id: user!.id,
    departure_city: overrides.departure_city ?? formData.departure_city,
    arrival_city: overrides.arrival_city ?? formData.arrival_city,
    departure_time: overrides.departure_time ?? formData.departure_time,
    available_seats: formData.available_seats,
    price_per_seat: parseFloat(formData.price_per_seat),
    description: formData.description,
    status: 'active' as const,
    vehicle_make: formData.vehicle_make || null,
    vehicle_color: formData.vehicle_color || null,
    smoking_allowed: formData.smoking_allowed,
    pets_allowed: formData.pets_allowed,
    luggage_size: formData.luggage_size || 'medium',
    is_recurring: false,
    recurrence_pattern: null as string | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('You must be logged in to create a ride'); return; }
    if (!formData.departure_city || !formData.arrival_city) { toast.error('Please select departure and destination'); return; }
    if (!formData.departure_time) { toast.error('Please select departure date and time'); return; }
    if (!formData.price_per_seat || parseFloat(formData.price_per_seat) <= 0) { toast.error('Please enter a valid price per seat'); return; }
    if (formData.return_ride && !formData.return_time) { toast.error('Please select a return time'); return; }
    if (formData.is_recurring && formData.recurrence_pattern === 'custom' && formData.custom_days.length === 0) {
      toast.error('Please select at least one day for custom recurrence'); return;
    }

    setLoading(true);
    try {
      // Create main ride
      const mainPayload = buildRidePayload();
      mainPayload.is_recurring = formData.is_recurring;
      mainPayload.recurrence_pattern = formData.is_recurring ? formData.recurrence_pattern : null;

      const { data: rideData, error } = await supabase
        .from('rides')
        .insert({
          ...mainPayload,
          recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Insert intermediate stops
      if (stops.length > 0 && rideData) {
        const validStops = stops.filter(s => s.city);
        if (validStops.length > 0) {
          const { error: stopsError } = await supabase.from('ride_stops').insert(
            validStops.map((stop, index) => ({
              ride_id: rideData.id,
              city: stop.city,
              stop_order: index + 1,
              price_from_start: stop.price_from_start ? parseFloat(stop.price_from_start) : null,
            }))
          );
          if (stopsError) { console.error('Error creating stops:', stopsError); toast.error('Ride created but failed to add stops'); }
        }
      }

      // Create recurring rides
      if (formData.is_recurring && formData.recurrence_pattern && formData.recurrence_end_date) {
        await createRecurringRides();
      }

      // Create return ride
      if (formData.return_ride && formData.return_time) {
        await createReturnRide();
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

  const createReturnRide = async () => {
    if (!user) return;
    // Build return time: same date as departure but with return_time
    const departureDate = new Date(formData.departure_time);
    const [hours, minutes] = formData.return_time.split(':').map(Number);
    const returnDate = new Date(departureDate);
    returnDate.setHours(hours, minutes, 0, 0);

    // If return time is before departure, assume next day
    if (returnDate <= departureDate) {
      returnDate.setDate(returnDate.getDate() + 1);
    }

    const returnPayload = buildRidePayload({
      departure_city: formData.arrival_city,
      arrival_city: formData.departure_city,
      departure_time: returnDate.toISOString(),
    });

    const { error } = await supabase.from('rides').insert(returnPayload);
    if (error) {
      console.error('Error creating return ride:', error);
      toast.error('Main ride created but failed to create return ride');
    } else {
      toast.success('Return ride also created!');
    }
  };

  const createRecurringRides = async () => {
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
          while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'custom':
          // Advance day-by-day until we hit one of the selected days
          next.setDate(next.getDate() + 1);
          let guard = 0;
          while (!formData.custom_days.includes(next.getDay()) && guard < 8) {
            next.setDate(next.getDate() + 1);
            guard++;
          }
          break;
      }
      return next;
    };

    currentDate = getNextDate(currentDate);

    while (currentDate <= endDate && rides.length < 30) {
      const payload = buildRidePayload({ departure_time: currentDate.toISOString() });
      payload.is_recurring = true;
      payload.recurrence_pattern = formData.recurrence_pattern;
      rides.push(payload);
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

      // If return ride is also enabled, create return rides for each recurring
      if (formData.return_ride && formData.return_time) {
        const returnRides = rides.map(r => {
          const depDate = new Date(r.departure_time);
          const [h, m] = formData.return_time.split(':').map(Number);
          const retDate = new Date(depDate);
          retDate.setHours(h, m, 0, 0);
          if (retDate <= depDate) retDate.setDate(retDate.getDate() + 1);
          return buildRidePayload({
            departure_city: formData.arrival_city,
            arrival_city: formData.departure_city,
            departure_time: retDate.toISOString(),
          });
        });
        const { error: retErr } = await supabase.from('rides').insert(returnRides);
        if (retErr) console.error('Error creating recurring return rides:', retErr);
      }
    }
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
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
              {/* Persistent Route Map */}
              <ClickableMap
                className="w-full h-56 rounded-lg border border-border"
                departureCoords={departureCoords}
                arrivalCoords={arrivalCoords}
                departureLabel={formData.departure_city}
                arrivalLabel={formData.arrival_city}
                stopMarkers={stopCoords.reduce<MapMarkerData[]>((acc, c, i) => {
                  if (c && stops[i]?.city) acc.push({ coordinates: c, label: `Stop ${i + 1}: ${stops[i].city}`, color: '#f59e0b' });
                  return acc;
                }, [])}
                selectingMode={mapSelectMode}
                onSelectingModeChange={setMapSelectMode}
                onLocationPicked={(address, coords) => {
                  if (mapSelectMode === 'departure') {
                    handleInputChange('departure_city', address);
                    setDepartureCoords(coords);
                  } else if (mapSelectMode === 'arrival') {
                    handleInputChange('arrival_city', address);
                    setArrivalCoords(coords);
                  } else if (mapSelectMode?.startsWith('stop-')) {
                    const idx = parseInt(mapSelectMode.replace('stop-', ''));
                    updateStop(idx, 'city', address);
                    setStopCoords(prev => {
                      const next = [...prev];
                      next[idx] = coords;
                      return next;
                    });
                  }
                }}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From *</Label>
                  <LocationInput
                    value={formData.departure_city}
                    onChange={(val, result) => {
                      handleInputChange('departure_city', val);
                      setDepartureCoords(result?.coordinates || null);
                    }}
                    placeholder="Type city or address..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>To *</Label>
                  <LocationInput
                    value={formData.arrival_city}
                    onChange={(val, result) => {
                      handleInputChange('arrival_city', val);
                      setArrivalCoords(result?.coordinates || null);
                    }}
                    placeholder="Type destination or address..."
                  />
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
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    addStop();
                    setStopCoords(prev => [...prev, null]);
                  }}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Stop
                  </Button>
                </div>

                {stops.length > 0 && (
                  <div className="space-y-3">
                    {stops.map((stop, index) => (
                      <div key={index} className="p-3 border border-border rounded-lg space-y-2">
                        <div className="flex items-end gap-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Stop {index + 1}</Label>
                            <LocationInput
                              value={stop.city}
                              onChange={(val, result) => {
                                updateStop(index, 'city', val);
                                setStopCoords(prev => {
                                  const next = [...prev];
                                  next[index] = result?.coordinates || null;
                                  return next;
                                });
                              }}
                              placeholder="Type stop city or address..."
                            />
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
                          <Button type="button" variant="ghost" size="sm" onClick={() => {
                            removeStop(index);
                            setStopCoords(prev => prev.filter((_, i) => i !== index));
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant={mapSelectMode === `stop-${index}` ? 'default' : 'outline'}
                          size="sm"
                          className="w-full"
                          onClick={() => setMapSelectMode(mapSelectMode === `stop-${index}` ? null : `stop-${index}`)}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {mapSelectMode === `stop-${index}` ? 'Click on the map...' : 'Pick on map'}
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
                  <Label>Departure Date *</Label>
                  <Input
                    type="date"
                    value={formData.departure_time ? formData.departure_time.split('T')[0] : ''}
                    onChange={(e) => {
                      const currentTime = formData.departure_time ? formData.departure_time.split('T')[1] || '08:00' : '08:00';
                      handleInputChange('departure_time', e.target.value ? `${e.target.value}T${currentTime}` : '');
                    }}
                    min={getTomorrow().split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departure Time *</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={formData.departure_time ? formData.departure_time.split('T')[1]?.split(':')[0] || '08' : ''}
                      onValueChange={(h) => {
                        const date = formData.departure_time ? formData.departure_time.split('T')[0] : '';
                        const min = formData.departure_time ? formData.departure_time.split('T')[1]?.split(':')[1] || '00' : '00';
                        if (date) handleInputChange('departure_time', `${date}T${h}:${min}`);
                      }}
                    >
                      <SelectTrigger className="w-20"><SelectValue placeholder="HH" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-lg font-bold">:</span>
                    <Select
                      value={formData.departure_time ? formData.departure_time.split('T')[1]?.split(':')[1] || '00' : ''}
                      onValueChange={(m) => {
                        const date = formData.departure_time ? formData.departure_time.split('T')[0] : '';
                        const hr = formData.departure_time ? formData.departure_time.split('T')[1]?.split(':')[0] || '08' : '08';
                        if (date) handleInputChange('departure_time', `${date}T${hr}:${m}`);
                      }}
                    >
                      <SelectTrigger className="w-20"><SelectValue placeholder="MM" /></SelectTrigger>
                      <SelectContent>
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <Euro className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="price" type="number" step="0.01" min="0" value={formData.price_per_seat} onChange={(e) => handleInputChange('price_per_seat', e.target.value)} className="pl-9" placeholder="15.00" required />
                </div>
                <p className="text-sm text-muted-foreground">This is the price passengers will pay per seat.</p>
                {formData.price_per_seat && parseFloat(formData.price_per_seat) > 0 && (
                  <div className="p-3 bg-accent/50 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Passenger pays:</span>
                      <span className="font-medium">€{parseFloat(formData.price_per_seat).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform fee (10%):</span>
                      <span className="font-medium text-destructive">−€{(parseFloat(formData.price_per_seat) * 0.10).toFixed(2)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>You'll earn:</span>
                      <span className="text-primary">€{(parseFloat(formData.price_per_seat) * 0.90).toFixed(2)}</span>
                    </div>
                  </div>
                )}
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
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select value={formData.recurrence_pattern} onValueChange={(value) => handleInputChange('recurrence_pattern', value)}>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Every day</SelectItem>
                            <SelectItem value="weekdays">Weekdays only (Mon-Fri)</SelectItem>
                            <SelectItem value="weekly">Once a week</SelectItem>
                            <SelectItem value="custom">Custom days</SelectItem>
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
                    </div>

                    {/* Custom days picker */}
                    {formData.recurrence_pattern === 'custom' && (
                      <div className="space-y-2">
                        <Label>Select days</Label>
                        <div className="flex flex-wrap gap-2">
                          {dayLabels.map((label, idx) => (
                            <Button
                              key={idx}
                              type="button"
                              variant={formData.custom_days.includes(idx) ? 'default' : 'outline'}
                              size="sm"
                              className="w-12"
                              onClick={() => toggleCustomDay(idx)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        {formData.custom_days.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Rides will repeat every {formData.custom_days.map(d => dayLabels[d]).join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
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
                  {/* Return Ride */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="return_ride" checked={formData.return_ride} onCheckedChange={(checked) => handleInputChange('return_ride', checked as boolean)} />
                      <Label htmlFor="return_ride" className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Add a return ride
                      </Label>
                    </div>
                    {formData.return_ride && (
                      <div className="pl-6 border-l-2 border-primary/20 space-y-2">
                        <Label htmlFor="return_time">Return time</Label>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={formData.return_time ? formData.return_time.split(':')[0] : ''}
                            onValueChange={(h) => {
                              const min = formData.return_time ? formData.return_time.split(':')[1] || '00' : '00';
                              handleInputChange('return_time', `${h}:${min}`);
                            }}
                          >
                            <SelectTrigger className="w-20"><SelectValue placeholder="HH" /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-lg font-bold">:</span>
                          <Select
                            value={formData.return_time ? formData.return_time.split(':')[1] || '00' : ''}
                            onValueChange={(m) => {
                              const hr = formData.return_time ? formData.return_time.split(':')[0] || '08' : '08';
                              handleInputChange('return_time', `${hr}:${m}`);
                            }}
                          >
                            <SelectTrigger className="w-20"><SelectValue placeholder="MM" /></SelectTrigger>
                            <SelectContent>
                              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          A return ride ({formData.arrival_city || '...'} → {formData.departure_city || '...'}) will be created at this time on the same day.
                        </p>
                      </div>
                    )}
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
