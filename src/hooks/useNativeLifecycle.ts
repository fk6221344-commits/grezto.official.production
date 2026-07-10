import { useEffect } from 'react';
import { initializeCrashlytics } from '../services/nativeService';
import { stopAlertAlarmLoop } from '../services/notifications';

export function useNativeLifecycle() {
  useEffect(() => {
    initializeCrashlytics();

    let stateChangeListener: any = null;

    async function registerLifecycleListener() {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        stateChangeListener = await CapApp.addListener('appStateChange', (state) => {
          console.log('[Native Lifecycle] App state changed:', state);
          if (!state.isActive) {
            // App went to background (Pause)
            console.log('[Native Lifecycle] App in background. Pausing alarms and heavy processes...');
            stopAlertAlarmLoop();
          } else {
            // App returned to foreground (Resume)
            console.log('[Native Lifecycle] App in foreground. Resuming sync channels...');
            window.dispatchEvent(new CustomEvent('grezto-app-resumed'));
          }
        });
      } catch (err) {
        console.log('[Native Lifecycle] Bypassed register (non-native platform).');
      }
    }

    registerLifecycleListener();

    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove().catch((e: any) => console.log('Lifecycle listener unregister fail:', e));
      }
    };
  }, []);
}
