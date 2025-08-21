import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useWebPushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    initializePushNotifications();
  }, [user]);

  const initializePushNotifications = async () => {
    try {
      // Check if service worker and notifications are supported
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      setIsSupported(true);
      setPermission(Notification.permission);

      // If permission already granted, proceed
      if (Notification.permission === 'granted') {
        await registerServiceWorker();
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await registerServiceWorker();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Generate a simple token for web notifications
      const webToken = `web_${user?.id}_${Date.now()}`;
      setToken(webToken);

      if (user) {
        await storePushToken(webToken);
      }
    } catch (error) {
      console.error('Error registering service worker:', error);
    }
  };

  const storePushToken = async (tokenValue: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          token: tokenValue,
          platform: 'web',
          active: true
        });

      if (error) {
        console.error('Error storing push token:', error);
      }
    } catch (error) {
      console.error('Error storing push token:', error);
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  };

  const removePushToken = async () => {
    if (!user || !token) return;

    try {
      const { error } = await supabase
        .from('push_tokens')
        .update({ active: false })
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) {
        console.error('Error removing push token:', error);
      }
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  };

  return {
    isSupported,
    permission,
    token,
    requestPermission,
    showNotification,
    removePushToken
  };
};