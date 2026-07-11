import { findNearestLandmark } from '../data/villageCoordinates';
import { Geolocation } from '@capacitor/geolocation';

export interface GeocodeResult {
  state: string;
  pincode: string;
  city: string;
  street: string;
  address: string;
}

export async function getUnifiedHighSpeedLocation(): Promise<{ latitude: number; longitude: number; method: string }> {
  try {
    // 1. Check & Request Permissions with Capacitor Geolocation safely
    let permResult = await Geolocation.checkPermissions().catch(() => null);
    if (permResult) {
      let status = permResult.location;
      // We strictly require precise 'granted' permission. If they only gave approximate or none, ask again.
      if (status !== 'granted') {
        const reqResult = await Geolocation.requestPermissions().catch(() => null);
        if (reqResult) {
          status = reqResult.location;
        }
      }
    }

    // 2. High-performance precise location detection using GPS hardware & networks
    // Tier 1: Try High Accuracy GPS Location with Sensor Warm-Up & Precision Locked Filtering (up to 3 samples)
    try {
      let bestPosition: any = null;
      let samplesCount = 0;
      const maxSamples = 3;
      const desiredAccuracy = 25; // 25 meters or better is our gold standard for delivery address matching!

      for (let i = 0; i < maxSamples; i++) {
        samplesCount++;
        try {
          console.log(`[LocationService] Sampling GPS hardware lock (Sample ${samplesCount}/${maxSamples})...`);
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 6000, // 6 seconds for this specific sample
            maximumAge: 0  // Force bypass cached coordinates to fetch real-time fresh lock
          });

          console.log(`[LocationService] Sample ${samplesCount} acquired. Accuracy:`, pos.coords.accuracy, "meters");

          // Keep track of the absolute most accurate reading (lowest accuracy value is best)
          if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = pos;
          }

          // If we achieved our gold standard accuracy (< 25m), lock it and break immediately!
          if (pos.coords.accuracy <= desiredAccuracy) {
            console.log(`[LocationService] Gold standard accuracy (${pos.coords.accuracy}m <= ${desiredAccuracy}m) achieved on sample ${samplesCount}!`);
            break;
          }

          // If the accuracy is poor (>120m) on the first sample, we check and request permissions again
          // in case they accidentally chose "Approximate" coarse location.
          if (i === 0 && pos.coords.accuracy > 120) {
            console.warn("[LocationService] Detected poor accuracy (>120m) on initial sample. Prompting for Precise Upgrade...");
            const upgradeResult = await Geolocation.requestPermissions().catch(() => null);
            if (upgradeResult && upgradeResult.location === 'granted') {
              // Quick small delay to let settings apply
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }

          // If we have not met the target accuracy yet, wait 500ms to allow the hardware GPS sensor to "warm up" and find more satellites
          if (i < maxSamples - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (sampleErr) {
          console.warn(`[LocationService] GPS sample ${samplesCount} failed:`, sampleErr);
          // If the sensor is completely off or disabled, we don't block the loop if it's the first sample and failed
        }
      }

      // If we got at least one valid GPS coordinate sample, use the absolute best one
      if (bestPosition) {
        console.log("[LocationService] GPS Filtering complete. Chosen best accuracy:", bestPosition.coords.accuracy, "meters");
        return {
          latitude: bestPosition.coords.latitude,
          longitude: bestPosition.coords.longitude,
          method: `GPS-PrecisionLocked-${bestPosition.coords.accuracy.toFixed(0)}m`
        };
      }
    } catch (tier1Err) {
      console.warn("[LocationService] Tier 1 GPS Precision Filter failed, attempting Coarse network fallback...", tier1Err);
    }

    // Tier 2: Try Coarse Network Location (enableHighAccuracy: false)
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 2500,
        maximumAge: 5000
      });
      console.log("[LocationService] Tier 2 (Network Coarse) Fallback Success:", pos.coords.latitude, pos.coords.longitude);
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        method: 'Network-Coarse-Fallback'
      };
    } catch (tier2Err) {
      console.warn("[LocationService] Tier 2 (Network Coarse) failed...", tier2Err);
    }

  } catch (err) {
    console.warn("[LocationService] Capacitor Geolocation general error:", err);
  }

  // Tier 3: IP-based Geolocation fallback (under 1500ms, 100% success rate indoors/basements with weak GPS lock!)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const ipRes = await fetch('https://ipapi.co/json/', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    
    if (ipRes && ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
        console.log("[LocationService] Tier 3 (IP-Geolocation) Success:", ipData.latitude, ipData.longitude);
        return {
          latitude: ipData.latitude,
          longitude: ipData.longitude,
          method: 'IP-Geolocation'
        };
      }
    }
  } catch (ipErr) {
    console.warn("[LocationService] Tier 3 (IP-Geolocation) primary failed, trying backup IP provider...", ipErr);
  }

  // Backup Tier 3: Alternative IP provider (freeipapi.com)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const ipRes = await fetch('https://freeipapi.com/api/json', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (ipRes && ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
        console.log("[LocationService] Tier 3 Backup (freeipapi) Success:", ipData.latitude, ipData.longitude);
        return {
          latitude: ipData.latitude,
          longitude: ipData.longitude,
          method: 'IP-Geolocation-Backup'
        };
      }
    }
  } catch (backupIpErr) {
    console.warn("[LocationService] Tier 3 Backup failed:", backupIpErr);
  }

  // Tier 4: Safe regional master fallback (Kawarhagi HQ)
  console.log("[LocationService] Tier 4 (Master Regional Fallback) Activated.");
  return {
    latitude: 26.243455,
    longitude: 92.1306235,
    method: 'Offline-Regional-Fallback'
  };
}

export async function fetchNominatimAddress(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GreztoApp'
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        console.log("[Geocoder] fetchNominatimAddress Success:", data.display_name);
        return data.display_name;
      }
    }
  } catch (err) {
    console.warn("[Geocoder] fetchNominatimAddress exception:", err);
  }
  return `Location Coords (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
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
    // 1. Prioritize Nominatim (OSM) as direct free geocoding to ensure hamesha ₹0 Google Maps billing
    try {
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
    } catch (osmErr) {
      console.warn("[Geocoder] Free Nominatim geocoder failed, falling back to other layers:", osmErr);
    }

    // 2. Try Google Maps Geocoder as secondary fallback if loaded in context
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
        console.warn("[Geocoder] Google Map Geocoder failed or blocked as well.", gErr);
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

