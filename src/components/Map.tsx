import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

  useEffect(() => {
    if (!mapContainer.current) return;

    // You'll need to get your Mapbox token from https://mapbox.com/
    // For now, using a placeholder - users need to add their token
    mapboxgl.accessToken = 'pk.eyJ1IjoiY2FycG9vbC1jeXBydXMiLCJhIjoiY2x3ZXh5eDAwMGZqNzJrcGRzZjRxZXBhbiJ9.placeholder';
    
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
      console.warn('Map initialization failed. Please add your Mapbox token.');
      // Fallback: show a placeholder
      if (mapContainer.current) {
        mapContainer.current.innerHTML = `
          <div class="flex items-center justify-center h-full bg-muted rounded-lg">
            <div class="text-center p-4">
              <p class="text-muted-foreground">Map requires Mapbox token</p>
              <p class="text-sm text-muted-foreground mt-2">
                Get your token from <a href="https://mapbox.com/" target="_blank" class="text-primary underline">mapbox.com</a>
              </p>
            </div>
          </div>
        `;
      }
    }

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [center, zoom, markers]);

  return <div ref={mapContainer} className={className} />;
};

export default Map;