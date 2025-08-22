import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';

interface LocationState {
  position: Position | null;
  error: string | null;
  loading: boolean;
  watching: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const [state, setState] = useState<LocationState>({
    position: null,
    error: null,
    loading: false,
    watching: false
  });

  const [watchId, setWatchId] = useState<string | null>(null);

  const requestPermissions = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();
        return permissions.location === 'granted';
      } else {
        // Web geolocation permission is handled automatically
        return true;
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to request location permissions',
        loading: false 
      }));
      return false;
    }
  }, []);

  const getCurrentPosition = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      let position: Position;

      if (Capacitor.isNativePlatform()) {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 10000,
          maximumAge: options.maximumAge ?? 60000
        });
      } else {
        // Web Geolocation API
        const webPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: options.enableHighAccuracy ?? true,
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge ?? 60000
          });
        });

        // Convert web position to Capacitor format
        position = {
          timestamp: webPosition.timestamp,
          coords: {
            latitude: webPosition.coords.latitude,
            longitude: webPosition.coords.longitude,
            accuracy: webPosition.coords.accuracy,
            altitudeAccuracy: webPosition.coords.altitudeAccuracy ?? undefined,
            altitude: webPosition.coords.altitude ?? undefined,
            speed: webPosition.coords.speed ?? undefined,
            heading: webPosition.coords.heading ?? undefined
          }
        };
      }

      setState(prev => ({ 
        ...prev, 
        position, 
        loading: false, 
        error: null 
      }));

      return position;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to get current position';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }));
      throw error;
    }
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, requestPermissions]);

  const startWatching = useCallback(async () => {
    if (state.watching) return;

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      let id: string;

      if (Capacitor.isNativePlatform()) {
        id = await Geolocation.watchPosition({
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 10000,
          maximumAge: options.maximumAge ?? 60000
        }, (position, error) => {
          if (error) {
            setState(prev => ({ 
              ...prev, 
              error: error.message,
              loading: false 
            }));
          } else if (position) {
            setState(prev => ({ 
              ...prev, 
              position, 
              loading: false, 
              error: null 
            }));
          }
        });
      } else {
        // Web Geolocation API
        const webId = navigator.geolocation.watchPosition(
          (webPosition) => {
            const position: Position = {
              timestamp: webPosition.timestamp,
              coords: {
                latitude: webPosition.coords.latitude,
                longitude: webPosition.coords.longitude,
                accuracy: webPosition.coords.accuracy,
                altitudeAccuracy: webPosition.coords.altitudeAccuracy ?? undefined,
                altitude: webPosition.coords.altitude ?? undefined,
                speed: webPosition.coords.speed ?? undefined,
                heading: webPosition.coords.heading ?? undefined
              }
            };

            setState(prev => ({ 
              ...prev, 
              position, 
              loading: false, 
              error: null 
            }));
          },
          (error) => {
            setState(prev => ({ 
              ...prev, 
              error: error.message,
              loading: false 
            }));
          },
          {
            enableHighAccuracy: options.enableHighAccuracy ?? true,
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge ?? 60000
          }
        );
        id = webId.toString();
      }

      setWatchId(id);
      setState(prev => ({ 
        ...prev, 
        watching: true, 
        loading: true 
      }));
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to start watching position',
        loading: false 
      }));
    }
  }, [state.watching, options.enableHighAccuracy, options.timeout, options.maximumAge, requestPermissions]);

  const stopWatching = useCallback(async () => {
    if (!state.watching || !watchId) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: watchId });
      } else {
        navigator.geolocation.clearWatch(parseInt(watchId));
      }

      setWatchId(null);
      setState(prev => ({ 
        ...prev, 
        watching: false 
      }));
    } catch (error) {
      console.error('Error stopping location watch:', error);
    }
  }, [state.watching, watchId]);

  // Auto-start watching if enabled
  useEffect(() => {
    if (options.watch) {
      startWatching();
    }

    return () => {
      if (state.watching) {
        stopWatching();
      }
    };
  }, [options.watch]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    requestPermissions
  };
};