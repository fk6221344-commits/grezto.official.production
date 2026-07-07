import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';

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

export const startContinuousCallVibration = () => {
  // Use a long robust continuous looping pattern on Android WebViews
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // 1000ms vibrate, 1000ms pause - looped for a very long duration (30 seconds)
    const callPattern = Array(30).fill([1000, 1000]).flat();
    navigator.vibrate(callPattern);
  }

  // Double assurance using Capacitor Haptics API plugin Native engine
  if (isNativePlatform() && !longVibrationInterval) {
    Haptics.vibrate({ duration: 1000 }).catch(() => {});
    longVibrationInterval = setInterval(() => {
      Haptics.vibrate({ duration: 1000 }).catch(() => {});
    }, 2000);
  }
};

export const stopContinuousCallVibration = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0); // 0 stops the vibration immediately
  }
  if (longVibrationInterval) {
    clearInterval(longVibrationInterval);
    longVibrationInterval = null;
  }
};

export const triggerNativeImpactVibration = () => {
  if (isNativePlatform()) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
};

export const triggerLightHapticVibration = () => {
  try {
    if (isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch (e) {}
};

export const triggerMediumHapticVibration = () => {
  try {
    if (isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
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
  // Always default to Capacitor Geolocation for true native hardware access
  try {
    console.log("[GPS] Querying native device location via Capacitor Geolocation plugin...");
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') {
        throw new Error("Location permission denied by user! App requires full GPS permissions.");
      }
    }
    
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      address: `My Location (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`,
      isFallback: false
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
export async function initializeFCMNotifications() {
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
          id: 'grezto_order_channel',
          name: 'Grezto New Orders',
          description: 'Loud alarm for new incoming orders.',
          importance: 5, // 5 = High importance (MAX)
          visibility: 1, // 1 = Public
          sound: 'spaceship_alarm', // Name of the sound file WITHOUT extension (spaceship_alarm.mp3 -> spaceship_alarm)
          vibration: true,
          lights: true,
          lightColor: '#10b981'
        });
        console.log("Custom Push sound notification channel created!");
      } catch (channelErr) {
        console.warn("Could not create Push notification channel:", channelErr);
      }

      // CREATE THE CUSTOM SOUND CHANNEL FOR LOCAL NOTIFICATIONS (Saves sound for Oreo+)
      try {
        await LocalNotifications.createChannel({
          id: 'grezto_order_channel',
          name: 'Grezto New Orders',
          description: 'Loud alarm for new incoming orders.',
          importance: 5, // 5 = High importance (MAX)
          visibility: 1, // 1 = Public
          sound: 'spaceship_alarm', // Name of the sound file
          vibration: true,
          lights: true,
          lightColor: '#10b981'
        });
        console.log("Custom Local sound notification channel created!");
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
    await PushNotifications.addListener('registration', (token) => {
      console.log('[FCM Token Native] Native device successfully registered. Token:', token.value);
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
