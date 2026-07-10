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
      // If user has manually entered/saved a genuine non-fallback address, do not overwrite it automatically
      if (user.address && !user.address.includes("Mitreno Tech") && user.address !== "Kawarhagi, Assam") {
        console.log("[Auto GPS] Real user address already present, skipping auto-fetch on startup.");
        return;
      }

      try {
        console.log("[Auto GPS] Fetching multi-tier high speed location on startup...");
        const { getUnifiedHighSpeedLocation, reverseGeocodeCoords } = await import('../lib/geocoder');
        
        // This will try Network Coarse -> GPS High Accuracy -> IP Geolocation -> Regional Fallback
        const location = await getUnifiedHighSpeedLocation();
        console.log("[Auto GPS] Coordinates retrieved successfully via:", location.method, location.latitude, location.longitude);
        
        const result = await reverseGeocodeCoords(location.latitude, location.longitude);
        const compiledAddress = `${result.street || "Unknown Street"}, ${result.city || "Kawarhagi"}, ${result.state || "Assam"} (Pin - ${result.pincode || "782121"})`;
        
        updateProfile({
          address: compiledAddress,
          lat: location.latitude,
          lng: location.longitude,
          activeCity: result.city || "Kawarhagi"
        });
        
        console.log("[Auto GPS] Location auto-locked & profile address set successfully:", compiledAddress);
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
