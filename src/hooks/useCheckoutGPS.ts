import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { calculateDistance } from '../lib/distance';
import { reverseGeocodeCoords, forwardGeocodeAddress } from '../lib/geocoder';

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

  const [googleMapsKey, setGoogleMapsKey] = useState<string>(cachedGoogleMapsKey);

  // Fetch verified API Key securely from Server Configuration on component load
  useEffect(() => {
    if (cachedGoogleMapsKey) {
      setGoogleMapsKey(cachedGoogleMapsKey);
      return;
    }
    fetch('/api/maps/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.key) {
          cachedGoogleMapsKey = data.key;
          setGoogleMapsKey(data.key);
        }
      })
      .catch(err => {
        console.error("Error loading maps dynamic key in Checkout GPS hook:", err);
      });
  }, []);

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
          lng: coords.lng,
          isLoggedIn: true
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

  const fetchAutomaticGPSDetails = async () => {
    setGpsLoading(true);
    setLastInteraction('text');
    try {
      // If we are running in Web/Preview (iframe), skip native GPS lookup which hangs for 10s due to browser permissions.
      if (!Capacitor.isNativePlatform()) {
        console.log("[Checkout GPS] Web environment detected. Skipping native GPS timeout to load instantly (0ms).");
        const lat = user.lat || MORIGAON_CENTER.lat;
        const lng = user.lng || MORIGAON_CENTER.lng;
        applyLocationDetails(lat, lng);
        return;
      }

      console.log("[Checkout GPS] Fetching native physical GPS coordinate maps...");
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          const reqStatus = await Geolocation.requestPermissions();
          if (reqStatus.location !== 'granted' && reqStatus.coarseLocation !== 'granted') {
            throw new Error("Location permission not granted by device OS.");
          }
        }
        
        let pos;
        try {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 10000
          });
        } catch (highAccErr: any) {
          console.warn("[Checkout GPS] High accuracy failed, retrying with network location...", highAccErr);
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 30000
          });
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applyLocationDetails(lat, lng); // No await, instantly move map
        toast.success("Location locked instantly! 🛰️📡", { duration: 1500 });
      } catch (nativeErr: any) {
        console.warn("[Checkout GPS] Native Geolocation lookup failed:", nativeErr);
        toast.error("GPS access failed. Please enable hardware location services.");
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

    // Single shop or admin = 35. Multi-shop = 40 (capped)
    if (uniqueShops.size > 1) {
      return 40;
    }
    return 35;
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
