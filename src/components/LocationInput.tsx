import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const searchNominatim = useCallback(async (query: string): Promise<LocationResult[]> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&viewbox=32.0,35.75,34.7,34.4&bounded=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      return (data || []).map((item: any) => ({
        label: item.display_name,
        fullAddress: item.display_name,
        coordinates: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
      }));
    } catch (err) {
      console.error('Nominatim error:', err);
      return [];
    }
  }, []);

  const searchMapbox = useCallback(async (query: string) => {
    if (query.length < 2) return;
    setLoading(true);
    try {
      // Search Mapbox (addresses & places)
      let mapboxResults: LocationResult[] = [];
      if (mapboxToken) {
        const bbox = '32.0,34.4,34.7,35.75';
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&bbox=${bbox}&limit=5&types=place,locality,neighborhood,address,poi&proximity=33.38,35.17`
        );
        const data = await res.json();
        mapboxResults = (data.features || []).map((f: any) => ({
          label: f.place_name || f.text,
          fullAddress: f.place_name,
          coordinates: f.center as [number, number],
        }));
      }

      // Search Nominatim (better POI coverage - shops, landmarks, etc.)
      const nominatimResults = await searchNominatim(query);

      // Merge results: city matches first, then Mapbox, then Nominatim (deduplicated)
      const cityMatches: LocationResult[] = cities
        .filter(c => c.toLowerCase().includes(query.toLowerCase()))
        .map(c => ({ label: c, fullAddress: c }));

      const seen = new Set(cityMatches.map(s => s.label.toLowerCase()));
      const uniqueMapbox = mapboxResults.filter(s => !seen.has(s.label.toLowerCase()));
      uniqueMapbox.forEach(s => seen.add(s.label.toLowerCase()));
      const uniqueNominatim = nominatimResults.filter(s => !seen.has(s.label.toLowerCase()));

      setSuggestions([...cityMatches, ...uniqueMapbox, ...uniqueNominatim].slice(0, 8));
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

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
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
      </div>

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
  );
};

export default LocationInput;
