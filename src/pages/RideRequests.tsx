import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, MapPin, Calendar, Users, Euro, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import LocationInput from '@/components/LocationInput';

interface RideRequest {
  id: string;
  passenger_id: string;
  departure_city: string;
  arrival_city: string;
  desired_date: string;
  desired_time: string | null;
  seats_needed: number;
  max_price: number | null;
  description: string | null;
  status: string;
  created_at: string;
  passenger_name?: string;
  passenger_avatar?: string;
}

const RideRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    departure_city: '',
    arrival_city: '',
    desired_date: '',
    desired_time: '',
    seats_needed: 1,
    max_price: '',
    description: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('status', 'active')
        .gte('desired_date', new Date().toISOString().split('T')[0])
        .order('desired_date', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const passengerIds = [...new Set(data.map(r => r.passenger_id))];
        const { data: profiles } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', passengerIds);

        setRequests(data.map(r => ({
          ...r,
          passenger_name: profiles?.find(p => p.user_id === r.passenger_id)?.full_name || 'Anonymous',
          passenger_avatar: profiles?.find(p => p.user_id === r.passenger_id)?.avatar_url || undefined,
        })));
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching ride requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to post a ride request');
      navigate('/auth');
      return;
    }
    if (!form.departure_city || !form.arrival_city || !form.desired_date) {
      toast.error('Please fill in departure, destination, and date');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('ride_requests').insert({
        passenger_id: user.id,
        departure_city: form.departure_city,
        arrival_city: form.arrival_city,
        desired_date: form.desired_date,
        desired_time: form.desired_time || null,
        seats_needed: form.seats_needed,
        max_price: form.max_price ? parseFloat(form.max_price) : null,
        description: form.description.trim() || null,
      });

      if (error) throw error;

      toast.success('Ride request posted!');
      setDialogOpen(false);
      setForm({ departure_city: '', arrival_city: '', desired_date: '', desired_time: '', seats_needed: 1, max_price: '', description: '' });
      fetchRequests();
    } catch (error: any) {
      console.error('Error posting ride request:', error);
      toast.error('Failed to post ride request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('ride_requests').delete().eq('id', id);
      if (error) throw error;
      toast.success('Request deleted');
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      toast.error('Failed to delete request');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Ride Requests</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Post Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Post a Ride Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>From</Label>
                  <LocationInput
                    value={form.departure_city}
                    onChange={(val) => setForm(prev => ({ ...prev, departure_city: val }))}
                    placeholder="Departure city..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <LocationInput
                    value={form.arrival_city}
                    onChange={(val) => setForm(prev => ({ ...prev, arrival_city: val }))}
                    placeholder="Destination city..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.desired_date}
                      onChange={(e) => setForm(prev => ({ ...prev, desired_date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time (optional)</Label>
                    <Input
                      type="time"
                      value={form.desired_time}
                      onChange={(e) => setForm(prev => ({ ...prev, desired_time: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seats needed</Label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={form.seats_needed}
                      onChange={(e) => setForm(prev => ({ ...prev, seats_needed: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max price (€, optional)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.max_price}
                      onChange={(e) => setForm(prev => ({ ...prev, max_price: e.target.value }))}
                      placeholder="Any"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Additional details (optional)</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Any specific needs or preferences..."
                    rows={2}
                    maxLength={300}
                  />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Posting...' : 'Post Ride Request'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Can't find a ride that fits? Post a request and let drivers know where you need to go. Drivers can browse requests and offer rides.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <MapPin className="h-10 w-10 animate-pulse mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-1">No ride requests yet</h3>
            <p className="text-muted-foreground mb-4">Be the first to post a request!</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Post a Request
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10 mt-0.5">
                        <AvatarImage src={req.passenger_avatar} />
                        <AvatarFallback className="text-xs">
                          {req.passenger_name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{req.passenger_name}</span>
                          <span className="text-xs text-muted-foreground">needs a ride</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-base font-medium">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span>{req.departure_city}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{req.arrival_city}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(req.desired_date)}
                          </Badge>
                          {req.desired_time && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {req.desired_time.slice(0, 5)}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {req.seats_needed} seat{req.seats_needed > 1 ? 's' : ''}
                          </Badge>
                          {req.max_price && (
                            <Badge variant="secondary" className="text-xs">
                              <Euro className="h-3 w-3 mr-1" />
                              Max €{req.max_price}
                            </Badge>
                          )}
                        </div>
                        {req.description && (
                          <p className="text-sm text-muted-foreground mt-2">{req.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {user?.id === req.passenger_id && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(req.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {user && user.id !== req.passenger_id && (
                        <Button size="sm" onClick={() => navigate('/register-ride')}>
                          Offer Ride
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RideRequests;
