import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MapProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    coordinates: [number, number];
    title: string;
    description?: string;
  }>;
}

const Map: React.FC<MapProps> = ({ 
  className = "w-full h-64 rounded-lg", 
  center = [33.3792, 35.1872], // Cyprus coordinates
  zoom = 10,
  markers = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { session } = useAuth();

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      if (!session) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error: any) {
        console.error('Error fetching Mapbox token:', error);
        setTokenError('Failed to load map token');
      }
    };

    fetchMapboxToken();
  }, [session]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: center,
        zoom: zoom,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add markers
      markers.forEach(marker => {
        if (map.current) {
          new mapboxgl.Marker()
            .setLngLat(marker.coordinates)
            .setPopup(
              new mapboxgl.Popup({ offset: 25 })
                .setText(`${marker.title}${marker.description ? ` - ${marker.description}` : ''}`)
            )
            .addTo(map.current);
        }
      });

    } catch (error) {
      console.error('Map initialization failed:', error);
      setTokenError('Map initialization failed');
    }

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [center, zoom, markers, mapboxToken]);

  // Show loading or error state
  if (!session) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}>
        <p className="text-muted-foreground">Please log in to view maps</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}>
        <div className="text-center p-4">
          <p className="text-muted-foreground">{tokenError}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Check your Mapbox configuration
          </p>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}>
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return <div ref={mapContainer} className={className} />;
};

export default Map;