import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Clock, MapPin, Star, Users, Car, Filter, Cigarette, PawPrint, Briefcase, ArrowRight, ChevronRight, HandHelping } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getEstimatedDuration, formatDuration } from '@/constants/travelTimes';
import { toast } from 'sonner';
import LocationInput from '@/components/LocationInput';

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
  vehicle_make: string | null;
  vehicle_color: string | null;
  smoking_allowed: boolean | null;
  pets_allowed: boolean | null;
  luggage_size: string | null;
  driver_profile?: {
    full_name: string;
    avatar_url: string;
    rating: number;
    total_rides: number;
  };
  // computed
  relevanceScore?: number;
}

const SearchResults = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('relevance');
  
  // Advanced filters
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [minSeats, setMinSeats] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Ride request dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    departure_city: '',
    arrival_city: '',
    desired_date: '',
    desired_time: '',
    seats_needed: 1,
    max_price: '',
    description: '',
  });

  const departure = searchParams.get('departure') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';
  const passengers = parseInt(searchParams.get('passengers') || '1');

  // Pre-fill request form from search params
  useEffect(() => {
    setRequestForm(prev => ({
      ...prev,
      departure_city: departure,
      arrival_city: destination,
      desired_date: date,
      desired_time: time,
      seats_needed: passengers,
    }));
  }, [departure, destination, date, time, passengers]);

  useEffect(() => {
    fetchRides();
  }, [searchParams, sortBy, priceRange, minSeats]);

  const handleSubmitRequest = async () => {
    if (!user) {
      toast.error('Please sign in to post a ride request');
      navigate('/auth');
      return;
    }
    if (!requestForm.departure_city || !requestForm.arrival_city || !requestForm.desired_date) {
      toast.error('Please fill in departure, destination, and date');
      return;
    }
    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('ride_requests').insert({
        passenger_id: user.id,
        departure_city: requestForm.departure_city,
        arrival_city: requestForm.arrival_city,
        desired_date: requestForm.desired_date,
        desired_time: requestForm.desired_time || null,
        seats_needed: requestForm.seats_needed,
        max_price: requestForm.max_price ? parseFloat(requestForm.max_price) : null,
        description: requestForm.description.trim() || null,
      });
      if (error) throw error;
      toast.success('Ride request posted! Drivers will see your request.');
      setRequestDialogOpen(false);
    } catch (error: any) {
      console.error('Error posting ride request:', error);
      toast.error('Failed to post ride request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Extract the core city name from a full address for fuzzy matching
  const extractCity = (location: string): string => {
    // Try to get the first meaningful part (before comma)
    const parts = location.split(',').map(s => s.trim());
    return parts[0].toLowerCase();
  };

  const computeRelevance = (ride: Ride): number => {
    let score = 0;

    // City match (fuzzy - check if search term is contained in ride city or vice versa)
    const depSearch = extractCity(departure);
    const destSearch = extractCity(destination);
    const rideDep = ride.departure_city.toLowerCase();
    const rideArr = ride.arrival_city.toLowerCase();

    if (depSearch && (rideDep.includes(depSearch) || depSearch.includes(rideDep))) score += 40;
    if (destSearch && (rideArr.includes(destSearch) || destSearch.includes(rideArr))) score += 40;

    // Time proximity bonus (if search time specified)
    if (time) {
      const [searchHour] = time.split(':').map(Number);
      const rideHour = new Date(ride.departure_time).getHours();
      const hourDiff = Math.abs(rideHour - searchHour);
      score += Math.max(0, 10 - hourDiff * 2); // Up to 10 points
    }

    // Driver rating bonus
    const rating = ride.driver_profile?.rating || 5;
    score += rating * 2; // Up to 10 points

    // Experience bonus
    const trips = ride.driver_profile?.total_rides || 0;
    score += Math.min(trips, 10); // Up to 10 points

    // Seat availability bonus
    score += Math.min(ride.available_seats, 5);

    return score;
  };

  const fetchRides = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rides')
        .select('*')
        .eq('status', 'active')
        .gte('available_seats', passengers)
        .gte('departure_time', new Date().toISOString());

      if (date) {
        const startOfDay = new Date(date + 'T00:00:00').toISOString();
        const endOfDay = new Date(date + 'T23:59:59').toISOString();
        query = query.gte('departure_time', startOfDay).lte('departure_time', endOfDay);
      }

      // Don't filter by exact city match on DB — fetch broadly and rank client-side
      query = query.order('departure_time', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      let processedRides = data || [];

      // Fetch driver profiles
      if (processedRides.length > 0) {
        const driverIds = [...new Set(processedRides.map(ride => ride.driver_id))];
        const { data: profiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name, avatar_url, rating, total_rides')
          .in('user_id', driverIds);

        processedRides = processedRides.map(ride => ({
          ...ride,
          driver_profile: profiles?.find(p => p.user_id === ride.driver_id)
        }));
      }

      // Apply filters & relevance scoring
      let ridesWithScores = (processedRides as Ride[])
        .filter(ride => {
          if (ride.price_per_seat < priceRange.min || ride.price_per_seat > priceRange.max) return false;
          if (ride.available_seats < minSeats) return false;
          return true;
        })
        .map(ride => ({ ...ride, relevanceScore: computeRelevance(ride) }));

      // Only show rides with some relevance if search terms exist
      if (departure || destination) {
        ridesWithScores = ridesWithScores.filter(r => (r.relevanceScore || 0) > 10);
      }

      // Sort
      if (sortBy === 'relevance') {
        ridesWithScores.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      } else if (sortBy === 'price_per_seat') {
        ridesWithScores.sort((a, b) => a.price_per_seat - b.price_per_seat);
      } else if (sortBy === 'departure_time') {
        ridesWithScores.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
      } else if (sortBy === 'driver_rating') {
        ridesWithScores.sort((a, b) => (b.driver_profile?.rating || 0) - (a.driver_profile?.rating || 0));
      }

      setRides(ridesWithScores);
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

  const getArrivalTime = (departureTime: string, depCity: string, arrCity: string) => {
    const duration = getEstimatedDuration(depCity, arrCity);
    if (!duration) return null;
    const arrival = new Date(new Date(departureTime).getTime() + duration * 60000);
    return formatTime(arrival.toISOString());
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/find-ride')} className="mb-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {departure ? extractCity(departure).charAt(0).toUpperCase() + extractCity(departure).slice(1) : 'Any'}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                {destination ? extractCity(destination).charAt(0).toUpperCase() + extractCity(destination).slice(1) : 'Any'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {date ? formatDate(date + 'T12:00:00') : 'Any date'} · {passengers} passenger{passengers !== 1 ? 's' : ''} · {rides.length} ride{rides.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Sort & Filters bar */}
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Most relevant</SelectItem>
              <SelectItem value="departure_time">Earliest departure</SelectItem>
              <SelectItem value="price_per_seat">Lowest price</SelectItem>
              <SelectItem value="driver_rating">Highest rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showFilters && (
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Price Range (€)</Label>
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
                <Label className="text-sm font-medium">Minimum Seats</Label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={minSeats}
                  onChange={(e) => setMinSeats(parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => { setPriceRange({ min: 0, max: 100 }); setMinSeats(1); }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {rides.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No rides found</h3>
              <p className="text-muted-foreground mb-2">
                No rides match your search{departure && destination ? ` for ${extractCity(departure)} → ${extractCity(destination)}` : ''}
                {date && ` on ${formatDate(date + 'T12:00:00')}`}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Try a different date, fewer passengers, or post a request so drivers can find you
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button onClick={() => navigate('/find-ride')}>Modify Search</Button>
                <Button variant="outline" onClick={() => navigate('/register-ride')}>Offer This Ride</Button>
                <Button variant="secondary" onClick={() => setRequestDialogOpen(true)}>
                  <HandHelping className="h-4 w-4 mr-2" />
                  Request This Ride
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rides.map((ride) => {
              const duration = getEstimatedDuration(ride.departure_city, ride.arrival_city);
              const arrivalTime = getArrivalTime(ride.departure_time, ride.departure_city, ride.arrival_city);

              return (
                <Card 
                  key={ride.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer border"
                  onClick={() => navigate(`/ride/${ride.id}`)}
                >
                  <CardContent className="p-4 md:p-5">
                    {/* BlaBlaCar-style layout */}
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Time & Route */}
                      <div className="flex-1 min-w-0">
                        {/* Timeline row */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-right w-12 flex-shrink-0">
                            <div className="text-lg font-bold">{formatTime(ride.departure_time)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                            <div className="w-0.5 h-8 bg-border" />
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-background" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{ride.departure_city}</div>
                            {duration && (
                              <div className="text-xs text-muted-foreground my-1">{formatDuration(duration)}</div>
                            )}
                            <div className="font-medium truncate">{ride.arrival_city}</div>
                          </div>
                        </div>
                        {arrivalTime && (
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-right w-12 flex-shrink-0">
                              <div className="text-sm text-muted-foreground">{arrivalTime}</div>
                            </div>
                            <div className="flex-1" />
                          </div>
                        )}

                        {/* Date */}
                        <div className="text-sm text-muted-foreground mb-2">
                          {formatDate(ride.departure_time)}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-xs py-0">
                            <Users className="h-3 w-3 mr-1" />{ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''}
                          </Badge>
                          {ride.vehicle_make && (
                            <Badge variant="outline" className="text-xs py-0">
                              <Car className="h-3 w-3 mr-1" />{ride.vehicle_color} {ride.vehicle_make}
                            </Badge>
                          )}
                          {ride.smoking_allowed && (
                            <Badge variant="outline" className="text-xs py-0"><Cigarette className="h-3 w-3 mr-1" />Smoking</Badge>
                          )}
                          {ride.pets_allowed && (
                            <Badge variant="outline" className="text-xs py-0"><PawPrint className="h-3 w-3 mr-1" />Pets</Badge>
                          )}
                          {ride.luggage_size && ride.luggage_size !== 'medium' && (
                            <Badge variant="outline" className="text-xs py-0"><Briefcase className="h-3 w-3 mr-1" />{ride.luggage_size}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Right: Price & Driver */}
                      <div className="flex flex-col items-end justify-between gap-3 flex-shrink-0">
                        <div className="text-2xl font-bold text-primary">
                          €{ride.price_per_seat.toFixed(2)}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-medium truncate max-w-[120px]">
                              {ride.driver_profile?.full_name || 'Driver'}
                            </div>
                            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{ride.driver_profile?.rating?.toFixed(1) || '5.0'}</span>
                              <span>· {ride.driver_profile?.total_rides || 0} trips</span>
                            </div>
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={ride.driver_profile?.avatar_url} />
                            <AvatarFallback className="text-sm">
                              {ride.driver_profile?.full_name?.split(' ').map(n => n[0]).join('') || 'D'}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Request a ride CTA */}
        <Card className="mt-6 border-dashed">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground">Can't find the right ride?</h4>
              <p className="text-sm text-muted-foreground">Post a request and let drivers come to you</p>
            </div>
            <Button variant="secondary" onClick={() => setRequestDialogOpen(true)}>
              <HandHelping className="h-4 w-4 mr-2" />
              Request a Ride
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => navigate('/find-ride')}>
            Modify Search Criteria
          </Button>
        </div>

        {/* Request Ride Dialog */}
        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request a Ride</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>From</Label>
                <LocationInput
                  value={requestForm.departure_city}
                  onChange={(val) => setRequestForm(prev => ({ ...prev, departure_city: val }))}
                  placeholder="Departure city..."
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <LocationInput
                  value={requestForm.arrival_city}
                  onChange={(val) => setRequestForm(prev => ({ ...prev, arrival_city: val }))}
                  placeholder="Destination city..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={requestForm.desired_date}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, desired_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Seats needed</Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={requestForm.seats_needed}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, seats_needed: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max price (€, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={requestForm.max_price}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, max_price: e.target.value }))}
                  placeholder="Any"
                />
              </div>
              <div className="space-y-2">
                <Label>Additional details (optional)</Label>
                <Textarea
                  value={requestForm.description}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Any specific needs or preferences..."
                  rows={2}
                  maxLength={300}
                />
              </div>
              <Button className="w-full" onClick={handleSubmitRequest} disabled={submittingRequest}>
                {submittingRequest ? 'Posting...' : 'Post Ride Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SearchResults;
