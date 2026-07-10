/**
 * Calculates the geodistance between a shop and user's current coordinates using the Haversine formula.
 */
export function calculateGeodistance(
  shopLat: number,
  shopLng: number,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): string {
  const defaultLat = 26.1522;
  const defaultLng = 91.7602;
  const originLat = userLat || defaultLat;
  const originLng = userLng || defaultLng;

  const destLat = shopLat || defaultLat;
  const destLng = shopLng || defaultLng;

  if (Math.abs(originLat - destLat) < 0.00005 && Math.abs(originLng - destLng) < 0.00005) {
    return "250 m";
  }

  const R = 6371; // Earth radius in km
  const dLat = ((destLat - originLat) * Math.PI) / 180;
  const dLng = ((destLng - originLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((originLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km

  if (d < 1) {
    return `${Math.round(d * 1000)} meters`;
  }
  return `${d.toFixed(1)} km`;
}
