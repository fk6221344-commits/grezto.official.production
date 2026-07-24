import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { calculateDistance } from '../lib/distance';
import { reverseGeocodeCoords, forwardGeocodeAddress, getUnifiedHighSpeedLocation, getCachedPreFetchedLocation } from '../lib/geocoder';

export const MORIGAON_CENTER = { lat: 26.243461, lng: 92.130617 };

let cachedGoogleMapsKey = '';

// Attempt to pre-fetch the key immediately as soon as the bundle loads so it is ready before Checkout is visited
if (typeof window !== 'undefined') {
  fetch('/api/maps/config')
    .then(res => res.json())
    .then(data => {
      if (data && data.key) {
        cachedGoogleMapsKey = data.key;
      }
    })
    .catch(() => {});
}

interface UseCheckoutGPSProps {
  user: any;
  updateProfile: (profile: any) => void;
  subtotal: number;
  items?: any[];
}

export function useCheckoutGPS({ user, updateProfile, subtotal, items }: UseCheckoutGPSProps) {
  const cameraBounceRef = useRef<any>(null);

  // Clear debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (cameraBounceRef.current) clearTimeout(cameraBounceRef.current);
    };
  }, []);

  // Map coordinate center tracking
  const [coords, setCoords] = useState({ 
    lat: user.lat || MORIGAON_CENTER.lat, 
    lng: user.lng || MORIGAON_CENTER.lng 
  });

  const getSavedDetails = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('grezto_delivery_details');
        if (saved) return JSON.parse(saved);
      } catch(e) {}
    }
    return null;
  };
  const initialDetails = getSavedDetails();

  const [nameVal, setNameVal] = useState(initialDetails?.name || '');
  const [cityVal, setCityVal] = useState(initialDetails?.city || '');
  const [areaVal, setAreaVal] = useState(initialDetails?.area || '');
  const [landmarkVal, setLandmarkVal] = useState(initialDetails?.landmark || '');
  const [isDetailsSubmitted, setIsDetailsSubmitted] = useState(!!initialDetails);

  // Track last interaction mode to prevent geocoding loop feedback
  const [lastInteraction, setLastInteraction] = useState<'map' | 'text'>('map');

  const [googleMapsKey, setGoogleMapsKey] = useState<string>(() => {
    if (cachedGoogleMapsKey) return cachedGoogleMapsKey;
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("grezto_google_maps_key");
      if (cached) return cached;
    }
    return "";
  });

  // Fetch verified API Key securely from Server Configuration on component load
  useEffect(() => {
    if (googleMapsKey) return;

    // 1. Check direct env variable
    const directEnvKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY;
    if (directEnvKey) {
      cachedGoogleMapsKey = directEnvKey;
      setGoogleMapsKey(directEnvKey);
      return;
    }

    // 2. Fetch using dynamic absolute path to support APK remote host address
    import("../services/apiConfig").then(({ getAbsoluteApiUrl }) => {
      fetch(getAbsoluteApiUrl("/api/maps/config"))
        .then((res) => res.json())
        .then((data) => {
          if (data && data.key) {
            cachedGoogleMapsKey = data.key;
            localStorage.setItem("grezto_google_maps_key", data.key);
            setGoogleMapsKey(data.key);
          }
        })
        .catch((err) => {
          console.error("Error loading maps dynamic key in Checkout GPS hook:", err);
        });
    });
  }, [googleMapsKey]);

  // Automatic GPS Sync and calculations
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number, lng: number }>({ 
    lat: user.lat || MORIGAON_CENTER.lat, 
    lng: user.lng || MORIGAON_CENTER.lng 
  });
  const [gpsAddress, setGpsAddress] = useState(user.address || '');
  const [distanceToHub, setDistanceToHub] = useState<number | null>(null);

  const updateRoadDistance = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/distance?originLat=${lat}&originLng=${lng}&destLat=${MORIGAON_CENTER.lat}&destLng=${MORIGAON_CENTER.lng}`);
      const data = await res.json();
      if (data && typeof data.distance === 'number') {
        setDistanceToHub(data.distance);
      } else {
        const dist = calculateDistance(lat, lng, MORIGAON_CENTER.lat, MORIGAON_CENTER.lng);
        setDistanceToHub(dist);
      }
    } catch (err) {
      console.error("Failed to fetch road distance:", err);
      const dist = calculateDistance(lat, lng, MORIGAON_CENTER.lat, MORIGAON_CENTER.lng);
      setDistanceToHub(dist);
    }
  };

  // Real-time automatic synchronization of address details, GPS marker, and distance calculation metrics
  useEffect(() => {
    const compiledAddress = `${areaVal.trim() ? areaVal.trim() + ', ' : ''}${cityVal.trim()}, Landmark: ${landmarkVal.trim()}`;
    setGpsAddress(prev => prev !== compiledAddress ? compiledAddress : prev);
    setGpsCoords(prev => (prev.lat === coords.lat && prev.lng === coords.lng) ? prev : { lat: coords.lat, lng: coords.lng });
    
    updateRoadDistance(coords.lat, coords.lng);

    // Save of location status lazily to user context only if actually shifted
    const debounceTimer = setTimeout(() => {
      if (
        user.address !== compiledAddress ||
        user.lat !== coords.lat ||
        user.lng !== coords.lng
      ) {
        updateProfile({
          address: compiledAddress,
          lat: coords.lat,
          lng: coords.lng
        });
      }
    }, 1200);

    return () => clearTimeout(debounceTimer);
  }, [coords.lat, coords.lng, cityVal, areaVal, landmarkVal]);

  const applyLocationDetails = async (lat: number, lng: number) => {
    setLastInteraction('text');
    setCoords({ lat, lng });
    setGpsCoords({ lat, lng });
    await updateRoadDistance(lat, lng);
    // Reverse geocoding removed to ensure $0 billing as per hybrid zero-billing strategy
  };

  const fetchAutomaticGPSDetails = async (forceFresh = false) => {
    setGpsLoading(true);
    setLastInteraction('text');
    try {
      // Check if we are inside an iframe (like the AI Studio editor preview window)
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;

      if (isIframe) {
        console.log("[Checkout GPS] Iframe environment detected. Skipping live GPS to prevent iframe-lock.");
        const lat = user.lat || MORIGAON_CENTER.lat;
        const lng = user.lng || MORIGAON_CENTER.lng;
        applyLocationDetails(lat, lng);
        return;
      }

      console.log("[Checkout GPS] Fetching multi-tier high speed location...");
      try {
        let location: any = forceFresh ? null : getCachedPreFetchedLocation();
        if (location) {
          console.log("[Checkout GPS] 0-second Optimistic Load! Using background pre-fetched location.");
        } else {
          location = await getUnifiedHighSpeedLocation();
        }
        applyLocationDetails(location.latitude, location.longitude); // No await, instantly move map
        toast.success(`Location locked instantly! (${location.method})`, { duration: 1500 });
      } catch (nativeErr: any) {
        console.warn("[Checkout GPS] Multi-tier Geolocation lookup failed:", nativeErr);
        
        // Final fallback: use previous coords or center
        const lat = user.lat || MORIGAON_CENTER.lat;
        const lng = user.lng || MORIGAON_CENTER.lng;
        applyLocationDetails(lat, lng);
        toast.error("GPS access failed. Please enable location services on your device.");
      }
    } catch (err: any) {
      console.warn("Location synchronization error:", err);
    } finally {
      setTimeout(() => {
        setGpsLoading(false);
      }, 400);
    }
  };

  // Run automatically on load to set original hub metrics
  useEffect(() => {
    fetchAutomaticGPSDetails();
    
    const startLat = user.lat || MORIGAON_CENTER.lat;
    const startLng = user.lng || MORIGAON_CENTER.lng;
    updateRoadDistance(startLat, startLng);
    
    if (user.address) {
      setGpsAddress(user.address);
    } else {
      const combinedDefault = `${areaVal}, ${cityVal}, Landmark: ${landmarkVal}`;
      setGpsAddress(combinedDefault);
    }
  }, []);

  const handleCameraChange = useCallback((ev: any) => {
    if (!ev.detail?.center) return;
    const newLat = ev.detail.center.lat;
    const newLng = ev.detail.center.lng;
    
    setLastInteraction('map');

    if (cameraBounceRef.current) {
      clearTimeout(cameraBounceRef.current);
    }

    cameraBounceRef.current = setTimeout(() => {
      setCoords(prev => {
        if (Math.abs(prev.lat - newLat) > 0.00001 || Math.abs(prev.lng - newLng) > 0.00001) {
          return { lat: newLat, lng: newLng };
        }
        return prev;
      });
    }, 120); // 120ms debounce ensures fluid map movement and native hardware tracking without React bottleneck
  }, []);

  const calcDeliveryFee = useMemo(() => {
    if (subtotal === 0) return 0;
    
    // Count unique shops from cart items
    const uniqueShops = new Set<string>();
    if (items && Array.isArray(items)) {
      items.forEach((item) => {
        const rawId = (item as any).shopId || (item as any).productShopId || "admin";
        if (rawId) {
          uniqueShops.add(String(rawId).trim());
        }
      });
    }

    // Calculate base fee: Single shop or admin = 30. Multi-shop = 35 (capped)
    let baseFee = uniqueShops.size > 1 ? 35 : 30;

    // Volume-based Promotional Discounts
    if (subtotal >= 999) return 0;
    if (subtotal >= 499) return Math.floor(baseFee / 2); // 50% discount

    return baseFee;
  }, [subtotal, items]);

  const adjustedTotal = useMemo(() => {
    return subtotal + calcDeliveryFee;
  }, [subtotal, calcDeliveryFee]);

  const currentDistance = distanceToHub !== null ? distanceToHub : 0;
  const isOutOfRange = currentDistance > 6.0;

  return {
    coords,
    setCoords,
    nameVal,
    setNameVal,
    cityVal,
    setCityVal,
    areaVal,
    setAreaVal,
    landmarkVal,
    setLandmarkVal,
    isDetailsSubmitted,
    setIsDetailsSubmitted,
    lastInteraction,
    setLastInteraction,
    googleMapsKey,
    gpsLoading,
    gpsCoords,
    gpsAddress,
    distanceToHub,
    fetchAutomaticGPSDetails,
    handleCameraChange,
    calcDeliveryFee,
    adjustedTotal,
    currentDistance,
    isOutOfRange,
  };
}
