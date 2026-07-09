import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './utils/api'; // Ensure the global fetch interceptor is initialized early and runs first!
import { syncRemoteConfig } from './services/apiConfig';
import App from './App.tsx';
import './index.css';

// Preheat and sync dynamic configurations from server in background on launch
syncRemoteConfig().catch((err) => console.warn("[Boot Config Sync Failed]", err));

// Silently capture and suppress harmless background/HMR WebSocket connection closure errors
if (typeof window !== 'undefined') {
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
