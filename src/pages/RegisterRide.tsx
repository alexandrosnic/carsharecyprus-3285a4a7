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
import { ArrowLeft, Car, MapPin, Calendar, Users, DollarSign, Map, Plus } from 'lucide-react';
import { toast } from 'sonner';

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
}

const cities = [
  'Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia',
  'Protaras', 'Ayia Napa', 'Troodos', 'Polis', 'Paralimni'
];

const RegisterRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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
  });

  const handleInputChange = (field: keyof RideFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to create a ride');
      return;
    }

    // Validation
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
      const { error } = await supabase
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
        });

      if (error) throw error;

      toast.success('Ride created successfully!');
      navigate('/my-trips');
    } catch (error: any) {
      console.error('Error creating ride:', error);
      toast.error('Failed to create ride: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
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
            <h1 className="text-2xl font-bold text-foreground">Register a Ride</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
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
                {/* Departure Location */}
                <div className="space-y-2">
                  <Label htmlFor="departure">From *</Label>
                  <Select
                    value={formData.departure_city}
                    onValueChange={(value) => handleInputChange('departure_city', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select departure city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="w-full">
                    <Map className="h-4 w-4 mr-2" />
                    Choose on map
                  </Button>
                </div>

                {/* Destination Location */}
                <div className="space-y-2">
                  <Label htmlFor="destination">To *</Label>
                  <Select
                    value={formData.arrival_city}
                    onValueChange={(value) => handleInputChange('arrival_city', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="w-full">
                    <Map className="h-4 w-4 mr-2" />
                    Choose on map
                  </Button>
                </div>
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
                {/* Date and Time */}
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

                {/* Available Seats */}
                <div className="space-y-2">
                  <Label htmlFor="seats">Available Seats *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Select
                      value={formData.available_seats.toString()}
                      onValueChange={(value) => handleInputChange('available_seats', parseInt(value))}
                    >
                      <SelectTrigger className="pl-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} seat{num > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Price per Seat */}
              <div className="space-y-2">
                <Label htmlFor="price">Price per Seat (€) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_seat}
                    onChange={(e) => handleInputChange('price_per_seat', e.target.value)}
                    className="pl-9"
                    placeholder="15.00"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Set a fair price considering fuel, tolls, and your time
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Add any additional information about your ride..."
                  rows={3}
                />
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
              {/* Vehicle Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_make">Vehicle Make/Model</Label>
                  <Input
                    id="vehicle_make"
                    value={formData.vehicle_make}
                    onChange={(e) => handleInputChange('vehicle_make', e.target.value)}
                    placeholder="e.g. Toyota Yaris"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_color">Vehicle Color</Label>
                  <Input
                    id="vehicle_color"
                    value={formData.vehicle_color}
                    onChange={(e) => handleInputChange('vehicle_color', e.target.value)}
                    placeholder="e.g. White"
                  />
                </div>
              </div>

              <Separator />

              {/* Luggage Size */}
              <div className="space-y-2">
                <Label htmlFor="luggage">Luggage Size Allowed</Label>
                <Select
                  value={formData.luggage_size}
                  onValueChange={(value) => handleInputChange('luggage_size', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select luggage size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (backpack only)</SelectItem>
                    <SelectItem value="medium">Medium (small suitcase)</SelectItem>
                    <SelectItem value="large">Large (multiple bags allowed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Preferences */}
              <div className="space-y-4">
                <Label>Trip Preferences</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="return_ride"
                      checked={formData.return_ride}
                      onCheckedChange={(checked) => 
                        handleInputChange('return_ride', checked as boolean)
                      }
                    />
                    <Label htmlFor="return_ride">This is a return ride</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="smoking"
                      checked={formData.smoking_allowed}
                      onCheckedChange={(checked) => 
                        handleInputChange('smoking_allowed', checked as boolean)
                      }
                    />
                    <Label htmlFor="smoking">Smoking allowed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pets"
                      checked={formData.pets_allowed}
                      onCheckedChange={(checked) => 
                        handleInputChange('pets_allowed', checked as boolean)
                      }
                    />
                    <Label htmlFor="pets">Pets allowed</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col space-y-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={loading}
                  className="w-full"
                >
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