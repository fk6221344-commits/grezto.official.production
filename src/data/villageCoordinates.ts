// Authentic regional landmarks for Kawarhagi, Assam (Pincode: 782411)
export const LOCAL_MAP_LANDMARKS = [
  {
    name: "Mitreno Tech HQ",
    lat: 26.243455,
    lng: 92.1306235,
    pincode: "782411",
    state: "Assam",
    street: "Kawarhagi, Mitreno Tech Road",
  },
  {
    name: "Kawarhagi baramari assam",
    lat: 26.244,
    lng: 92.131,
    pincode: "782411",
    state: "Assam",
    street: "jhaegaon baramari",
  },
  {
    name: "Mitreno Tech Road East",
    lat: 26.2425,
    lng: 92.1295,
    pincode: "782411",
    state: "Assam",
    street: "Mitreno Tech Road",
  },
  {
    name: "Kawarhagi Village",
    lat: 26.2432,
    lng: 92.1302,
    pincode: "782411",
    state: "Assam",
    street: "Kawarhagi baramari road",
  },
];

export function findNearestLandmark(lat: number, lng: number) {
  let nearest = LOCAL_MAP_LANDMARKS[0];
  let minDistance = Infinity;
  for (const item of LOCAL_MAP_LANDMARKS) {
    const dLat = item.lat - lat;
    const dLng = item.lng - lng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = item;
    }
  }
  return nearest;
}
