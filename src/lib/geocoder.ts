import { findNearestLandmark } from '../data/villageCoordinates';

export interface GeocodeResult {
  state: string;
  pincode: string;
  city: string;
  street: string;
  address: string;
}

export async function reverseGeocodeCoords(lat: number, lng: number): Promise<GeocodeResult> {
  // Determine distance to master Morigaon center (Kawarhagi)
  const morigaonLat = 26.243455;
  const morigaonLng = 92.1306235;
  const dLat = lat - morigaonLat;
  const dLng = lng - morigaonLng;
  const distanceDegrees = Math.sqrt(dLat * dLat + dLng * dLng);

  // If we are within 0.25 degrees (~25km) of Morigaon center, use local landmarks fallback safely
  const isCloseToHub = distanceDegrees < 0.25;

  try {
    // 1. Try Google Maps Geocoder if loaded in context
    if (typeof window !== 'undefined' && typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      try {
        const geocoder = new google.maps.Geocoder();
        const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ location: { lat, lng } }, (res, status) => {
            if (status === 'OK' && res) {
              resolve(res);
            } else {
              reject(new Error(`Google Geocode status: ${status}`));
            }
          });
        });

        if (results && results[0]) {
          const addressComponents = results[0].address_components;
          let state = '';
          let pincode = '';
          let city = '';
          let street = '';

          for (const comp of addressComponents) {
            const types = comp.types;
            if (types.includes('administrative_area_level_1')) {
              state = comp.long_name;
            } else if (types.includes('postal_code')) {
              pincode = comp.long_name;
            } else if (
              types.includes('locality') ||
              types.includes('sublocality_level_1') ||
              types.includes('administrative_area_level_3')
            ) {
              city = comp.long_name;
            } else if (
              types.includes('route') ||
              types.includes('sublocality_level_2') ||
              types.includes('neighborhood') ||
              types.includes('premise')
            ) {
              street = comp.long_name;
            }
          }

          if (!street) {
            const parts = results[0].formatted_address.split(',');
            if (parts.length > 0) street = parts[0].trim();
          }

          // Dynamic fallback based on location proximity
          if (!state) state = isCloseToHub ? 'Assam' : 'India';
          if (!city) city = isCloseToHub ? 'Kawarhagi' : 'Selected Location';
          if (!pincode) pincode = isCloseToHub ? '782411' : '';

          const address = `${street || 'Street Point'}, ${city}, ${state} ${pincode ? `(Pin - ${pincode})` : ''}`.trim();
          return { state, pincode, city, street: street || 'Street Point', address };
        }
      } catch (gErr) {
        console.warn("[Geocoder] Google Map Geocoder failed or blocked, trying Nominatim fallback...", gErr);
      }
    }

    // 2. Try Nominatim (OSM) as a direct network geocode with safe custom User-Agent to avoid blocks
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GreztoApp-GPS-Precision-Locator/2.0 (contact: fk6221344@gmail.com)'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const ad = data.address;
        const state = ad.state || ad.region || (isCloseToHub ? 'Assam' : '');
        const pincode = ad.postcode || (isCloseToHub ? '782411' : '');
        const city = ad.city || ad.town || ad.village || ad.suburb || ad.locality || (isCloseToHub ? 'Kawarhagi' : '');
        const street = ad.road || ad.suburb || ad.neighborhood || ad.neighbourhood || ad.pedestrian || ad.house_number || ad.amenity || '';

        const formattedParts = data.display_name ? data.display_name.split(',') : [];
        const streetVal = street || (formattedParts.length > 0 ? formattedParts[0].trim() : 'Location Point');
        const finalAddr = data.display_name || `${streetVal}, ${city}, ${state} (Pin - ${pincode})`;

        return {
          state: state || 'Other State',
          pincode: pincode || '',
          city: city || 'City/Village',
          street: streetVal,
          address: finalAddr
        };
      }
    }
  } catch (error) {
    console.warn("[Geocoder] High performance reverse geocoding exception, using offline match state:", error);
  }

  // 3. Absolute Proximity Fallback: if offline or both APIs failed
  if (isCloseToHub) {
    const nearest = findNearestLandmark(lat, lng);
    return {
      state: nearest.state,
      pincode: nearest.pincode,
      city: nearest.name,
      street: nearest.street,
      address: `${nearest.street}, ${nearest.name}, ${nearest.state} (Pin - ${nearest.pincode})`
    };
  }

  // Outside Assam / Local Region: Represent raw Coordinates gracefully
  const rawStreet = `Location Pin (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`;
  return {
    state: '',
    pincode: '',
    city: 'Location Point',
    street: rawStreet,
    address: `${rawStreet}, India`
  };
}

export async function forwardGeocodeAddress(
  state: string,
  pincode: string,
  city: string,
  street: string
): Promise<{ lat: number; lng: number } | null> {
  const queryParts = [street, city, state, pincode].map(v => v ? v.trim() : '').filter(Boolean);
  if (queryParts.length === 0) return null;
  const query = queryParts.join(', ');

  // 1. Try Google Maps Geocoder if available
  if (typeof window !== 'undefined' && typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
    try {
      const geocoder = new google.maps.Geocoder();
      const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address: query }, (res, status) => {
          if (status === 'OK' && res) {
            resolve(res);
          } else {
            reject(new Error(`Google Geocode status: ${status}`));
          }
        });
      });
      if (results && results[0] && results[0].geometry && results[0].geometry.location) {
        const loc = results[0].geometry.location;
        return { lat: loc.lat(), lng: loc.lng() };
      }
    } catch (gErr) {
      console.warn("[Geocoder] Google Map Geocoder forward failed, trying Nominatim forward...", gErr);
    }
  }

  // 2. Try Nominatim (OSM) Forward Geocoding
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GreztoApp-GPS-Precision-Locator/2.0 (contact: fk6221344@gmail.com)'
      }
    });
    if (response.ok) {
      const results = await response.json();
      if (results && results.length > 0) {
        const item = results[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (err) {
    console.warn("[Geocoder] Nominatim forward search exception:", err);
  }

  return null;
}

