import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Map, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const cities = [
  'Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia',
  'Protaras', 'Ayia Napa', 'Troodos', 'Polis', 'Paralimni'
];

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({ value, onChange, placeholder = 'Type city or address...', className }) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>(cities);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setShowSuggestions(true);
    if (val.trim()) {
      setFilteredCities(cities.filter(c => c.toLowerCase().includes(val.toLowerCase())));
    } else {
      setFilteredCities(cities);
    }
  };

  const selectCity = (city: string) => {
    setInputValue(city);
    onChange(city);
    setShowSuggestions(false);
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (inputValue && inputValue !== value) {
        onChange(inputValue);
      }
    }, 200);
  };

  const clear = () => {
    setInputValue('');
    onChange('');
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {inputValue && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 p-1 rounded hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
          {filteredCities.length > 0 ? (
            filteredCities.map(city => (
              <button
                key={city}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectCity(city)}
              >
                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                {city}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matching cities — your custom address will be used
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationInput;
