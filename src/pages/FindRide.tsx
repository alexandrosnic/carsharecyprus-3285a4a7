import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, MapPin, Calendar, Users, X, Map, Filter } from 'lucide-react';
import LocationInput from '@/components/LocationInput';

interface SearchFilters {
  departure: string;
  destination: string;
  date: string;
  time: string;
  passengers: number;
  priceMin: string;
  priceMax: string;
  luggage: string;
  smoking: boolean;
  pets: boolean;
  returnRide: boolean;
}

const cities = [
  'Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia',
  'Protaras', 'Ayia Napa', 'Troodos', 'Polis', 'Paralimni'
];

const FindRide = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    departure: '',
    destination: '',
    date: '',
    time: '',
    passengers: 1,
    priceMin: '',
    priceMax: '',
    luggage: '',
    smoking: false,
    pets: false,
    returnRide: false,
  });

  const handleSearch = () => {
    // Navigate to search results with filters as query params
    const params = new URLSearchParams();
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value !== '' && value !== false && value !== 0) {
        params.set(key, value.toString());
      }
    });
    navigate(`/search-results?${params.toString()}`);
  };

  const clearLocation = (field: 'departure' | 'destination') => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: ''
    }));
  };

  const toggleFilter = () => {
    setShowFilters(!showFilters);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
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
            <h1 className="text-2xl font-bold text-foreground">Find a Ride</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Search for Rides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Search Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Departure Location */}
              <div className="space-y-2">
                <Label htmlFor="departure">From</Label>
                <LocationInput
                  value={searchFilters.departure}
                  onChange={(val) => setSearchFilters(prev => ({ ...prev, departure: val }))}
                  placeholder="Type departure city..."
                />
              </div>

              {/* Destination Location */}
              <div className="space-y-2">
                <Label htmlFor="destination">To</Label>
                <LocationInput
                  value={searchFilters.destination}
                  onChange={(val) => setSearchFilters(prev => ({ ...prev, destination: val }))}
                  placeholder="Type destination city..."
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    value={searchFilters.date}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, date: e.target.value }))}
                    className="pl-9"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={searchFilters.time}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passengers">Passengers</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={searchFilters.passengers.toString()}
                    onValueChange={(value) => setSearchFilters(prev => ({ ...prev, passengers: parseInt(value) }))}
                  >
                    <SelectTrigger className="pl-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} passenger{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Filters Toggle */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={toggleFilter}
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
              
              <Button onClick={handleSearch} size="lg" className="px-8">
                <Search className="h-4 w-4 mr-2" />
                Search Rides
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <>
                <Separator />
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Advanced Filters</h3>

                  {/* Price Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priceMin">Min Price (€)</Label>
                      <Input
                        id="priceMin"
                        type="number"
                        value={searchFilters.priceMin}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceMax">Max Price (€)</Label>
                      <Input
                        id="priceMax"
                        type="number"
                        value={searchFilters.priceMax}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                        placeholder="100"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Luggage Size */}
                  <div className="space-y-2">
                    <Label htmlFor="luggage">Luggage Size</Label>
                    <Select
                      value={searchFilters.luggage}
                      onValueChange={(value) => setSearchFilters(prev => ({ ...prev, luggage: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any luggage size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any size</SelectItem>
                        <SelectItem value="small">Small (backpack)</SelectItem>
                        <SelectItem value="medium">Medium (suitcase)</SelectItem>
                        <SelectItem value="large">Large (multiple bags)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preferences */}
                  <div className="space-y-4">
                    <Label>Preferences</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="returnRide"
                          checked={searchFilters.returnRide}
                          onCheckedChange={(checked) => 
                            setSearchFilters(prev => ({ ...prev, returnRide: checked as boolean }))
                          }
                        />
                        <Label htmlFor="returnRide">Return ride</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="smoking"
                          checked={searchFilters.smoking}
                          onCheckedChange={(checked) => 
                            setSearchFilters(prev => ({ ...prev, smoking: checked as boolean }))
                          }
                        />
                        <Label htmlFor="smoking">Smoking allowed</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pets"
                          checked={searchFilters.pets}
                          onCheckedChange={(checked) => 
                            setSearchFilters(prev => ({ ...prev, pets: checked as boolean }))
                          }
                        />
                        <Label htmlFor="pets">Pets allowed</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Search Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { from: 'Nicosia', to: 'Limassol', price: '€15' },
                { from: 'Larnaca', to: 'Paphos', price: '€25' },
                { from: 'Nicosia', to: 'Larnaca', price: '€12' },
                { from: 'Limassol', to: 'Paphos', price: '€18' },
              ].map((route, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 justify-between"
                  onClick={() => {
                    setSearchFilters(prev => ({
                      ...prev,
                      departure: route.from,
                      destination: route.to
                    }));
                  }}
                >
                  <div className="text-left">
                    <div className="font-medium">{route.from} → {route.to}</div>
                    <div className="text-sm text-muted-foreground">Starting from {route.price}</div>
                  </div>
                  <MapPin className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FindRide;