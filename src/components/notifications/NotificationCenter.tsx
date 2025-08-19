import React, { useState } from 'react';
import { Bell, X, Check, Clock, Car, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface Notification {
  id: string;
  type: 'ride_accepted' | 'ride_pending' | 'ride_completed' | 'payment_received' | 'general';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired?: boolean;
}

// Mock notifications for demonstration
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'ride_accepted',
    title: 'Ride Request Accepted',
    message: 'The driver accepted your ride request from Nicosia to Limassol',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
    actionRequired: false,
  },
  {
    id: '2',
    type: 'ride_pending',
    title: 'Waiting for Driver Approval',
    message: 'Wait for the driver to accept the ride from Paphos to Larnaca',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    read: false,
    actionRequired: true,
  },
  {
    id: '3',
    type: 'payment_received',
    title: 'Payment Received',
    message: 'You received €15.00 for the ride to Ayia Napa',
    timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    read: true,
    actionRequired: false,
  },
];

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  const iconProps = { className: "h-4 w-4" };
  
  switch (type) {
    case 'ride_accepted':
      return <Check {...iconProps} className="h-4 w-4 text-green-500" />;
    case 'ride_pending':
      return <Clock {...iconProps} className="h-4 w-4 text-yellow-500" />;
    case 'ride_completed':
      return <Car {...iconProps} className="h-4 w-4 text-blue-500" />;
    case 'payment_received':
      return <User {...iconProps} className="h-4 w-4 text-emerald-500" />;
    default:
      return <Bell {...iconProps} className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatTimestamp = (timestamp: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          onClick={() => setIsOpen(true)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:w-96">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-sm"
              >
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`cursor-pointer transition-colors ${
                  !notification.read ? 'bg-accent/50 border-primary/20' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1">
                        <NotificationIcon type={notification.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-foreground">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                          {notification.actionRequired && (
                            <Badge variant="outline" className="text-xs">
                              Action required
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-6 w-6 p-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};