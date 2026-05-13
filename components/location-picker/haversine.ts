export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface CityWithCoords {
  slug: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
}

export interface NearbyCityResult extends CityWithCoords {
  distance: number;
}

export function getNearbyCities(
  visitor: { lat: number; lng: number },
  cities: CityWithCoords[],
  radiusKm = 50,
  limit = 3,
): NearbyCityResult[] {
  return cities
    .map((c) => ({ ...c, distance: haversine(visitor.lat, visitor.lng, c.lat, c.lng) }))
    .filter((c) => c.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
