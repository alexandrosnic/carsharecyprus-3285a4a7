import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface NotificationData {
  type: 'ride_accepted' | 'ride_pending' | 'ride_completed' | 'payment_received' | 'general';
  title: string;
  message: string;
  actionRequired?: boolean;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const addNotification = useCallback((data: NotificationData) => {
    const newNotification = {
      id: Date.now().toString(),
      ...data,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Show toast notification
    toast(data.title, {
      description: data.message,
      duration: 5000,
      className: data.actionRequired ? 'border-yellow-500' : '',
    });

    return newNotification.id;
  }, []);

  const showDriverAcceptedNotification = useCallback(() => {
    addNotification({
      type: 'ride_accepted',
      title: 'Ride Request Accepted',
      message: 'The driver accepted the passenger for the ride',
      actionRequired: false,
    });
  }, [addNotification]);

  const showWaitingForDriverNotification = useCallback(() => {
    addNotification({
      type: 'ride_pending',
      title: 'Waiting for Driver',
      message: 'Wait for the driver to accept the ride',
      actionRequired: true,
    });
  }, [addNotification]);

  const showRideCompletedNotification = useCallback(() => {
    addNotification({
      type: 'ride_completed',
      title: 'Ride Completed',
      message: 'Your ride has been completed successfully',
      actionRequired: false,
    });
  }, [addNotification]);

  const showPaymentReceivedNotification = useCallback((amount: string) => {
    addNotification({
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received ${amount} for the completed ride`,
      actionRequired: false,
    });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    showDriverAcceptedNotification,
    showWaitingForDriverNotification,
    showRideCompletedNotification,
    showPaymentReceivedNotification,
  };
};