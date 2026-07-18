/**
 * Dedicated Ringtone Service for Grezto Admin / Merchant Panel.
 * Uses real-time physical Web Audio API synthesis for high priority, zero-latency, offline-ready premium ringtones.
 * Bypasses CORS blocks, slow network loading, and asset failures on web and Android WebViews.
 */

import { startContinuousCallVibration, stopContinuousCallVibration } from './nativeService';
import { clearAllNativeNotifications } from './notifications';

interface RingtoneOptions {
  volume?: number;
  pitchScale?: number;
}

let activeInterval: any = null;
let activeRiderInterval: any = null;
// AudioContext and Web Audio synthesis have been removed to prioritize Native Push Notification sounds.

/**
 * (Disabled) High-Audibility Synthesized Partner Ringtone
 */
export function playPremiumOrderSound(options: RingtoneOptions = {}) {
  // Permanently disabled in favor of Native Android OS push notification sound (spaceship_alarm.mp3)
  return null;
}

/**
 * Unlocks the Web Audio context of notifications in response to user interaction.
 * (Deprecated since Web Audio API ringtones are disabled)
 */
export function unlockNotificationAudio() {
  console.log("🔓 Web Audio API is disabled. Relying purely on Native App Audio.");
}

/**
 * Starts a recurring loop for our high-priority order alarm vibration.
 * Sound is handled by Native LocalNotification channels.
 */
export function startAlertAlarmLoop() {
  if (isAcceptingOrderLock) return; // Prevent race conditions
  if (activeInterval) {
    return; // Already vibrating
  }
  
  // Trigger continuous physical call vibration
  startContinuousCallVibration();
  
  // Loop to keep vibration state fresh if needed, though startContinuousCallVibration handles its own loop
  activeInterval = setInterval(() => {
    // Keep interval alive so we can track the active state
  }, 2800);
}

/**
 * Stops any active order alarm sounds and vibrations.
 */
export function stopAlertAlarmLoop(permanentlyLockForAcceptance = false) {
  if (permanentlyLockForAcceptance) {
    isAcceptingOrderLock = true;
    setTimeout(() => { isAcceptingOrderLock = false; }, 3000); // 3 seconds lock to swallow late real-time updates
  }

  stopContinuousCallVibration();
  clearAllNativeNotifications(); // 🧹 MAGIC: Clear push notification from tray and kill native sound

  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

/**
 * (Disabled) High-Audibility Synthesized Siren for Rider App.
 */
export function playRiderSirenSound(options: RingtoneOptions = {}) {
  // Permanently disabled in favor of Native Android OS push notification sound
  return null;
}

/**
 * Starts a recurring loop for our high-priority RIDER alarm vibration.
 * Sound is handled by Native LocalNotification channels.
 */
export function startRiderAlertAlarmLoop() {
  if (isAcceptingOrderLock) return; // Prevent race conditions
  if (activeRiderInterval) {
    return;
  }

  startContinuousCallVibration();
  
  activeRiderInterval = setInterval(() => {
    // Keep interval alive to track state
  }, 2500);
}

/**
 * Stops any active RIDER alarm vibrations.
 */
export function stopRiderAlertAlarmLoop(permanentlyLockForAcceptance = false) {
  if (permanentlyLockForAcceptance) {
    isAcceptingOrderLock = true;
    setTimeout(() => { isAcceptingOrderLock = false; }, 3000);
  }

  stopContinuousCallVibration();
  clearAllNativeNotifications(); // 🧹 Clear push notifications for rider too!

  if (activeRiderInterval) {
    clearInterval(activeRiderInterval);
    activeRiderInterval = null;
  }
}


