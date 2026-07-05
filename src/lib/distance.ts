export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula to calculate distance between two lat/lng coordinates in kilometers
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export function findNearestMerchant(customerLat: number, customerLng: number, merchants: any[], requiredItem: string) {
  let nearestMerchant = null;
  let minDistance = Infinity;

  for (const merchant of merchants) {
    // 1. Check if merchant has the specific item (e.g., 'Tomato') in stock
    const hasItem = merchant.inventory?.includes(requiredItem) || true; // Replace with actual check
    
    if (hasItem) {
      // 2. Calculate distance
      const distance = calculateDistance(
        customerLat, 
        customerLng, 
        merchant.location.latitude, 
        merchant.location.longitude
      );

      // 3. Update nearest if this is closer
      if (distance < minDistance) {
        minDistance = distance;
        nearestMerchant = merchant;
      }
    }
  }

  return { nearestMerchant, distance: minDistance };
}
