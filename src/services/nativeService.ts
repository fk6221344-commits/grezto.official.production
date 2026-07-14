import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';
import { supabase } from './supabase';

// Check if running in a native Android/iOS Capacitor environment
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * -------------------
 * HAPTICS & VIBRATION
 * -------------------
 */
let longVibrationInterval: any = null;
let webVibrationInterval: any = null;

export const startContinuousCallVibration = () => {
  // Prevent duplicate vibration engines
  if (longVibrationInterval || webVibrationInterval) {
    return;
  }

  // 1. Web & WebView Engine (Vibration loop with shorter pattern to prevent OS-level truncation)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // Immediate call pattern trigger
    navigator.vibrate([1500, 200, 1500, 200]);
    webVibrationInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([1500, 200, 1500, 200]);
      }
    }, 3400); // Repetitive call loop to sustain physical feedback
  }

  // 2. Native Capacitor Haptics Engine (Optimized for Android taptic hardware)
  if (isNativePlatform()) {
    // Deliver heavy wake-up blasts to instantly awaken the hardware taptic engine
    Haptics.impact({ style: ImpactStyle.Heavy })
      .then(() => {
        setTimeout(() => {
          Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        }, 150);
      })
      .catch(() => {});

    // High-frequency, intense vibration loop mimicking an incoming emergency/delivery call
    // We run a 1800ms vibration block followed by a 200ms safety gap before the next loop
    setTimeout(() => {
      Haptics.vibrate({ duration: 1800 }).catch(() => {});
      // Also trigger webview native vibration as a robust dual-engine fallback on Android
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([1800]);
      }
      longVibrationInterval = setInterval(() => {
        Haptics.vibrate({ duration: 1800 }).catch(() => {});
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([1800]);
        }
      }, 2000);
    }, 300);
  }
};

export const stopContinuousCallVibration = () => {
  // Cancel Web/WebView vibrating state and clear its intervals
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
  if (webVibrationInterval) {
    clearInterval(webVibrationInterval);
    webVibrationInterval = null;
  }

  // Cancel Native physical vibration and clear its intervals
  if (longVibrationInterval) {
    clearInterval(longVibrationInterval);
    longVibrationInterval = null;
  }
};

export const triggerNativeImpactVibration = () => {
  if (isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    // Dual safety trigger for Android WebView
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
};

export const triggerLightHapticVibration = () => {
  try {
    if (isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch (e) {}
};

export const triggerMediumHapticVibration = () => {
  try {
    if (isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
  } catch (e) {}
};

export const triggerSuccessHapticVibration = () => {
  try {
    if (isNativePlatform()) {
      Haptics.vibrate({ duration: 150 }).catch(() => {
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 120]);
      }
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 120]);
    }
  } catch (e) {}
};


/**
 * 1. PERSISTENT KEY-VALUE STORAGE UTILITIES (WebView & Native Fallback)
 * Standardizes session management. Native environment uses persistent SQLite/Preferences storage.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.error(`Error setting key ${key}:`, err);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  } catch (err) {
    console.error(`Error getting key ${key}:`, err);
    return null;
  }
}

export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (isNativePlatform()) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.error(`Error removing key ${key}:`, err);
  }
}

/**
 * 2. GPS GEOLOCATION & PERMISSIONS (High Accuracy native mapping with Bulletproof multi-tier fallbacks)
 */
export async function getDeviceLocation(): Promise<{ 
  latitude: number; 
  longitude: number; 
  address?: string; 
  isFallback?: boolean; 
  fallbackMethod?: string;
}> {
  try {
    console.log("[GPS] Querying unified device location via multi-tier high speed locator...");
    const { getUnifiedHighSpeedLocation } = await import('../lib/geocoder');
    const location = await getUnifiedHighSpeedLocation();
    
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      address: `My Location (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`,
      isFallback: location.method === 'Offline-Regional-Fallback',
      fallbackMethod: location.method
    };
  } catch (err: any) {
    console.warn("[GPS] Native hardware location lookup failed, using reliable regional fallback:", err);
    return {
      latitude: 26.243455, // Center/HQ of organic regional hub Kawarhagi
      longitude: 92.1306235,
      address: "Mitreno Tech, Kawarhagi, Assam (Fallback)",
      isFallback: true,
      fallbackMethod: "native-error-fallback"
    };
  }
}

/**
 * 3. FIREBASE CLOUD MESSAGING (FCM) & PUSH NOTIFICATIONS
 */
