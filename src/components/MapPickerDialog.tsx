import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface MapPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (address: string, coordinates: [number, number]) => void;
  mapboxToken: string;
  initialCenter?: [number, number];
}

const MapPickerDialog: React.FC<MapPickerDialogProps> = ({
  open, onClose, onSelect, mapboxToken, initialCenter = [33.3792, 35.1872]
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=1`
      );
      const data = await res.json();
      if (data.features?.length) {
        return data.features[0].place_name;
      }
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, [mapboxToken]);

  useEffect(() => {
    if (!open || !mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Small delay for dialog animation
    const timer = setTimeout(() => {
      if (!mapContainer.current) return;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: 10,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        const coords: [number, number] = [lng, lat];

        if (marker.current) {
          marker.current.setLngLat(coords);
        } else {
          marker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat(coords)
            .addTo(map.current!);
        }

        setSelectedCoords(coords);
        const address = await reverseGeocode(lng, lat);
        setSelectedAddress(address);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      setSelectedAddress('');
      setSelectedCoords(null);
    };
  }, [open, mapboxToken, initialCenter, reverseGeocode]);

  const handleConfirm = () => {
    if (selectedCoords && selectedAddress) {
      onSelect(selectedAddress, selectedCoords);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Choose location on map
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Click on the map to select a location</p>
        <div ref={mapContainer} className="w-full h-80 rounded-lg border border-border" />
        {selectedAddress && (
          <div className="p-3 bg-accent/50 rounded-lg">
            <p className="text-sm font-medium truncate">{selectedAddress}</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selectedCoords}>
            Select this location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapPickerDialog;
