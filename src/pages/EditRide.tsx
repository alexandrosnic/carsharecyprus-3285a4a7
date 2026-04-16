import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Car, MapPin, Calendar, Users, Euro, Plus, Clock, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getEstimatedDuration, formatDuration, getEstimatedDistanceKm, getMaxPricePerSeat, MAX_PRICE_PER_KM } from '@/constants/travelTimes';
import LocationInput, { LocationResult } from '@/components/LocationInput';
import ClickableMap, { MapMarkerData } from '@/components/ClickableMap';

interface StopData {
  city: string;
  price_from_start: string;
}

const EditRide = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [stops, setStops] = useState<StopData[]>([]);
  const [departureCoords, setDepartureCoords] = useState<[number, number] | null>(null);
  const [arrivalCoords, setArrivalCoords] = useState<[number, number] | null>(null);
  const [mapSelectMode, setMapSelectMode] = useState<string | null>(null);
  const [stopCoords, setStopCoords] = useState<Array<[number, number] | null>>([]);

  const [formData, setFormData] = useState({
    departure_city: '',
    arrival_city: '',
    departure_time: '',
    available_seats: 1,
    price_per_seat: '',
    description: '',
    luggage_size: '',
    smoking_allowed: false,
    pets_allowed: false,
    vehicle_make: '',
    vehicle_color: '',
  });

  useEffect(() => {
    if (rideId && user) fetchRide();
  }, [rideId, user]);

  const fetchRide = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', user!.id)
        .single();

      if (error) throw error;

      // Convert departure_time from ISO to local datetime format
      const dt = new Date(data.departure_time);
      const localDT = `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2,'0')}-${dt.getDate().toString().padStart(2,'0')}T${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;

      setFormData({
        departure_city: data.departure_city,
        arrival_city: data.arrival_city,
        departure_time: localDT,
        available_seats: data.available_seats,
        price_per_seat: data.price_per_seat.toString(),
        description: data.description || '',
        luggage_size: data.luggage_size || 'medium',
        smoking_allowed: data.smoking_allowed || false,
        pets_allowed: data.pets_allowed || false,
        vehicle_make: data.vehicle_make || '',
        vehicle_color: data.vehicle_color || '',
      });

      // Fetch stops
      const { data: stopsData } = await supabase
        .from('ride_stops')
        .select('city, stop_order, price_from_start')
        .eq('ride_id', rideId)
        .order('stop_order', { ascending: true });

      if (stopsData && stopsData.length > 0) {
        setStops(stopsData.map(s => ({
          city: s.city,
          price_from_start: s.price_from_start?.toString() || '',
        })));
        setStopCoords(stopsData.map(() => null));
      }
    } catch (error: any) {
      console.error('Error fetching ride:', error);
      toast.error('Failed to load ride');
      navigate('/my-trips');
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addStop = () => {
    if (stops.length >= 5) { toast.error('Maximum 5 intermediate stops'); return; }
    setStops(prev => [...prev, { city: '', price_from_start: '' }]);
    setStopCoords(prev => [...prev, null]);
  };

  const removeStop = (index: number) => {
    setStops(prev => prev.filter((_, i) => i !== index));
    setStopCoords(prev => prev.filter((_, i) => i !== index));
  };

  const updateStop = (index: number, field: keyof StopData, value: string) => {
    setStops(prev => prev.map((stop, i) => i === index ? { ...stop, [field]: value } : stop));
  };

  const estimatedDuration = formData.departure_city && formData.arrival_city
    ? getEstimatedDuration(formData.departure_city, formData.arrival_city)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rideId) return;
    if (!formData.departure_city || !formData.arrival_city) { toast.error('Please select departure and destination'); return; }
    if (!formData.departure_time) { toast.error('Please select departure date and time'); return; }
    if (!formData.price_per_seat || parseFloat(formData.price_per_seat) <= 0) { toast.error('Please enter a valid price'); return; }
    const maxPrice = getMaxPricePerSeat(formData.departure_city, formData.arrival_city);
    if (maxPrice != null && parseFloat(formData.price_per_seat) > maxPrice) {
      toast.error(`Price per seat cannot exceed €${maxPrice.toFixed(2)} (€${MAX_PRICE_PER_KM}/km cost-sharing limit)`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          departure_city: formData.departure_city,
          arrival_city: formData.arrival_city,
          departure_time: new Date(formData.departure_time).toISOString(),
          available_seats: formData.available_seats,
          price_per_seat: parseFloat(formData.price_per_seat),
          description: formData.description || null,
          vehicle_make: formData.vehicle_make || null,
          vehicle_color: formData.vehicle_color || null,
          smoking_allowed: formData.smoking_allowed,
          pets_allowed: formData.pets_allowed,
          luggage_size: formData.luggage_size || 'medium',
        })
        .eq('id', rideId)
        .eq('driver_id', user.id);

      if (error) throw error;

      // Update stops: delete old, insert new
      await supabase.from('ride_stops').delete().eq('ride_id', rideId);

      const validStops = stops.filter(s => s.city);
      if (validStops.length > 0) {
        const { error: stopsError } = await supabase.from('ride_stops').insert(
          validStops.map((stop, index) => ({
            ride_id: rideId,
            city: stop.city,
            stop_order: index + 1,
            price_from_start: stop.price_from_start ? parseFloat(stop.price_from_start) : null,
          }))
        );
        if (stopsError) console.error('Error updating stops:', stopsError);
      }

      toast.success('Ride updated successfully!');
      navigate('/my-trips');
    } catch (error: any) {
      console.error('Error updating ride:', error);
      toast.error('Failed to update ride: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p>Loading ride...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-trips')} className="flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Trips
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Edit Ride</h1>
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
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeStop(index)}>
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
                  <Label>Available Seats *</Label>
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

              {(() => {
                const maxPrice = getMaxPricePerSeat(formData.departure_city, formData.arrival_city);
                const km = getEstimatedDistanceKm(formData.departure_city, formData.arrival_city);
                const currentPrice = parseFloat(formData.price_per_seat);
                const overLimit = maxPrice != null && currentPrice > maxPrice;
                return (
                  <div className="space-y-2">
                    <Label>Price per Seat (€) *</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input type="number" step="0.01" min="0" max={maxPrice ?? undefined} value={formData.price_per_seat} onChange={(e) => handleInputChange('price_per_seat', e.target.value)} className="pl-9" placeholder="15.00" required />
                    </div>
                    {maxPrice != null && (
                      <p className={`text-sm ${overLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        Cost-sharing limit: max €{maxPrice.toFixed(2)} per seat (~{km} km × €{MAX_PRICE_PER_KM.toFixed(2)}/km).
                      </p>
                    )}
                    {formData.price_per_seat && currentPrice > 0 && (
                      <div className="p-3 bg-accent/50 rounded-lg space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Passenger pays:</span>
                          <span className="font-medium">€{currentPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Platform fee (10%):</span>
                          <span className="font-medium text-destructive">−€{(currentPrice * 0.10).toFixed(2)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>You'll earn:</span>
                          <span className="text-primary">€{(currentPrice * 0.90).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Add any additional information about your ride..." rows={3} />
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
                  <Label>Vehicle Make/Model</Label>
                  <Input value={formData.vehicle_make} onChange={(e) => handleInputChange('vehicle_make', e.target.value)} placeholder="e.g. Toyota Yaris" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Color</Label>
                  <Input value={formData.vehicle_color} onChange={(e) => handleInputChange('vehicle_color', e.target.value)} placeholder="e.g. White" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Luggage Size Allowed</Label>
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
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
};

export default EditRide;
