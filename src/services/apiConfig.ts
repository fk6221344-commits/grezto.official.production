import { Capacitor } from '@capacitor/core';

// Central Configuration for Grezto Secure Backend
// Replace this with your actual live Railway URL when deploying to production!
export const RAILWAY_LIVE_URL = import.meta.env.VITE_RAILWAY_URL || import.meta.env.VITE_API_URL || "https://api.grezto.in";
export const LOCAL_DEV_URL = "http://localhost:3000";

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
