import { Capacitor } from '@capacitor/core';
import { auth } from '../services/firebase';
import { getAbsoluteApiUrl } from '../services/apiConfig';

// Legacy export kept for backward compatibility if referenced elsewhere
export const DEFAULT_BACKEND_URL = import.meta.env.VITE_API_URL || "https://ais-pre-iwuffnv2dp6bitiu4stge2-8351944502.asia-southeast1.run.app";

export function getApiUrl(path: string): string {
  return getAbsoluteApiUrl(path);
}

/**
 * Dynamically retrieves the current logged-in Firebase User JWT token and constructs
 * secure request headers containing the 'Authorization: Bearer <token>' credential.
 * Supports Native Capacitor platform and auto-injects client signatures.
 */
export async function getAuthHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Grezto-Client-Signature': import.meta.env.VITE_APP_CLIENT_SIGNATURE || "grezto_secure_app_signature_2026_unicorn",
    ...customHeaders
  };
  
  try {
    let token = "";
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const tokenRes = await FirebaseAuthentication.getIdToken();
        token = tokenRes.token;
      } catch (nativeErr) {
        console.warn('[getAuthHeaders] Native token retrieval failed:', nativeErr);
      }
    }

    if (!token) {
      const user = auth.currentUser;
      if (user) {
        token = await user.getIdToken(false); // 0ms cached token fallback to save network latency
      }
    }

    if (!token && typeof window !== 'undefined') {
      const fallback = localStorage.getItem("grezto_fallback_token");
      if (fallback) {
        token = fallback;
        console.log('[getAuthHeaders] Web Auth failed/missing, injected high-availability secure fallback token.');
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('[getAuthHeaders] Error retrieving Firebase token:', err);
  }
  
  return headers;
}

/**
 * Phase 5: Automated Token Injector & Graceful Crash Prevention (401/403 Handling)
 * Intercepts window.fetch globally to automatically attach fresh Firebase Auth tokens and
 * handle expired or unauthorized sessions with an elegant UI notification without crashing the app.
 * Utilizes Object.defineProperty to safely shadow fetch and prevent read-only/getter-only errors.
 */
if (typeof window !== 'undefined') {
  try {
    const originalFetch = window.fetch;
    
    if (originalFetch) {
      const interceptedFetch = async function (this: any, input: RequestInfo | URL, init?: RequestInit) {
        let url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as any).url || '');
        
        // Auto-redirect relative /api/ paths to the absolute API server URL (critical for Native Android APK)
        const isRelativeApi = url.startsWith('/api/');
        let modifiedInput = input;
        
        if (isRelativeApi) {
          const absoluteUrl = getAbsoluteApiUrl(url);
          console.log(`[Fetch Interceptor] Auto-rewriting relative API path ${url} to absolute: ${absoluteUrl}`);
          url = absoluteUrl;
          if (input instanceof Request) {
            modifiedInput = new Request(absoluteUrl, input);
          } else {
            modifiedInput = absoluteUrl;
          }
        }
        
        // Check if it's an API route and not a third-party domain (or if it's our backend/maps url)
        const isApiRoute = url.includes('/api/') && !url.startsWith('https://maps.googleapis.com');
        
        let modifiedInit = init || {};
        
        if (isApiRoute) {
          // Parse & normalize existing headers to a standard object
          let headers: Record<string, string> = {};
          if (modifiedInit.headers) {
            if (modifiedInit.headers instanceof Headers) {
              modifiedInit.headers.forEach((val, key) => {
                headers[key] = val;
              });
            } else if (Array.isArray(modifiedInit.headers)) {
              modifiedInit.headers.forEach(([key, val]) => {
                headers[key] = val;
              });
            } else {
              headers = { ...modifiedInit.headers } as Record<string, string>;
            }
          }

          // Default Content-Type to application/json for standard JSON APIs, unless uploading file/FormData
          if (!headers['Content-Type'] && !(modifiedInit.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
          }

          // Inject custom client security signature so the backend accepts requests in production mode
          const clientSig = import.meta.env.VITE_APP_CLIENT_SIGNATURE || "grezto_secure_app_signature_2026_unicorn";
          if (!headers['X-Grezto-Client-Signature'] && !headers['x-grezto-client-signature']) {
            headers['X-Grezto-Client-Signature'] = clientSig;
          }

          // Automatically inject Auth token if not already explicitly present and user is logged in
          if (!headers['Authorization'] && !headers['authorization']) {
            try {
              let token = "";
              if (Capacitor.isNativePlatform()) {
                try {
                  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                  const tokenRes = await FirebaseAuthentication.getIdToken();
                  token = tokenRes.token;
                } catch (nativeErr) {
                  console.warn('[Fetch Interceptor] Native token retrieval failed:', nativeErr);
                }
              }

              if (!token) {
                const currentUser = auth.currentUser;
                if (currentUser) {
                  token = await currentUser.getIdToken(false);
                }
              }

              if (!token && typeof window !== 'undefined') {
                const fallback = localStorage.getItem("grezto_fallback_token");
                if (fallback) {
                  token = fallback;
                  console.log('[Fetch Interceptor] Web Auth failed/missing, injected high-availability secure fallback token.');
                }
              }

              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
            } catch (tokenErr) {
              console.warn('[Fetch Interceptor] Auto ID token fetch failed:', tokenErr);
            }
          }

          modifiedInit.headers = headers;
        }

        try {
          const response = await originalFetch.call(this, modifiedInput, modifiedInit);
          
          // Zero-Crash Fail-Safe: Intercept 401 (Unauthorized) and 403 (Forbidden)
          if (isApiRoute && (response.status === 401 || response.status === 403)) {
            // Exclude general health checks to avoid false alarms
            if (!url.includes('/api/health')) {
              console.warn(`[Fetch Interceptor] Received unauthorized status ${response.status} from: ${url}`);
              window.dispatchEvent(new CustomEvent('grezto-auth-expired', {
                detail: { status: response.status, url }
              }));
            }
          }
          return response;
        } catch (fetchErr) {
          throw fetchErr;
        }
      };

      // Define property on window object securely to bypass strict read-only/getter-only constraints
      Object.defineProperty(window, 'fetch', {
        value: interceptedFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
      
      console.log('[Fetch Interceptor] Global fetch successfully patched for secure token injection and 401/403 fail-safe.');
    }
  } catch (err) {
    console.error('[Fetch Interceptor] Could not patch window.fetch directly due to sandbox or environment constraints:', err);
  }
}

