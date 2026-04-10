import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Search, MapPin, Calendar, Users, Filter } from 'lucide-react';
import LocationInput, { LocationResult } from '@/components/LocationInput';
import ClickableMap, { MapMarkerData } from '@/components/ClickableMap';

interface SearchFilters {
  departure: string;
  destination: string;
  date: string;
  timeHour: string;
  timeMinute: string;
  passengers: number;
  priceMin: string;
  priceMax: string;
  luggage: string;
  smoking: boolean;
  pets: boolean;
  returnRide: boolean;
}

const FindRide = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [departureCoords, setDepartureCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [mapSelectMode, setMapSelectMode] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    departure: '',
    destination: '',
    date: '',
    timeHour: '',
    timeMinute: '',
    passengers: 1,
    priceMin: '',
    priceMax: '',
    luggage: '',
    smoking: false,
    pets: false,
    returnRide: false,
  });

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchFilters.departure) params.set('departure', searchFilters.departure);
    if (searchFilters.destination) params.set('destination', searchFilters.destination);
    if (searchFilters.date) params.set('date', searchFilters.date);
    if (searchFilters.timeHour && searchFilters.timeMinute) {
      params.set('time', `${searchFilters.timeHour}:${searchFilters.timeMinute}`);
    }
    if (searchFilters.passengers > 1) params.set('passengers', searchFilters.passengers.toString());
    if (searchFilters.priceMin) params.set('priceMin', searchFilters.priceMin);
    if (searchFilters.priceMax) params.set('priceMax', searchFilters.priceMax);
    if (searchFilters.luggage) params.set('luggage', searchFilters.luggage);
    if (searchFilters.smoking) params.set('smoking', 'true');
    if (searchFilters.pets) params.set('pets', 'true');
    if (searchFilters.returnRide) params.set('returnRide', 'true');
    navigate(`/search-results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Find a Ride</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Search for Rides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Map */}
            <ClickableMap
              className="w-full h-56 rounded-lg border border-border"
              departureCoords={departureCoords}
              arrivalCoords={destinationCoords}
              departureLabel={searchFilters.departure}
              arrivalLabel={searchFilters.destination}
              selectingMode={mapSelectMode}
              onSelectingModeChange={setMapSelectMode}
              onLocationPicked={(address, coords) => {
                if (mapSelectMode === 'departure') {
                  setSearchFilters(prev => ({ ...prev, departure: address }));
                  setDepartureCoords(coords);
                } else if (mapSelectMode === 'arrival') {
                  setSearchFilters(prev => ({ ...prev, destination: address }));
                  setDestinationCoords(coords);
                }
              }}
            />

            {/* Location Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <LocationInput
                  value={searchFilters.departure}
                  onChange={(val, result) => {
                    setSearchFilters(prev => ({ ...prev, departure: val }));
                    setDepartureCoords(result?.coordinates || null);
                  }}
                  placeholder="Type departure city or place..."
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <LocationInput
                  value={searchFilters.destination}
                  onChange={(val, result) => {
                    setSearchFilters(prev => ({ ...prev, destination: val }));
                    setDestinationCoords(result?.coordinates || null);
                  }}
                  placeholder="Type destination city or place..."
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={searchFilters.date}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, date: e.target.value }))}
                    className="pl-9"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Time (optional)</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={searchFilters.timeHour}
                    onValueChange={(h) => setSearchFilters(prev => ({ ...prev, timeHour: h, timeMinute: prev.timeMinute || '00' }))}
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
                    value={searchFilters.timeMinute}
                    onValueChange={(m) => setSearchFilters(prev => ({ ...prev, timeMinute: m, timeHour: prev.timeHour || '08' }))}
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
                <Label>Passengers</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={searchFilters.passengers.toString()}
                    onValueChange={(value) => setSearchFilters(prev => ({ ...prev, passengers: parseInt(value) }))}
                  >
                    <SelectTrigger className="pl-9"><SelectValue /></SelectTrigger>
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

            {/* Filters Toggle + Search */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Price (€)</Label>
                      <Input
                        type="number"
                        value={searchFilters.priceMin}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Price (€)</Label>
                      <Input
                        type="number"
                        value={searchFilters.priceMax}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                        placeholder="100"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Luggage Size</Label>
                    <Select
                      value={searchFilters.luggage || 'any'}
                      onValueChange={(value) => setSearchFilters(prev => ({ ...prev, luggage: value === 'any' ? '' : value }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Any luggage size" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any size</SelectItem>
                        <SelectItem value="small">Small (backpack)</SelectItem>
                        <SelectItem value="medium">Medium (suitcase)</SelectItem>
                        <SelectItem value="large">Large (multiple bags)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label>Preferences</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="returnRide" checked={searchFilters.returnRide} onCheckedChange={(checked) => setSearchFilters(prev => ({ ...prev, returnRide: checked as boolean }))} />
                        <Label htmlFor="returnRide">Return ride</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="smoking" checked={searchFilters.smoking} onCheckedChange={(checked) => setSearchFilters(prev => ({ ...prev, smoking: checked as boolean }))} />
                        <Label htmlFor="smoking">Smoking allowed</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="pets" checked={searchFilters.pets} onCheckedChange={(checked) => setSearchFilters(prev => ({ ...prev, pets: checked as boolean }))} />
                        <Label htmlFor="pets">Pets allowed</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Popular Routes */}
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
                    setSearchFilters(prev => ({ ...prev, departure: route.from, destination: route.to }));
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
