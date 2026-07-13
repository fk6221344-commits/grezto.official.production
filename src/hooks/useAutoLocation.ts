import { useEffect } from 'react';

interface AutoLocationProps {
  firebaseAuthReady: boolean;
  user: any;
  updateProfile: (profile: any) => void;
}

export function useAutoLocation({
  firebaseAuthReady,
  user,
  updateProfile
}: AutoLocationProps) {
  useEffect(() => {
    if (!firebaseAuthReady) return;

    async function autoFetchLocation() {
      // If user has any saved address, NEVER automatically overwrite it on startup
      if (user.address && user.address.trim() !== "" && user.address !== "Kawarhagi, Assam") {
        console.log("[Auto GPS] Saved user address already present, skipping auto-fetch on startup.");
        return;
      }

      try {
        console.log("[Auto GPS] Fetching multi-tier high speed location on startup...");
        const { getUnifiedHighSpeedLocation, reverseGeocodeCoords } = await import('../lib/geocoder');
        
        const location = await getUnifiedHighSpeedLocation();
        console.log("[Auto GPS] Coordinates retrieved successfully via:", location.method, location.latitude, location.longitude);
        
        // Strictly avoid auto-overwriting with inaccurate IP geolocation (or coarse regional fallbacks) which can be 10-15km away
        const isIpOrFallback = location.method.includes("IP-Geolocation") || location.method.includes("Offline-Regional-Fallback") || location.method.includes("Network-Coarse");
        if (isIpOrFallback) {
          console.log("[Auto GPS] Detected coarse network/IP location. Skipping startup auto-overwrite to prevent 10-15km inaccurate offsets.");
          return;
        }

        const result = await reverseGeocodeCoords(location.latitude, location.longitude);
        const compiledAddress = result.address || `${result.street || "Location Point"}, ${result.city || "Kawarhagi"}, ${result.state || "Assam"}${result.pincode ? ` (Pin - ${result.pincode})` : ""}`;
        
        updateProfile({
          address: compiledAddress,
          lat: location.latitude,
          lng: location.longitude,
          activeCity: result.city || "Kawarhagi"
        });
        
        console.log("[Auto GPS] Highly precise GPS location auto-locked successfully:", compiledAddress);
      } catch (err) {
        console.warn("[Auto GPS] Startup auto-location fetch failed:", err);
      }
    }

    // Delay by 2.5 seconds to wait for Splash screen fadeout and rendering stabilization
    const delayTimer = setTimeout(() => {
      autoFetchLocation();
    }, 2500);

    return () => clearTimeout(delayTimer);
  }, [firebaseAuthReady]);
}
