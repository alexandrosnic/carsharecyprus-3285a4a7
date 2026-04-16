import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Search, User, MapPin, Clock, Star, Users, Cigarette, PawPrint, Briefcase } from 'lucide-react';
import { BRAND_LOGO } from '@/constants/brand';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { getEstimatedDuration, formatDuration } from '@/constants/travelTimes';
import RatingPrompt from '@/components/RatingPrompt';

interface RideFeed {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  vehicle_make: string | null;
  vehicle_color: string | null;
  smoking_allowed: boolean | null;
  pets_allowed: boolean | null;
  luggage_size: string | null;
  driver_profile?: {
    full_name: string;
    avatar_url: string;
    rating: number;
  };
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideFeed[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      expirePastRides();
      fetchUpcomingRides();
    }
  }, [user]);

  const expirePastRides = async () => {
    try {
      // Mark rides as completed if departure_time has passed
      await supabase
        .from('rides')
        .update({ status: 'completed' })
        .eq('status', 'active')
        .eq('driver_id', user!.id)
        .lt('departure_time', new Date().toISOString());
    } catch (error) {
      console.error('Error expiring rides:', error);
    }
  };

  const fetchUpcomingRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'active')
        .gte('departure_time', new Date().toISOString())
        .order('departure_time', { ascending: true })
        .limit(6);

      if (error) throw error;

      if (data && data.length > 0) {
        const driverIds = [...new Set(data.map(r => r.driver_id))];
        const { data: profiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name, avatar_url, rating')
          .in('user_id', driverIds);

        setRides(data.map(ride => ({
          ...ride,
          driver_profile: profiles?.find(p => p.user_id === ride.driver_id) as any,
        })));
      } else {
        setRides([]);
      }
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setRidesLoading(false);
    }
  };

  const formatTime = (t: string) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (t: string) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img src={BRAND_LOGO} alt="Car Share Cyprus Logo" className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/lovable-uploads/834c900c-913f-46a2-b82c-ee88234635ae.png" alt="Car Share Cyprus Logo" className="h-10" />
            <h1 className="text-2xl font-bold text-foreground whitespace-nowrap">Car Share Cyprus</h1>
          </div>
          <div className="flex items-center justify-end flex-wrap gap-2">
            <NotificationCenter />
            <Button variant="ghost" size="sm" className="text-xs px-2" onClick={() => navigate('/profile')}>
              <User className="h-4 w-4 mr-1" />
              <span className="truncate max-w-[120px]">{user.email}</span>
            </Button>
            <Button variant="outline" size="sm" className="text-xs px-3 whitespace-nowrap" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-foreground">Share rides across Cyprus</h2>
          <p className="text-xl text-muted-foreground mb-8">Find or offer rides, save money, and protect the environment</p>
        </div>

        {/* Rating Prompt for unrated past rides */}
        <RatingPrompt />

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-card rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
            <Plus className="h-14 w-14 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3 text-foreground">Offer a Ride</h3>
            <p className="text-muted-foreground mb-6 text-sm">Share your journey and earn money</p>
            <Button size="lg" className="w-full" onClick={() => navigate('/register-ride')}>Create Ride</Button>
          </div>
          <div className="bg-card rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
            <Search className="h-14 w-14 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3 text-foreground">Find a Ride</h3>
            <p className="text-muted-foreground mb-6 text-sm">Search for rides at great prices</p>
            <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/find-ride')}>Search Rides</Button>
          </div>
        </div>

        {/* Upcoming Rides Feed */}
        <div className="bg-card rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-foreground">Upcoming Rides</h3>
            <Button variant="outline" size="sm" onClick={() => navigate('/find-ride')}>View All</Button>
          </div>

          {ridesLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <img src={BRAND_LOGO} alt="Loading" className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
              <p>Loading rides...</p>
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <img src={BRAND_LOGO} alt="Car Share Cyprus Logo" className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming rides. Be the first to create one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rides.map((ride) => (
                <Card
                  key={ride.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/ride/${ride.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Route */}
                      <div className="flex items-center flex-wrap gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{ride.departure_city}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium truncate">{ride.arrival_city}</span>
                        {(() => {
                          const dur = getEstimatedDuration(ride.departure_city, ride.arrival_city);
                          return dur ? (
                            <Badge variant="outline" className="text-xs py-0 ml-1">
                              <Clock className="h-3 w-3 mr-1" />{formatDuration(dur)}
                            </Badge>
                          ) : null;
                        })()}
                      </div>

                      {/* Details row */}
                      <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(ride.departure_time)} • {formatDate(ride.departure_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ride.available_seats} seat{ride.available_seats > 1 ? 's' : ''}
                        </span>
                        {ride.vehicle_make && (
                          <span className="text-xs truncate">
                            {ride.vehicle_color} {ride.vehicle_make}
                          </span>
                        )}
                      </div>

                      {/* Preferences badges */}
                      <div className="flex flex-wrap gap-1">
                        {ride.smoking_allowed && (
                          <Badge variant="outline" className="text-xs py-0"><Cigarette className="h-3 w-3 mr-1" />Smoking OK</Badge>
                        )}
                        {ride.pets_allowed && (
                          <Badge variant="outline" className="text-xs py-0"><PawPrint className="h-3 w-3 mr-1" />Pets OK</Badge>
                        )}
                        {ride.luggage_size && ride.luggage_size !== 'medium' && (
                          <Badge variant="outline" className="text-xs py-0"><Briefcase className="h-3 w-3 mr-1" />{ride.luggage_size} luggage</Badge>
                        )}
                      </div>

                      {/* Driver + Price row */}
                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        {ride.driver_profile && (
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={ride.driver_profile.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {ride.driver_profile.full_name?.split(' ').map(n => n[0]).join('') || 'D'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm min-w-0">
                              <div className="font-medium truncate">{ride.driver_profile.full_name}</div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{ride.driver_profile.rating?.toFixed(1) || '5.0'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold text-primary">€{ride.price_per_seat}</div>
                          <div className="text-xs text-muted-foreground">per seat</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
