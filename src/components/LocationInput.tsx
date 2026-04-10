import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, X, Loader2, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MapPickerDialog from '@/components/MapPickerDialog';

const cities = [
  'Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia',
  'Protaras', 'Ayia Napa', 'Troodos', 'Polis', 'Paralimni'
];

export interface LocationResult {
  label: string;
  fullAddress: string;
  coordinates?: [number, number];
}

interface LocationInputProps {
  value: string;
  onChange: (value: string, result?: LocationResult) => void;
  placeholder?: string;
  className?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({ value, onChange, placeholder = 'Type city or address...', className }) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    supabase.functions.invoke('get-mapbox-token').then(({ data, error }) => {
      if (!error && data?.token) setMapboxToken(data.token);
    });
  }, [session]);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchMapbox = useCallback(async (query: string) => {
    if (!mapboxToken || query.length < 2) return;
    setLoading(true);
    try {
      const bbox = '32.0,34.5,34.6,35.7';
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&bbox=${bbox}&limit=5&types=place,locality,neighborhood,address,poi&country=cy`
      );
      const data = await res.json();
      const mapboxResults: LocationResult[] = (data.features || []).map((f: any) => ({
        label: f.place_name || f.text,
        fullAddress: f.place_name,
        coordinates: f.center as [number, number],
      }));
      const cityMatches: LocationResult[] = cities
        .filter(c => c.toLowerCase().includes(query.toLowerCase()))
        .map(c => ({ label: c, fullAddress: c }));
      const seen = new Set(cityMatches.map(s => s.label.toLowerCase()));
      const unique = mapboxResults.filter(s => !seen.has(s.label.toLowerCase()));
      setSuggestions([...cityMatches, ...unique]);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setLoading(false);
    }
  }, [mapboxToken]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setShowSuggestions(true);

    const cityMatches: LocationResult[] = cities
      .filter(c => c.toLowerCase().includes(val.toLowerCase()))
      .map(c => ({ label: c, fullAddress: c }));
    setSuggestions(cityMatches);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length >= 2 && mapboxToken) {
      debounceRef.current = setTimeout(() => searchMapbox(val), 350);
    }
  };

  const selectSuggestion = (suggestion: LocationResult) => {
    setInputValue(suggestion.label);
    onChange(suggestion.fullAddress, suggestion);
    setShowSuggestions(false);
  };

  const confirmCustomAddress = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim(), { label: inputValue.trim(), fullAddress: inputValue.trim() });
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmCustomAddress();
    }
  };

  const clear = () => { setInputValue(''); onChange(''); };

  const handleMapSelect = (address: string, coordinates: [number, number]) => {
    setInputValue(address);
    onChange(address, { label: address, fullAddress: address, coordinates });
  };

  return (
    <div ref={wrapperRef} className={cn('space-y-2', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (inputValue) handleInputChange(inputValue);
            else { setSuggestions(cities.map(c => ({ label: c, fullAddress: c }))); setShowSuggestions(true); }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {loading && <Loader2 className="absolute right-9 top-3 h-4 w-4 text-muted-foreground animate-spin" />}
        {inputValue && (
          <button type="button" onClick={clear} className="absolute right-2 top-2 p-1 rounded hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
              >
                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
            {/* Always show "Use this address" when typing custom text */}
            {inputValue.length >= 2 && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2 border-t border-border text-primary font-medium"
                onMouseDown={(e) => e.preventDefault()}
                onClick={confirmCustomAddress}
              >
                <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                Use "{inputValue}" as address
              </button>
            )}
          </div>
        )}
      </div>

      {mapboxToken && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowMapPicker(true)}
        >
          <Map className="h-4 w-4 mr-2" />
          Choose on map
        </Button>
      )}

      {mapboxToken && (
        <MapPickerDialog
          open={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onSelect={handleMapSelect}
          mapboxToken={mapboxToken}
        />
      )}
    </div>
  );
};

export default LocationInput;
