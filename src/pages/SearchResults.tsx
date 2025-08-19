import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Car, MapPin, Clock, Users, Star, Filter, SortAsc } from 'lucide-react';
import { toast } from 'sonner';

interface Ride {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  description: string;
  profiles: {
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

  // Get search parameters
  const departure = searchParams.get('departure') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';
  const passengers = parseInt(searchParams.get('passengers') || '1');

  useEffect(() => {
    fetchRides();
  }, [searchParams, sortBy]);

  const fetchRides = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rides')
        .select(`
          *,
          profiles!rides_driver_id_fkey (
            full_name,
            avatar_url,
            rating,
            total_rides
          )
        `)
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
      if (sortBy === 'price_asc') {
        query = query.order('price_per_seat', { ascending: true });
      } else if (sortBy === 'price_desc') {
        query = query.order('price_per_seat', { ascending: false });
      } else if (sortBy === 'rating') {
        query = query.order('departure_time', { ascending: true }); // Default sort, then we'll sort by rating in frontend
      } else {
        query = query.order('departure_time', { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      let processedRides = data || [];

      // Sort by rating if selected (done in frontend since it's a joined field)
      if (sortBy === 'rating') {
        processedRides.sort((a, b) => (b.profiles?.rating || 0) - (a.profiles?.rating || 0));
      }

      setRides(processedRides);
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('en-US', {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/find-ride')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Available Rides</h1>
              <p className="text-sm text-muted-foreground">
                {departure && destination && `${departure} → ${destination}`}
                {date && ` • ${formatDate(date + 'T00:00:00')}`}
                {` • ${passengers} passenger${passengers > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters and Sort */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <SortAsc className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departure_time">Departure Time</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Driver Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-muted-foreground">
            {rides.length} ride{rides.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Results */}
        {rides.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">There is no available ride</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search criteria or check back later
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
                    {/* Route and Time */}
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

                    {/* Driver Info */}
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{ride.profiles?.full_name}</div>
                        <div className="flex items-center space-x-1 text-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{ride.profiles?.rating?.toFixed(1) || '5.0'}</span>
                          <span className="text-muted-foreground">
                            • {ride.profiles?.total_rides || 0} trips
                          </span>
                        </div>
                      </div>
                      <Avatar>
                        <AvatarImage src={ride.profiles?.avatar_url} />
                        <AvatarFallback>
                          {ride.profiles?.full_name?.split(' ').map(n => n[0]).join('') || 'D'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Price */}
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

        {/* Modify Search Button */}
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate('/find-ride')}>
            Modify Search Criteria
          </Button>
        </div>
      </main>
    </div>
  );
};

export default SearchResults;