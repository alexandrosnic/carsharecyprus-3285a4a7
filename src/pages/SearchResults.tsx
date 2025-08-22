import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, MapPin, Star, Users, Car, Filter } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Ride {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  description: string;
  driver_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  driver_profile?: {
    full_name: string;
    avatar_url: string;
    rating: number;
    total_rides: number;
  };
}

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('departure_time');
  const [filterBy, setFilterBy] = useState('all');
  
  // Advanced filters
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [minSeats, setMinSeats] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Get search parameters
  const departure = searchParams.get('departure') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';
  const passengers = parseInt(searchParams.get('passengers') || '1');

  useEffect(() => {
    fetchRides();
  }, [searchParams, sortBy, priceRange, timeRange, minSeats]);

  const fetchRides = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rides')
        .select('*')
        .eq('status', 'active')
        .gte('available_seats', passengers);

      // Apply filters based on search params
      if (departure) {
        query = query.eq('departure_city', departure);
      }
      if (destination) {
        query = query.eq('arrival_city', destination);
      }
      if (date) {
        const startOfDay = new Date(date).toISOString();
        const endOfDay = new Date(date + 'T23:59:59').toISOString();
        query = query.gte('departure_time', startOfDay).lte('departure_time', endOfDay);
      }

      // Apply sorting
      if (sortBy === 'price_per_seat') {
        query = query.order('price_per_seat', { ascending: true });
      } else if (sortBy === 'driver_rating') {
        query = query.order('departure_time', { ascending: true }); // Default sort, then we'll sort by rating in frontend
      } else {
        query = query.order('departure_time', { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      let processedRides = data || [];

      // Fetch driver profiles for each ride (using public view)
      if (processedRides.length > 0) {
        const driverIds = [...new Set(processedRides.map(ride => ride.driver_id))];
        const { data: profiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name, avatar_url, rating, total_rides')
          .in('user_id', driverIds);

        // Attach driver profiles to rides
        processedRides = processedRides.map(ride => ({
          ...ride,
          driver_profile: profiles?.find(p => p.user_id === ride.driver_id)
        }));
      }

      // Apply advanced filters
      const ridesWithProfiles = processedRides as Ride[];
      const filteredRides = ridesWithProfiles.filter(ride => {
        // Price filter
        if (ride.price_per_seat < priceRange.min || ride.price_per_seat > priceRange.max) {
          return false;
        }
        
        // Time filter
        if (timeRange.start && timeRange.end) {
          const rideTime = new Date(ride.departure_time).getHours();
          const startHour = parseInt(timeRange.start.split(':')[0]);
          const endHour = parseInt(timeRange.end.split(':')[0]);
          if (rideTime < startHour || rideTime > endHour) {
            return false;
          }
        }
        
        // Minimum seats filter
        if (ride.available_seats < minSeats) {
          return false;
        }
        
        return true;
      });

      // Sort by rating if selected
      if (sortBy === 'driver_rating') {
        filteredRides.sort((a, b) => (b.driver_profile?.rating || 0) - (a.driver_profile?.rating || 0));
      }

      setRides(filteredRides);
    } catch (error: any) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p>Searching for rides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/find-ride')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Available Rides</h1>
              <p className="text-muted-foreground">
                {departure} → {destination} • {formatDate(date)} • {passengers} passenger{passengers !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departure_time">Earliest Departure</SelectItem>
                  <SelectItem value="price_per_seat">Lowest Price</SelectItem>
                  <SelectItem value="driver_rating">Highest Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showFilters && (
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price-range" className="text-sm font-medium">Price Range (€)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                      className="w-20"
                    />
                    <span>-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) || 100 }))}
                      className="w-20"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="time-range" className="text-sm font-medium">Departure Time</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="time"
                      value={timeRange.start}
                      onChange={(e) => setTimeRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={timeRange.end}
                      onChange={(e) => setTimeRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="min-seats" className="text-sm font-medium">Minimum Seats</Label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={minSeats}
                    onChange={(e) => setMinSeats(parseInt(e.target.value) || 1)}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPriceRange({ min: 0, max: 100 });
                    setTimeRange({ start: '', end: '' });
                    setMinSeats(1);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </Card>
          )}
        </div>

        {rides.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No rides found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search criteria or filters
              </p>
              <Button onClick={() => navigate('/find-ride')}>
                Modify Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <Card 
                key={ride.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/ride/${ride.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{ride.departure_city}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{ride.arrival_city}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(ride.departure_time)}</span>
                          <span>•</span>
                          <span>{formatDate(ride.departure_time)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''} available</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{ride.driver_profile?.full_name || 'Unknown Driver'}</div>
                        <div className="flex items-center space-x-1 text-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{ride.driver_profile?.rating?.toFixed(1) || '5.0'}</span>
                          <span className="text-muted-foreground">
                            • {ride.driver_profile?.total_rides || 0} trips
                          </span>
                        </div>
                      </div>
                      <Avatar>
                        <AvatarImage src={ride.driver_profile?.avatar_url} />
                        <AvatarFallback>
                          {ride.driver_profile?.full_name?.split(' ').map(n => n[0]).join('') || 'D'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="text-right ml-6">
                      <div className="text-2xl font-bold text-primary">
                        €{ride.price_per_seat}
                      </div>
                      <div className="text-sm text-muted-foreground">per person</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate('/find-ride')}>
            Modify Search Criteria
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SearchResults;