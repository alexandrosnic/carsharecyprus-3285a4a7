// Static lookup table for estimated travel times between Cyprus cities (in minutes)
// Based on approximate driving distances via main roads

type CityPair = Record<string, Record<string, number>>;

const travelTimes: CityPair = {
  'Nicosia': {
    'Limassol': 75, 'Larnaca': 50, 'Paphos': 150, 'Famagusta': 65,
    'Kyrenia': 30, 'Protaras': 80, 'Ayia Napa': 85, 'Troodos': 75,
    'Polis': 170, 'Paralimni': 75,
  },
  'Limassol': {
    'Nicosia': 75, 'Larnaca': 70, 'Paphos': 70, 'Famagusta': 130,
    'Kyrenia': 100, 'Protaras': 140, 'Ayia Napa': 145, 'Troodos': 45,
    'Polis': 110, 'Paralimni': 135,
  },
  'Larnaca': {
    'Nicosia': 50, 'Limassol': 70, 'Paphos': 140, 'Famagusta': 55,
    'Kyrenia': 80, 'Protaras': 45, 'Ayia Napa': 50, 'Troodos': 100,
    'Polis': 175, 'Paralimni': 40,
  },
  'Paphos': {
    'Nicosia': 150, 'Limassol': 70, 'Larnaca': 140, 'Famagusta': 200,
    'Kyrenia': 175, 'Protaras': 195, 'Ayia Napa': 200, 'Troodos': 80,
    'Polis': 40, 'Paralimni': 190,
  },
  'Famagusta': {
    'Nicosia': 65, 'Limassol': 130, 'Larnaca': 55, 'Paphos': 200,
    'Kyrenia': 80, 'Protaras': 20, 'Ayia Napa': 15, 'Troodos': 130,
    'Polis': 220, 'Paralimni': 15,
  },
  'Kyrenia': {
    'Nicosia': 30, 'Limassol': 100, 'Larnaca': 80, 'Paphos': 175,
    'Famagusta': 80, 'Protaras': 100, 'Ayia Napa': 105, 'Troodos': 95,
    'Polis': 190, 'Paralimni': 95,
  },
  'Protaras': {
    'Nicosia': 80, 'Limassol': 140, 'Larnaca': 45, 'Paphos': 195,
    'Famagusta': 20, 'Kyrenia': 100, 'Ayia Napa': 10, 'Troodos': 140,
    'Polis': 220, 'Paralimni': 5,
  },
  'Ayia Napa': {
    'Nicosia': 85, 'Limassol': 145, 'Larnaca': 50, 'Paphos': 200,
    'Famagusta': 15, 'Kyrenia': 105, 'Protaras': 10, 'Troodos': 145,
    'Polis': 225, 'Paralimni': 10,
  },
  'Troodos': {
    'Nicosia': 75, 'Limassol': 45, 'Larnaca': 100, 'Paphos': 80,
    'Famagusta': 130, 'Kyrenia': 95, 'Protaras': 140, 'Ayia Napa': 145,
    'Polis': 100, 'Paralimni': 135,
  },
  'Polis': {
    'Nicosia': 170, 'Limassol': 110, 'Larnaca': 175, 'Paphos': 40,
    'Famagusta': 220, 'Kyrenia': 190, 'Protaras': 220, 'Ayia Napa': 225,
    'Troodos': 100, 'Paralimni': 215,
  },
  'Paralimni': {
    'Nicosia': 75, 'Limassol': 135, 'Larnaca': 40, 'Paphos': 190,
    'Famagusta': 15, 'Kyrenia': 95, 'Protaras': 5, 'Ayia Napa': 10,
    'Troodos': 135, 'Polis': 215,
  },
};

export function getEstimatedDuration(from: string, to: string): number | null {
  return travelTimes[from]?.[to] ?? null;
}

// Approximate distance (km) based on travel time at average Cyprus highway speed (~70 km/h)
export function getEstimatedDistanceKm(from: string, to: string): number | null {
  const minutes = getEstimatedDuration(from, to);
  if (minutes == null) return null;
  return Math.round((minutes / 60) * 70);
}

// Price ceiling: drivers must not profit. Cyprus fuel + minor wear estimate.
export const MAX_PRICE_PER_KM = 0.20;

export function getMaxPricePerSeat(from: string, to: string): number | null {
  const km = getEstimatedDistanceKm(from, to);
  if (km == null) return null;
  return Math.round(km * MAX_PRICE_PER_KM * 100) / 100;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
