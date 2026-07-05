import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

// Silently capture and suppress harmless background/HMR WebSocket connection closure errors
if (typeof window !== 'undefined') {
  // Override relative fetch calls in Native platform to hit our live public domain
  if (Capacitor.isNativePlatform()) {
    const originalFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const inputStr = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);
      if (inputStr.startsWith('/api/')) {
        const savedUrl = localStorage.getItem('grezto_backend_url');
        const baseUrl = savedUrl ? savedUrl.trim() : (import.meta.env.VITE_API_URL || "https://ais-pre-iwuffnv2dp6bitiu4stge2-8351944502.asia-southeast1.run.app");
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const remoteUrl = `${cleanBaseUrl}${inputStr}`;
        console.log(`[Capacitor Native Fetch Redirect] Redirecting ${inputStr} to ${remoteUrl}`);
        if (input instanceof Request) {
          // If the input was a Request object, clone it with the new URL
          const newRequest = new Request(remoteUrl, input);
          return originalFetch(newRequest, init);
        }
        return originalFetch(remoteUrl, init);
      }
      return originalFetch(input, init);
    } as any;
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event?.reason?.message || event?.reason || '');
    
    // Supabase App Errors Logging (Critical Crash Catcher)
    import('./services/supabase').then(({ supabase }) => {
       if (supabase && (reasonStr.includes('crash') || reasonStr.includes('error') || reasonStr.includes('failed') || reasonStr.includes('TypeError'))) {
          supabase.from('app_errors').insert({
             error_message: reasonStr,
             stack_trace: event?.reason?.stack || 'No stack trace available',
             device_info: {
               userAgent: navigator.userAgent,
               platform: navigator.platform,
               language: navigator.language,
               isNative: Capacitor.isNativePlatform()
             },
             app_version: '1.0.0-phase1',
          }).then(({ error }: any) => {
               if (error) console.warn("Supabase Error Logger Failed", error);
          });
       }
    }).catch(() => {});

    if (
      reasonStr.includes('WebSocket') || 
      reasonStr.includes('HMR') || 
      reasonStr.includes('closed without opened') ||
      reasonStr.includes('Firebase') ||
      reasonStr.toLowerCase().includes('firebaseerror') ||
      reasonStr.includes('permission-denied') ||
      reasonStr.includes('api-key')
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event?.message || '');
    
    // Supabase App Errors Logging (Critical Crash Catcher)
    import('./services/supabase').then(({ supabase }) => {
       if (supabase) {
          supabase.from('app_errors').insert({
             error_message: msg,
             stack_trace: event?.error?.stack || event?.filename + ':' + event?.lineno,
             device_info: {
               userAgent: navigator.userAgent,
               platform: navigator.platform,
               language: navigator.language,
               isNative: Capacitor.isNativePlatform()
             },
             app_version: '1.0.0-phase1',
          }).then(({ error }: any) => {
               if (error) console.warn("Supabase Error Logger Failed", error);
          });
       }
    }).catch(() => {});

    if (
      msg.includes('WebSocket') || 
      msg.includes('HMR') || 
      msg.includes('closed without opened') ||
      msg.includes('Firebase') ||
      msg.toLowerCase().includes('firebaseerror') ||
      msg.includes('permission-denied') ||
      msg.includes('api-key')
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
