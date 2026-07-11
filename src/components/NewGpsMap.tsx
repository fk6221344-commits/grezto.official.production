import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { MapPin, Check, Compass, Navigation } from "lucide-react";
import toast from "react-hot-toast";
import { GoogleMap } from "@capacitor/google-maps";
import { findNearestLandmark } from "../data/villageCoordinates";
import { reverseGeocodeCoords } from "../lib/geocoder";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

interface NewGpsMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelected: (data: {
    lat: number;
    lng: number;
    address: string;
    state: string;
    pincode: string;
    city: string;
    street: string;
  }) => void;
  onCancel?: () => void;
}

export default function NewGpsMap({
  initialLat = 26.243455,
  initialLng = 92.1306235,
  onLocationSelected,
  onCancel,
}: NewGpsMapProps) {
  // Center coordinates of our active map viewpoint
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });

  // Custom manual/auto input states matching the user's second screenshot criteria
  const [stateVal, setStateVal] = useState("Assam");
  const [pincodeVal, setPincodeVal] = useState("782411");
  const [cityVal, setCityVal] = useState("Kawarhagi");
  const [streetVal, setStreetVal] = useState("Mitreno Tech Road");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [googleMapsKey, setGoogleMapsKey] = useState<string>("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const nativeMapRef = useRef<any>(null);
  const liveDotMarkerRef = useRef<any>(null);

  // Fetch verified API Key securely from Server Configuration on component load
  useEffect(() => {
    // 1. Check direct env variable
    const directEnvKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY;
    if (directEnvKey) {
      setGoogleMapsKey(directEnvKey);
      return;
    }
    
    // 2. Check localStorage cached key
    const cachedKey = localStorage.getItem('grezto_google_maps_key');
    if (cachedKey) {
      setGoogleMapsKey(cachedKey);
      return;
    }

    // 3. Dynamic fetch fallback with absolute path
    import('../services/apiConfig').then(({ getAbsoluteApiUrl }) => {
      fetch(getAbsoluteApiUrl('/api/maps/config'))
        .then((res) => res.json())
        .then((data) => {
          if (data && data.key) {
            localStorage.setItem('grezto_google_maps_key', data.key);
            setGoogleMapsKey(data.key);
          }
        })
        .catch((err) => {
          console.error("[NewGpsMap] Failed fetching dynamic Google Maps Config:", err);
        });
    });
  }, []);

  // Initialize Interactive Google Map (Web + Native Unified)
  useEffect(() => {
    if (!mapContainerRef.current || !googleMapsKey) return;

    let isMounted = true;
    let map: any = null;
    let liveDotMarker: any = null;

    const initMap = async () => {
      try {
        const loadScript = () => {
          return new Promise<any>((resolve, reject) => {
            if ((window as any).google && (window as any).google.maps) {
              resolve((window as any).google);
              return;
            }
            const existingScript = document.getElementById("google-maps-js-sdk");
            if (existingScript) {
              const interval = setInterval(() => {
                if ((window as any).google && (window as any).google.maps) {
                  clearInterval(interval);
                  resolve((window as any).google);
                }
              }, 100);
              return;
            }
            const script = document.createElement("script");
            script.id = "google-maps-js-sdk";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve((window as any).google);
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
          });
        };

        const google = await loadScript();
        if (!isMounted) return;

        // Render the interactive Google Map instance directly in the container
        map = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: coords.lat, lng: coords.lng },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          scaleControl: false,
          rotateControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy", // Fluid touchscreen support
        });

        nativeMapRef.current = map;

        // Place a high-contrast glowing green indicator representing actual GPS current location (hilta dulta button)
        liveDotMarker = new google.maps.Marker({
          position: { lat: coords.lat, lng: coords.lng },
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0b7a2d", // Grezto Brand Green
            fillOpacity: 1,
            strokeColor: "#FFFFFF", // High-contrast border
            strokeWeight: 3,
          },
          title: "My Exact GPS Location",
          zIndex: 999,
        });
        liveDotMarkerRef.current = liveDotMarker;

        // Camera Idle Listener translating drag positions back to coords
        map.addListener("idle", () => {
          const center = map.getCenter();
          if (center) {
            handleCameraChange({
              detail: { center: { lat: center.lat(), lng: center.lng() } },
            });
          }
        });

      } catch (err) {
        console.error("[NewGpsMap] Google Maps JS API Init Failed:", err);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [googleMapsKey]);

  // Center map when coords change manually via search/text input or GPS button
  useEffect(() => {
    const map = nativeMapRef.current;
    if (map && typeof map.setCenter === "function" && coords) {
      const currentCenter = map.getCenter();
      if (currentCenter) {
        const currentLat = currentCenter.lat();
        const currentLng = currentCenter.lng();
        if (Math.abs(currentLat - coords.lat) > 0.0001 || Math.abs(currentLng - coords.lng) > 0.0001) {
          map.setCenter({ lat: coords.lat, lng: coords.lng });
        }
      }
    }
  }, [coords.lat, coords.lng]);

  const fetchExactGPSLocation = async () => {
    setGpsLoading(true);
    try {
      console.log("[NewGpsMap] Fetching location via unified high-speed locator...");
      const { getUnifiedHighSpeedLocation } = await import("../lib/geocoder");
      const location = await getUnifiedHighSpeedLocation();
      
      const lat = location.latitude;
      const lng = location.longitude;

      setCoords({ lat, lng });

      const map = nativeMapRef.current;
      if (map && typeof map.setCenter === "function") {
        map.setCenter({ lat, lng });
      }

      if (liveDotMarkerRef.current) {
        liveDotMarkerRef.current.setPosition({ lat, lng });
      }

      toast.success(`Exact location locked! (${location.method})`);
    } catch (err) {
      console.error("GPS telemetry sync failed:", err);
      toast.error("Location lock failed. Please adjust manually.");
    } finally {
      setGpsLoading(false);
    }
  };

  // Automatic updating of input fields using free OSM Nominatim reverse geocoding to keep billing hamesha ₹0
  useEffect(() => {
    let active = true;
    const fetchAddress = async () => {
      try {
        const result = await reverseGeocodeCoords(coords.lat, coords.lng);
        if (active && result) {
          if (result.state) setStateVal(result.state);
          if (result.pincode) setPincodeVal(result.pincode);
          if (result.city) setCityVal(result.city);
          if (result.street) setStreetVal(result.street);
        }
      } catch (err) {
        console.warn("[NewGpsMap] Nominatim auto reverse geocoding failed:", err);
      }
    };
    
    // Debounce to avoid hitting API too frequently while dragging
    const delayTimer = setTimeout(() => {
      fetchAddress();
    }, 800);

    return () => {
      active = false;
      clearTimeout(delayTimer);
    };
  }, [coords.lat, coords.lng]);

  const handleCameraChange = useCallback((ev: any) => {
    if (!ev.detail?.center) return;
    const newLat = ev.detail.center.lat;
    const newLng = ev.detail.center.lng;
    setCoords((prev) => {
      if (
        Math.abs(prev.lat - newLat) > 0.00001 ||
        Math.abs(prev.lng - newLng) > 0.00001
      ) {
        return { lat: newLat, lng: newLng };
      }
      return prev;
    });
  }, []);

  const handleOnSubmit = () => {
    // Generate readable address combination matching user requirements
    const combinedAddress = `${streetVal.trim()}, ${cityVal.trim()}, ${stateVal.trim()} (Pin - ${pincodeVal.trim()})`;
    onLocationSelected({
      lat: coords.lat,
      lng: coords.lng,
      address: combinedAddress,
      state: stateVal,
      pincode: pincodeVal,
      city: cityVal,
      street: streetVal,
    });
    toast.success("Location Pin locked & address details synchronized! 📍✅");
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-50 flex flex-col overflow-y-auto font-sans text-stone-900 w-full max-w-none lg:max-w-[440px] lg:left-1/2 lg:-translate-x-1/2 lg:border-x border-stone-200 lg:shadow-2xl pb-12 animate-in slide-in-from-bottom duration-300">
      {/* 1. Header Navigation Label Bar */}
      <div className="bg-white border-b border-stone-100 py-4 px-5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-650 animate-pulse shrink-0" />
            <span className="text-[10px] font-black uppercase text-stone-800 tracking-wider font-sans">
              Precision Google Map Locater
            </span>
          </div>
          <span className="text-[7.5px] font-bold text-stone-400 -mt-0.5 uppercase tracking-widest leading-none">
            Google Maps Platform Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[9px] font-black text-stone-400 hover:text-stone-900 transition-colors uppercase px-2 py-1 bg-stone-50 rounded-lg hover:bg-stone-100 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* 2. Google Maps Container Box */}
      <div
        ref={mapContainerRef}
        className="relative w-full h-[320.5px] bg-transparent overflow-hidden select-none border-b border-stone-200 shrink-0 z-10"
      >
        {/* Dynamic Map Action Overlays */}
        <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5">
          {/* Find My Location (Exact GPS Refresh) */}
          <button
            type="button"
            onClick={fetchExactGPSLocation}
            disabled={gpsLoading}
            className="bg-[#1a73e8] hover:bg-[#1555ca] active:scale-95 text-white p-2.5 rounded-full shadow-lg border border-blue-400/20 flex items-center justify-center cursor-pointer transition-all shrink-0"
            title="Exact GPS Refresh"
          >
            {gpsLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Navigation className="w-4 h-4 fill-white text-white" />
            )}
          </button>
        </div>

        {!googleMapsKey && (
          <div className="w-full h-full bg-stone-100 flex flex-col items-center justify-center gap-2.5 text-stone-500 p-8 text-center">
            <span className="w-8 h-8 border-3 border-[#0b7a2d] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-extrabold uppercase text-stone-600 tracking-wider">
              Syncing Secure Map API Key...
            </span>
          </div>
        )}

        {/* Map drag UI hint indicator overlay */}
        <div className="absolute top-2.5 left-2.5 bg-stone-900/80 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[8px] font-black text-[#fcb316] uppercase tracking-widest flex items-center gap-1.5 z-40 pointer-events-none">
          <Compass
            className="w-3.5 h-3.5 animate-spin"
            style={{ animationDuration: "6s" }}
          />
          <span>DRAG MAP TO POSITION PIN</span>
        </div>

        {/* Anchor HUD Center Indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="relative flex flex-col items-center">
            {/* Pulsating target feedback ring */}
            <span className="absolute -top-12 w-10 h-10 bg-red-650/15 rounded-full animate-ping border border-red-500/20" />
            <MapPin className="w-9 h-9 text-red-600 relative z-10 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)] -mt-12 animate-bounce" />
            <div className="w-3 h-1 bg-stone-900/40 rounded-full blur-[1px] -mt-1.5" />
          </div>
        </div>

        {/* Map Guidelines Info HUD Overlay */}
        <div className="absolute bottom-3 right-3 bg-stone-900/90 backdrop-blur-xs border border-stone-850 text-white rounded-lg px-2.5 py-1 text-[8.5px] font-mono font-bold tracking-widest z-40">
          LAT: {coords.lat.toFixed(5)} | LNG: {coords.lng.toFixed(5)}
        </div>
      </div>

      {/* 3. "SELECT PLACE" Yellow Highlight Notification Banner */}
      <div className="bg-[#fcb316] text-[#0d140e] py-1 px-3 flex items-center justify-between text-[9px] font-black uppercase tracking-wider shrink-0 select-none">
        <span className="text-[8.5px] text-stone-950 font-extrabold flex items-center gap-1 font-sans uppercase">
          <span>👇 Drag map pin to center your exact doorstep</span>
        </span>
        <div
          onClick={handleOnSubmit}
          className="flex items-center gap-1 bg-[#0b7a2d] text-white px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase shadow-xs tracking-wider transition-all cursor-pointer active:scale-95"
        >
          <MapPin className="w-3 h-3 text-red-500 fill-red-500 animate-bounce" />
          <span>USE THIS LOCATION</span>
        </div>
      </div>

      {/* 4. Elegant 4-Tier Detail Form Grid matching exact screenshot styles */}
      <div className="p-5 space-y-4 bg-white flex-grow">
        {/* State input */}
        <div className="border border-stone-200 rounded-[18px] px-4 py-2.5 flex flex-col justify-center bg-stone-50/50">
          <label className="text-[8px] font-black uppercase text-stone-400 font-sans tracking-widest mb-0.5">
            State
          </label>
          <input
            type="text"
            value={stateVal}
            onChange={(e) => setStateVal(e.target.value)}
            className="w-full text-xs font-bold text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
            placeholder="State Name"
          />
        </div>

        {/* Pincode input */}
        <div className="border border-stone-200 rounded-[18px] px-4 py-2.5 flex flex-col justify-center bg-stone-50/50">
          <label className="text-[8px] font-black uppercase text-stone-400 font-sans tracking-widest mb-0.5">
            Pincode
          </label>
          <input
            type="text"
            value={pincodeVal}
            onChange={(e) => setPincodeVal(e.target.value)}
            className="w-full text-xs font-bold text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text font-mono"
            placeholder="Pincode"
          />
        </div>

        {/* City/Village input */}
        <div className="border border-stone-200 rounded-[18px] px-4 py-2.5 flex flex-col justify-center bg-stone-50/50">
          <label className="text-[8px] font-black uppercase text-stone-400 font-sans tracking-widest mb-0.5">
            City / Village
          </label>
          <input
            type="text"
            value={cityVal}
            onChange={(e) => setCityVal(e.target.value)}
            className="w-full text-xs font-bold text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
            placeholder="City or Village locality"
          />
        </div>

        {/* Nearby Area / Road Map route */}
        <div className="border border-stone-200 rounded-[18px] px-4 py-2.5 flex flex-col justify-center bg-stone-50/50">
          <label className="text-[8px] font-black uppercase text-stone-400 font-sans tracking-widest mb-0.5">
            Nearby Area / Road
          </label>
          <input
            type="text"
            value={streetVal}
            onChange={(e) => setStreetVal(e.target.value)}
            className="w-full text-xs font-bold text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
            placeholder="e.g. Near School, Temple, Highway"
          />
        </div>

        {/* 5. Gold-Styled Bold SUBMIT Button */}
        <button
          type="button"
          onClick={handleOnSubmit}
          className="w-full py-4 bg-[#0b7a2d] hover:bg-[#07531e] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-3"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>CONFIRM LOCATION</span>
        </button>
      </div>
    </div>
  );
}
