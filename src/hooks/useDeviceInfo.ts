import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

interface DeviceInfo {
  platform: string;
  isNative: boolean;
  isOnline: boolean;
  deviceId?: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
  manufacturer?: string;
  isVirtual?: boolean;
  memUsed?: number;
  webViewVersion?: string;
  appState: 'active' | 'background';
}

export const useDeviceInfo = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    platform: 'web',
    isNative: false,
    isOnline: navigator.onLine,
    appState: 'active'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        const isNative = Capacitor.isNativePlatform();
        const platform = Capacitor.getPlatform();

        let deviceData: DeviceInfo = {
          platform,
          isNative,
          isOnline: navigator.onLine,
          appState: 'active'
        };

        if (isNative) {
          // Get device information
          const info = await Device.getInfo();

          deviceData = {
            ...deviceData,
            deviceId: `${info.platform}-${Date.now()}`, // Generate a simple ID
            model: info.model,
            operatingSystem: info.operatingSystem,
            osVersion: info.osVersion,
            manufacturer: info.manufacturer,
            isVirtual: info.isVirtual,
            webViewVersion: info.webViewVersion
          };

          // Listen for app state changes
          App.addListener('appStateChange', (state) => {
            setDeviceInfo(prev => ({
              ...prev,
              appState: state.isActive ? 'active' : 'background'
            }));
          });

          // Listen for network status changes
          Network.addListener('networkStatusChange', (status) => {
            setDeviceInfo(prev => ({
              ...prev,
              isOnline: status.connected
            }));
          });
        } else {
          // Web-only listeners
          window.addEventListener('online', () => {
            setDeviceInfo(prev => ({ ...prev, isOnline: true }));
          });

          window.addEventListener('offline', () => {
            setDeviceInfo(prev => ({ ...prev, isOnline: false }));
          });

          // Page visibility API for web app state
          document.addEventListener('visibilitychange', () => {
            setDeviceInfo(prev => ({
              ...prev,
              appState: document.hidden ? 'background' : 'active'
            }));
          });
        }

        setDeviceInfo(deviceData);
      } catch (error) {
        console.error('Error getting device info:', error);
      } finally {
        setLoading(false);
      }
    };

    getDeviceInfo();

    // Cleanup
    return () => {
      if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
        Network.removeAllListeners();
      } else {
        window.removeEventListener('online', () => {});
        window.removeEventListener('offline', () => {});
        document.removeEventListener('visibilitychange', () => {});
      }
    };
  }, []);

  return { deviceInfo, loading };
};