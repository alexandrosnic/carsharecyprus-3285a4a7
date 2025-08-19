import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Car, Plus, Search, User } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { 
    showDriverAcceptedNotification, 
    showWaitingForDriverNotification,
    showPaymentReceivedNotification 
  } = useNotifications();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Car className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Carpool Cyprus</h1>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
              <User className="h-4 w-4 mr-2" />
              {user.email}
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-foreground">
            Share rides across Cyprus
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Find or offer rides, save money, and protect the environment
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
            <Plus className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4 text-foreground">Offer a Ride</h3>
            <p className="text-muted-foreground mb-6">
              Share your journey and earn money while helping others
            </p>
            <Button size="lg" className="w-full" onClick={() => navigate('/register-ride')}>
              Create Ride
            </Button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
            <Search className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4 text-foreground">Find a Ride</h3>
            <p className="text-muted-foreground mb-6">
              Search for rides to your destination at great prices
            </p>
            <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/find-ride')}>
              Search Rides
            </Button>
          </div>
        </div>

        {/* Recent Rides Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-6 text-foreground">Recent Rides</h3>
          <div className="text-center py-12 text-muted-foreground">
            <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No rides yet. Create your first ride or search for available ones!</p>
          </div>
        </div>

        {/* Test Notification Buttons - Remove these in production */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h4 className="text-lg font-semibold mb-4">Test Notifications:</h4>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={showDriverAcceptedNotification}
            >
              Test "Driver Accepted"
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={showWaitingForDriverNotification}
            >
              Test "Wait for Driver"
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => showPaymentReceivedNotification('€15.00')}
            >
              Test "Payment Received"
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
