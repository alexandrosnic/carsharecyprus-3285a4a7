import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CreditCard, ArrowUpRight, ArrowDownLeft, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentHistoryItem {
  id: string;
  ride_id: string;
  amount: number;
  type: 'sent' | 'received';
  status: string;
  created_at: string;
  ride_info: {
    departure_city: string;
    arrival_city: string;
    departure_time: string;
  };
  other_party: {
    full_name: string;
  };
}

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) {
      fetchPaymentHistory();
    }
  }, [user]);

  const fetchPaymentHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch bookings where user was passenger (payments sent)
      const { data: sentPayments, error: sentError } = await supabase
        .from('bookings')
        .select(`
          id,
          ride_id,
          total_amount,
          status,
          created_at,
          rides (
            departure_city,
            arrival_city,
            departure_time,
            driver_id
          )
        `)
        .eq('passenger_id', user.id)
        .eq('status', 'confirmed');

      if (sentError) throw sentError;

      // Fetch bookings for rides where user was driver (payments received)
      const { data: userRides, error: ridesError } = await supabase
        .from('rides')
        .select('id')
        .eq('driver_id', user.id);

      if (ridesError) throw ridesError;

      const rideIds = userRides?.map(ride => ride.id) || [];
      
      let receivedPayments: any[] = [];
      if (rideIds.length > 0) {
        const { data: received, error: receivedError } = await supabase
          .from('bookings')
          .select(`
            id,
            ride_id,
            driver_amount,
            status,
            created_at,
            passenger_id,
            rides (
              departure_city,
              arrival_city,
              departure_time
            )
          `)
          .in('ride_id', rideIds)
          .eq('status', 'confirmed');

        if (receivedError) throw receivedError;
        receivedPayments = received || [];
      }

      // Get profiles for other parties
      const sentDriverIds = sentPayments?.map(p => (p.rides as any)?.driver_id).filter(Boolean) || [];
      const receivedPassengerIds = receivedPayments?.map(p => p.passenger_id).filter(Boolean) || [];
      const allUserIds = [...sentDriverIds, ...receivedPassengerIds];

      let profiles: any[] = [];
      if (allUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('safe_profiles')
          .select('user_id, full_name')
          .in('user_id', allUserIds);

        if (profilesError) throw profilesError;
        profiles = profilesData || [];
      }

      // Process sent payments
      const processedSentPayments: PaymentHistoryItem[] = sentPayments?.map(payment => {
        const ride = payment.rides as any;
        const driverProfile = profiles.find(p => p.user_id === ride?.driver_id);
        
        return {
          id: payment.id,
          ride_id: payment.ride_id,
          amount: payment.total_amount,
          type: 'sent',
          status: payment.status,
          created_at: payment.created_at,
          ride_info: {
            departure_city: ride?.departure_city || '',
            arrival_city: ride?.arrival_city || '',
            departure_time: ride?.departure_time || ''
          },
          other_party: {
            full_name: driverProfile?.full_name || 'Unknown Driver'
          }
        };
      }) || [];

      // Process received payments
      const processedReceivedPayments: PaymentHistoryItem[] = receivedPayments.map(payment => {
        const ride = payment.rides as any;
        const passengerProfile = profiles.find(p => p.user_id === payment.passenger_id);
        
        return {
          id: payment.id,
          ride_id: payment.ride_id,
          amount: payment.driver_amount,
          type: 'received',
          status: payment.status,
          created_at: payment.created_at,
          ride_info: {
            departure_city: ride?.departure_city || '',
            arrival_city: ride?.arrival_city || '',
            departure_time: ride?.departure_time || ''
          },
          other_party: {
            full_name: passengerProfile?.full_name || 'Unknown Passenger'
          }
        };
      });

      // Combine and sort by date
      const allPayments = [...processedSentPayments, ...processedReceivedPayments];
      allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPayments(allPayments);
    } catch (error: any) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600 border-red-600">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const sentPayments = payments.filter(p => p.type === 'sent');
  const receivedPayments = payments.filter(p => p.type === 'received');

  const totalSent = sentPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalReceived = receivedPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p>Loading payment history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/profile')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <ArrowUpRight className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold">Total Sent</h3>
              </div>
              <div className="text-2xl font-bold text-red-600">€{totalSent.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">{sentPayments.length} payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <ArrowDownLeft className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Total Received</h3>
              </div>
              <div className="text-2xl font-bold text-green-600">€{totalReceived.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">{receivedPayments.length} payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Net Balance</h3>
              </div>
              <div className={`text-2xl font-bold ${
                (totalReceived - totalSent) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                €{(totalReceived - totalSent).toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground">{payments.length} total transactions</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-16">
                <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">There is no payment history yet</h3>
                <p className="text-muted-foreground mb-6">
                  Your payment transactions will appear here after you complete rides
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => navigate('/find-ride')}>
                    Find a Ride
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/register-ride')}>
                    Offer a Ride
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
                  <TabsTrigger value="sent">Sent ({sentPayments.length})</TabsTrigger>
                  <TabsTrigger value="received">Received ({receivedPayments.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-6">
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${
                            payment.type === 'sent' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {payment.type === 'sent' ? 
                              <ArrowUpRight className="h-4 w-4" /> : 
                              <ArrowDownLeft className="h-4 w-4" />
                            }
                          </div>
                          <div>
                            <div className="font-medium">
                              {payment.ride_info.departure_city} → {payment.ride_info.arrival_city}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {payment.type === 'sent' ? 'To' : 'From'}: {payment.other_party.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(payment.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${
                            payment.type === 'sent' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {payment.type === 'sent' ? '-' : '+'}€{payment.amount.toFixed(2)}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="sent" className="mt-6">
                  <div className="space-y-4">
                    {sentPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 rounded-full bg-red-100 text-red-600">
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {payment.ride_info.departure_city} → {payment.ride_info.arrival_city}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              To: {payment.other_party.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(payment.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-red-600">
                            -€{payment.amount.toFixed(2)}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="received" className="mt-6">
                  <div className="space-y-4">
                    {receivedPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 rounded-full bg-green-100 text-green-600">
                            <ArrowDownLeft className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {payment.ride_info.departure_city} → {payment.ride_info.arrival_city}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              From: {payment.other_party.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(payment.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-green-600">
                            +€{payment.amount.toFixed(2)}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PaymentHistory;