export async function initializeFCMNotifications(phone: string) {
  if (!isNativePlatform()) {
    console.log("[FCM Native] Push Notifications skipped on non-native platform.");
    return;
  }

  try {
    console.log("[FCM Native] Initiating device push permission checks...");
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      // REGISTER WITH GOOGLE/APPLE TO RECEIVE PUSH VIA FCM
      await PushNotifications.register();
      console.log("[FCM Native] Device successfully registered for native notifications.");
      
      // CREATE THE CUSTOM SOUND CHANNEL FOR PUSH NOTIFICATIONS
      try {
        await PushNotifications.createChannel({
          id: 'grezto_order_channel_v5',
          name: 'Grezto New Orders v5',
          description: 'Loud alarm with persistent vibration for new incoming orders.',
          importance: 5, // 5 = High importance (MAX)
          visibility: 1, // 1 = Public
          sound: 'spaceship_alarm', // Name of the sound file WITHOUT extension (spaceship_alarm.mp3 -> spaceship_alarm)
          vibration: true,
          vibrationPattern: [0, 1500, 200, 1500, 200, 1500, 200, 1500], // High-power vibration pattern
          lights: true,
          lightColor: '#10b981'
        } as any);
        console.log("Custom Push sound notification channel created (v4)!");
      } catch (channelErr) {
        console.warn("Could not create Push notification channel:", channelErr);
      }

      // CREATE THE CUSTOM SOUND CHANNEL FOR LOCAL NOTIFICATIONS (Saves sound for Oreo+)
      try {
        await LocalNotifications.createChannel({
          id: 'grezto_order_channel_v5',
          name: 'Grezto New Orders v5',
          description: 'Loud alarm with persistent vibration for new incoming orders.',
          importance: 5, // 5 = High importance (MAX)
          visibility: 1, // 1 = Public
          sound: 'spaceship_alarm', // Name of the sound file WITHOUT extension
          vibration: true,
          vibrationPattern: [0, 1500, 200, 1500, 200, 1500, 200, 1500], // High-power vibration pattern
          lights: true,
          lightColor: '#10b981'
        } as any);
        console.log("Custom Local sound notification channel created (v4)!");
      } catch (localChannelErr) {
        console.warn("Could not create Local notification channel:", localChannelErr);
      }

    } else {
      console.warn("[FCM Native] Direct permission to show notifications on screen denied.");
    }

    // Add Local Notification listeners for user taps
    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.log('[Local Notification Action Tap] User interacted with local notification:', action);
        window.dispatchEvent(new CustomEvent('grezto-app-resumed'));
      });
    } catch (localListenerErr) {
      console.warn("Could not register Local notification listener:", localListenerErr);
    }

    // Add push notification listeners
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[FCM Token Native] Native device successfully registered. Token:', token.value);
      if (phone) {
        try {
          await supabase.from('fcm_tokens').upsert({
            phone: phone,
            token: token.value,
            updated_at: new Date().toISOString()
          });
          console.log('[FCM Token Native] Successfully saved FCM token to Supabase for phone:', phone);
        } catch (dbErr) {
          console.error('[FCM Token Native] Failed to save token to database:', dbErr);
        }
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[FCM Native Error] Native device registration failed:', error.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM Received] Rich notification payload received:', notification);
      toast.success(`${notification.title || "Grezto Alert"}: ${notification.body || ""}`, {
        duration: 8000,
        id: 'fcm-toast-' + notification.id
      });
      
      // Attempt strong physical vibration alert
      triggerNativeImpactVibration();
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[FCM Action Tap] User interacted with notification:', action);
    });

  } catch (err: any) {
    console.error("[FCM Setup Fail] Failed to bind Capacitor native push triggers:", err.message || err);
  }
}

/**
 * 4. FIREBASE CRASHLYTICS INTEGRATION
 * Automatically sets up Crashlytics keys, registers test logs, and tracks non-fatal errors.
 */
export async function initializeCrashlytics() {
  if (!isNativePlatform()) {
    console.log("[Crashlytics] Native Crashlytics integration skipped on browser/web platform.");
    return;
  }

  try {
    console.log("[Crashlytics] Initializing Firebase Crashlytics on Native Android platform...");
    
    // Ensure Crashlytics logging is enabled
    await FirebaseCrashlytics.setEnabled({ enabled: true });
    
    // Check if enabled status is active
    const { enabled } = await FirebaseCrashlytics.isEnabled();
    console.log("[Crashlytics] Status: ", enabled ? "ACTIVE" : "DISABLED");

    // Set custom session context parameters to display in the Firebase Console
    await FirebaseCrashlytics.setCustomKey({ key: 'grezto_environment', value: 'production', type: 'string' });
    await FirebaseCrashlytics.setCustomKey({ key: 'capacitor_platform', value: 'android', type: 'string' });
    await FirebaseCrashlytics.setCustomKey({ key: 'grezto_auto_activated', value: true, type: 'boolean' });
    await FirebaseCrashlytics.log({ message: 'Grezto App Native Web-View React Layer Initialized' });

    // Send a test non-fatal exception instantly to Firebase to activate/verify Crashlytics connection automatically!
    await FirebaseCrashlytics.recordException({
      message: 'Grezto Crashlytics Auto-Test Active Native Bridge Connection Verification'
    });

    console.log("[Crashlytics] Successfully sent auto-init verification reports to Firebase Console.");
  } catch (err: any) {
    console.warn("[Crashlytics Setup] Native Crashlytics bridge failed initialization:", err.message || err);
  }
}

/**
 * Log a custom error to Firebase Crashlytics
 */
export async function logCrashlyticsError(message: string, errorContext?: Record<string, any>) {
  if (!isNativePlatform()) {
    console.warn("[Crashlytics Web Mock] Non-Fatal Error Logged:", message, errorContext);
    return;
  }

  try {
    // Write any context key-value pairs
    if (errorContext) {
      for (const [key, val] of Object.entries(errorContext)) {
        let valType: 'string' | 'long' | 'float' | 'double' | 'boolean' | 'int' = 'string';
        let typedVal: string | number | boolean = String(val);

        if (typeof val === 'boolean') {
          valType = 'boolean';
          typedVal = val;
        } else if (typeof val === 'number') {
          valType = Number.isInteger(val) ? 'int' : 'float';
          typedVal = val;
        } else {
          valType = 'string';
          typedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }

        await FirebaseCrashlytics.setCustomKey({ 
          key, 
          value: typedVal,
          type: valType
        });
      }
    }
    
    await FirebaseCrashlytics.log({ message: `React Error Log: ${message}` });
    await FirebaseCrashlytics.recordException({ message });
  } catch (err) {
    console.error("[Crashlytics Log Error] Failed logging event:", err);
  }
}
