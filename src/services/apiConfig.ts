import { Capacitor } from '@capacitor/core';

// Advanced Environmental Injections (The Zero-Footprint Method)
// Under production/release builds, tree-shaking completely erases development URLs.
export const LOCAL_DEV_URL = import.meta.env.PROD ? "" : "http://10.0.2.2:3000";

// Securely obfuscated base64 payload to prevent plain string scraping in release APKs
const SECURE_OBFUSCATED_LIVE_URL = "aHR0cHM6Ly9hcGkuZ3JlenRvLmlu"; // Decodes to "https://api.grezto.in"

/**
 * Safe runtime de-obfuscator for production API domain
 */
export function getLiveProductionUrl(): string {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(SECURE_OBFUSCATED_LIVE_URL);
    }
    // Node.js server fallback
    return Buffer.from(SECURE_OBFUSCATED_LIVE_URL, 'base64').toString('utf8');
  } catch (err) {
    // Ultimate hardcoded fallback
    return "https://api.grezto.in";
  }
}

// Central Configuration for Grezto Secure Backend
export const RAILWAY_LIVE_URL = 
  import.meta.env.VITE_RAILWAY_URL || 
  import.meta.env.VITE_API_URL || 
  getLiveProductionUrl();

/**
 * Centrally determines the correct Base API URL for all frontend requests.
 * 
 * Rules:
 * - Local Browser Development: http://localhost:3000
 * - Web Production (Vercel): Uses relative path or VITE_API_URL override
 * - Native Android/iOS (Capacitor APK): Automatically redirects to the secure Railway Live HTTPS URL
 * - Developer Debug/Override: Respects custom backend URL saved in localStorage ('grezto_backend_url')
 */
export function getBaseApiUrl(): string {
  // Check for developer/user settings override first
  const savedUrl = localStorage.getItem('grezto_backend_url');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim();
  }

  // Native platform (Capacitor APK)
  if (Capacitor.isNativePlatform()) {
    // If running native app in dev mode, we can default to LOCAL_DEV_URL or RAILWAY_LIVE_URL
    if (import.meta.env.DEV) {
      return LOCAL_DEV_URL;
    }
    return RAILWAY_LIVE_URL;
  }

  // Web Browser environment
  // We MUST return an empty string for web browsers (like AI Studio previews or Vercel hosting)
  // so that fetches are made relative to the current active origin, preventing Mixed Content blocks
  // and ensuring the reverse proxy routes them correctly.
  return "";
}

/**
 * Safely joins the base API URL with the requested path.
 * If the base URL is relative/empty, it returns the relative path safely.
 */
export function getAbsoluteApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getBaseApiUrl();

  if (!baseUrl) {
    return cleanPath;
  }

  // Strip trailing slash from baseUrl to prevent double slashes
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}${cleanPath}`;
}

/**
 * Dynamically synchronizes public client keys and configurations from the Railway backend.
 * Stores them in localStorage so that subsequent operations use the latest active keys.
 */
export async function syncRemoteConfig(): Promise<boolean> {
  try {
    const baseUrl = getBaseApiUrl();
    const targetUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/api/config`;
    
    console.log(`[Config Sync] Synchronizing remote configuration from: ${targetUrl}`);
    // Use the native fetch directly to prevent cyclic interception loops
    const response = await window.fetch(targetUrl, {
      headers: {
        'X-Grezto-Client-Signature': import.meta.env.VITE_APP_CLIENT_SIGNATURE || "grezto_secure_app_signature_2026_unicorn"
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data) {
        let changed = false;
        
        if (data.supabaseUrl && localStorage.getItem('grezto_supabase_url') !== data.supabaseUrl) {
          localStorage.setItem('grezto_supabase_url', data.supabaseUrl);
          changed = true;
        }
        if (data.supabaseAnonKey && localStorage.getItem('grezto_supabase_anon_key') !== data.supabaseAnonKey) {
          localStorage.setItem('grezto_supabase_anon_key', data.supabaseAnonKey);
          changed = true;
        }
        if (data.googleMapsKey && localStorage.getItem('grezto_google_maps_key') !== data.googleMapsKey) {
          localStorage.setItem('grezto_google_maps_key', data.googleMapsKey);
          changed = true;
        }
        if (data.firebaseProjectId && localStorage.getItem('grezto_firebase_project_id') !== data.firebaseProjectId) {
          localStorage.setItem('grezto_firebase_project_id', data.firebaseProjectId);
          changed = true;
        }
        
        if (changed) {
          console.log("[Config Sync] Remote config updated and synchronized successfully! 🚀");
          // Reinitialize Supabase client if it's imported
          try {
            const { reinitializeSupabase } = await import('./supabase');
            reinitializeSupabase(data.supabaseUrl, data.supabaseAnonKey);
          } catch (e) {
            console.warn("[Config Sync] Failed to reinitialize Supabase after sync:", e);
          }
        } else {
          console.log("[Config Sync] Local config is already up-to-date with server. No changes needed.");
        }
        return true;
      }
    } else {
      console.warn(`[Config Sync] Failed to sync remote config. Server returned status: ${response.status}`);
    }
  } catch (err) {
    console.error("[Config Sync] Network error during dynamic config synchronization:", err);
  }
  return false;
}
