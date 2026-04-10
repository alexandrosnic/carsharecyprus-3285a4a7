import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';

export interface MapMarkerData {
  coordinates: [number, number];
  label: string;
  color?: string;
}

interface ClickableMapProps {
  className?: string;
  departureCoords?: [number, number] | null;
  arrivalCoords?: [number, number] | null;
  departureLabel?: string;
  arrivalLabel?: string;
  stopMarkers?: MapMarkerData[];
  selectingMode: string | null; // 'departure' | 'arrival' | 'stop-0' | 'stop-1' | etc.
  onSelectingModeChange: (mode: string | null) => void;
  onLocationPicked: (address: string, coordinates: [number, number]) => void;
}

const ClickableMap: React.FC<ClickableMapProps> = ({
  className = 'w-full h-64 rounded-lg',
  departureCoords,
  arrivalCoords,
  departureLabel,
  arrivalLabel,
  stopMarkers = [],
  selectingMode,
  onSelectingModeChange,
  onLocationPicked,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const depMarker = useRef<mapboxgl.Marker | null>(null);
  const arrMarker = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    supabase.functions.invoke('get-mapbox-token').then(({ data, error }) => {
      if (error) { setTokenError('Failed to load map'); return; }
      if (data?.token) setMapboxToken(data.token);
    });
  }, [session]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;
    mapboxgl.accessToken = mapboxToken;
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [33.3792, 35.1872],
        zoom: 9,
      });
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch {
      setTokenError('Map initialization failed');
    }
    return () => { map.current?.remove(); map.current = null; };
  }, [mapboxToken]);

  // Handle click
  useEffect(() => {
    if (!map.current || !selectingMode) return;
    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const coords: [number, number] = [lng, lat];
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1`
        );
        const data = await res.json();
        if (data.features?.length) address = data.features[0].place_name;
      } catch { /* fallback */ }
      onLocationPicked(address, coords);
      onSelectingModeChange(null);
    };
    map.current.on('click', handleClick);
    map.current.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.current?.off('click', handleClick);
      if (map.current) map.current.getCanvas().style.cursor = '';
    };
  }, [selectingMode, mapboxToken, onLocationPicked, onSelectingModeChange]);

  // Departure marker
  useEffect(() => {
    if (!map.current) return;
    depMarker.current?.remove();
    depMarker.current = null;
    if (departureCoords) {
      depMarker.current = new mapboxgl.Marker({ color: '#22c55e' })
        .setLngLat(departureCoords)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(`From: ${departureLabel || 'Departure'}`))
        .addTo(map.current);
    }
  }, [departureCoords, departureLabel]);

  // Arrival marker
  useEffect(() => {
    if (!map.current) return;
    arrMarker.current?.remove();
    arrMarker.current = null;
    if (arrivalCoords) {
      arrMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat(arrivalCoords)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(`To: ${arrivalLabel || 'Destination'}`))
        .addTo(map.current);
    }
  }, [arrivalCoords, arrivalLabel]);

  // Stop markers
  useEffect(() => {
    if (!map.current) return;
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];
    stopMarkers.forEach(sm => {
      const m = new mapboxgl.Marker({ color: sm.color || '#f59e0b' })
        .setLngLat(sm.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(sm.label))
        .addTo(map.current!);
      stopMarkersRef.current.push(m);
    });
  }, [stopMarkers]);

  // Fit bounds
  useEffect(() => {
    if (!map.current) return;
    const allCoords: [number, number][] = [];
    if (departureCoords) allCoords.push(departureCoords);
    if (arrivalCoords) allCoords.push(arrivalCoords);
    stopMarkers.forEach(sm => allCoords.push(sm.coordinates));
    if (allCoords.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      allCoords.forEach(c => bounds.extend(c));
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
    }
  }, [departureCoords, arrivalCoords, stopMarkers]);

  if (!session) {
    return <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}><p className="text-muted-foreground text-sm">Log in to view map</p></div>;
  }
  if (tokenError) {
    return <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}><p className="text-muted-foreground text-sm">{tokenError}</p></div>;
  }
  if (!mapboxToken) {
    return <div className={`${className} flex items-center justify-center bg-muted rounded-lg`}><p className="text-muted-foreground text-sm">Loading map...</p></div>;
  }

  return (
    <div className="space-y-2">
      <div ref={mapContainer} className={className} />
      {selectingMode && (
        <p className="text-xs text-primary font-medium text-center animate-pulse">
          Click on the map to select location
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={selectingMode === 'departure' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onSelectingModeChange(selectingMode === 'departure' ? null : 'departure')}
        >
          <Navigation className="h-3 w-3 mr-1" />
          {selectingMode === 'departure' ? 'Click map...' : 'Pick departure'}
        </Button>
        <Button
          type="button"
          variant={selectingMode === 'arrival' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onSelectingModeChange(selectingMode === 'arrival' ? null : 'arrival')}
        >
          <MapPin className="h-3 w-3 mr-1" />
          {selectingMode === 'arrival' ? 'Click map...' : 'Pick destination'}
        </Button>
      </div>
    </div>
  );
};

export default ClickableMap;
