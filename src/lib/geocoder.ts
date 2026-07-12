import { findNearestLandmark } from '../data/villageCoordinates';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface GeocodeResult {
  state: string;
  pincode: string;
  city: string;
  street: string;
  address: string;
}

export async function getUnifiedHighSpeedLocation(): Promise<{ latitude: number; longitude: number; method: string }> {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    console.log("[LocationService] Running on Web Browser. Requesting precise HTML5 Geolocation...");
    
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        console.log("[LocationService] Web GPS accurate match!", pos.coords.latitude, pos.coords.longitude, "accuracy:", pos.coords.accuracy);
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          method: `Web-GPS-${pos.coords.accuracy.toFixed(0)}m`
        };
      } catch (webErr) {
        console.warn("[LocationService] Web Geolocation failed or was denied:", webErr);
      }
    }
    
    throw new Error("Browser/Web location is blocked or inaccurate. Live high-precision GPS auto-lock works 100% on our Native Android App. Please type your address manually here or download the App!");
  }

  try {
    let permResult = await Geolocation.checkPermissions().catch(() => null);
    if (permResult) {
      let status = permResult.location;
      if (status !== 'granted') {
        const reqResult = await Geolocation.requestPermissions().catch(() => null);
        if (reqResult) {
          status = reqResult.location;
        }
      }
      if (status !== 'granted') {
        throw new Error("Android Location (GPS) permission was denied. Please enable it in Settings.");
      }
    }

    try {
      console.log("[LocationService] [Native] Checking cached location...");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 1500,
        maximumAge: 45000
      });
      if (pos && pos.coords && pos.coords.accuracy <= 25) {
        console.log("[LocationService] [Native] Cached GPS Match! Accuracy:", pos.coords.accuracy);
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          method: `GPS-CachedPrecise-${pos.coords.accuracy.toFixed(0)}m`
        };
      }
    } catch (tier0Err) {
      console.log("[LocationService] Cached GPS check failed:", tier0Err);
    }

    try {
      console.log("[LocationService] [Native] Starting Active GPS Settle...");
      const preciseCoords = await new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
        let bestPos: { latitude: number; longitude: number; accuracy: number } | null = null;
        let watchId: string | null = null;
        
        const timeoutTimer = setTimeout(() => {
          if (watchId) {
            Geolocation.clearWatch({ id: watchId }).catch(() => {});
          }
          if (bestPos) {
            resolve(bestPos);
          } else {
            reject(new Error("Active GPS timed out."));
          }
        }, 12000);

        Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 13000,
          maximumAge: 0
        }, (position, err) => {
          if (err) {
            console.warn("[LocationService] Watch position error:", err);
            return;
          }
          if (position && position.coords) {
            const acc = position.coords.accuracy;
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            if (!bestPos || acc < bestPos.accuracy) {
              bestPos = { latitude: lat, longitude: lng, accuracy: acc };
            }
            
            if (acc <= 15) {
              clearTimeout(timeoutTimer);
              if (watchId) {
                Geolocation.clearWatch({ id: watchId }).catch(() => {});
              }
              resolve({ latitude: lat, longitude: lng, accuracy: acc });
            }
          }
        }).then(id => {
          watchId = id;
        }).catch(e => {
          console.warn("[LocationService] Failed to watch position:", e);
        });
      });

      return {
        latitude: preciseCoords.latitude,
        longitude: preciseCoords.longitude,
        method: `GPS-WatchSettle-${preciseCoords.accuracy.toFixed(0)}m`
      };

    } catch (watchErr) {
      console.warn("[LocationService] GPS Settle failed, trying standard getCurrentPosition...", watchErr);
    }

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      console.log("[LocationService] [Native] Standard GPS success. Accuracy:", pos.coords.accuracy);
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        method: `GPS-CurrentPos-${pos.coords.accuracy.toFixed(0)}m`
      };
    } catch (tier1Err) {
      console.warn("[LocationService] [Native] Standard high accuracy failed:", tier1Err);
    }

  } catch (err: any) {
    console.warn("[LocationService] Native Geolocation error:", err);
    throw new Error(err?.message || "GPS failed. Please ensure Device Location (GPS) is ON.");
  }

  throw new Error("GPS signal is weak or offline. Please make sure you are not indoors and Location (GPS) is ON, or type your address manually.");
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
  // Find nearest master hub among our active hubs
  const defaultMasterHubs = [
    { name: 'Kawarhagi', lat: 26.243455, lng: 92.1306235, pincode: '782411', state: 'Assam' },
    { name: 'Guwahati', lat: 26.1158, lng: 91.7086, pincode: '781001', state: 'Assam' },
    { name: 'Morigaon', lat: 26.2458, lng: 92.2618, pincode: '782105', state: 'Assam' }
  ];

  let nearestHub = defaultMasterHubs[0];
  let minHubDist = Infinity;
  for (const hub of defaultMasterHubs) {
    const dy = lat - hub.lat;
    const dx = lng - hub.lng;
    const d = Math.sqrt(dy * dy + dx * dx);
    if (d < minHubDist) {
      minHubDist = d;
      nearestHub = hub;
    }
  }

  // If we are within ~40km (0.4 degrees) of any active hub, we consider them within that hub's region
  const isCloseToHub = minHubDist < 0.4;

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
          const state = ad.state || ad.region || (isCloseToHub ? nearestHub.state : 'India');
          const pincode = ad.postcode || (isCloseToHub ? nearestHub.pincode : '');
          
          // Resolve natural city/town/village/suburb from OSM details, falling back to hub only if totally empty
          const resolvedCity = ad.city || ad.town || ad.village || ad.suburb || ad.locality || ad.neighbourhood || ad.neighborhood || ad.municipality || ad.county || (isCloseToHub ? nearestHub.name : 'Selected Location');
          
          const localArea = ad.village || ad.suburb || ad.town || ad.neighbourhood || ad.neighborhood || ad.locality || '';
          const road = ad.road || ad.pedestrian || ad.house_number || ad.amenity || '';
          
          let streetVal = '';
          if (road && localArea && road !== localArea) {
            streetVal = `${road}, ${localArea}`;
          } else {
            streetVal = road || localArea || 'Location Point';
          }

          const finalAddr = data.display_name || `${streetVal}, ${resolvedCity}, ${state}${pincode ? ` (Pin - ${pincode})` : ''}`;

          return {
            state: state || 'Other State',
            pincode: pincode || '',
            city: resolvedCity || 'City/Village',
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
          if (!state) state = isCloseToHub ? nearestHub.state : 'India';
          
          let resolvedCity = city || 'Selected Location';
          if (isCloseToHub) {
            city = nearestHub.name;
            if (resolvedCity && resolvedCity !== nearestHub.name) {
              street = street ? `${street}, ${resolvedCity}` : resolvedCity;
            }
          } else {
            city = resolvedCity;
          }
          
          if (!pincode) pincode = isCloseToHub ? nearestHub.pincode : '';

          const address = `${street || 'Street Point'}, ${city}, ${state}${pincode ? ` (Pin - ${pincode})` : ''}`.trim();
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
  const isSuperCloseToHub = minHubDist < 0.015; // Within ~1.5km of hub landmarks
  if (isSuperCloseToHub && nearestHub.name === 'Kawarhagi') {
    const nearest = findNearestLandmark(lat, lng);
    return {
      state: nearest.state,
      pincode: nearest.pincode,
      city: 'Kawarhagi',
      street: nearest.name,
      address: `${nearest.name}, Kawarhagi, Assam (Pin - ${nearest.pincode})`
    };
  }

  // Outside any super-close range: Represent raw Coordinates gracefully with the regional city fallback
  const rawStreet = `GPS Pin (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  return {
    state: nearestHub.state || 'Assam',
    pincode: nearestHub.pincode || '',
    city: nearestHub.name || 'Location Point',
    street: rawStreet,
    address: `${rawStreet}, ${nearestHub.name}, Assam`
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

