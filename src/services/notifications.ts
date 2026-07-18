/**
 * Push notification manager and sound service router for Grezto Admin.
 * Handles system/browser push notifications and relays ringtone sound controls from ringtoneService.
 */

import {
  playPremiumOrderSound,
  playRiderSirenSound,
  unlockNotificationAudio,
  startAlertAlarmLoop,
  stopAlertAlarmLoop,
  startRiderAlertAlarmLoop,
  stopRiderAlertAlarmLoop
} from './ringtoneService';

export {
  playPremiumOrderSound,
  playRiderSirenSound,
  unlockNotificationAudio,
  startAlertAlarmLoop,
  stopAlertAlarmLoop,
  startRiderAlertAlarmLoop,
  stopRiderAlertAlarmLoop
};


import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativePlatform, triggerNativeImpactVibration } from './nativeService';

/**
 * Requests Native HTML5 or Capacitor Local Notification permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }
      return true;
    } catch (err) {
      console.error("[Native Notification] Permission error:", err);
      return false;
    }
  }

  if (!('Notification' in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error("Error requesting notification permissions:", err);
    return false;
  }
}

let activeLocalNotificationIds: number[] = [];

/**
 * Sends a native system notification that displays even when app is minimized, backgrounded, or screen is off.
 */
export function sendNativePushNotification(title: string, body: string, onClick?: () => void) {
  // If running in Native Capacitor Android/iOS App
  if (isNativePlatform()) {
    try {
      const notificationId = Math.floor(Math.random() * 1000000);
      activeLocalNotificationIds.push(notificationId);
      LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: title,
            body: body,
            smallIcon: 'ic_stat_name', // Standard Android notification launcher icon
            sound: 'spaceship_alarm', // Map custom high-priority notification sound (WITHOUT extension for native Android raw resource mapping)
            attachments: [],
            extra: {
              clickAction: true
            },
            schedule: { at: new Date(Date.now() + 10) },
            channelId: 'grezto_order_channel_v5' // Updated to match v5 in nativeService
          }
        ]
      }).then(() => {
        console.log(`[Native Local Notification] Successfully sent with ID: ${notificationId}`);
        // Trigger high-power physical haptics
        triggerNativeImpactVibration();
      }).catch(err => {
        console.warn("[Native Local Notification] Schedule failed, fallback to Toast:", err);
      });
      return;
    } catch (err) {
      console.error("[Native Local Notification] Error:", err);
    }
  }

  // Web Browser Fallback
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
      const systemNotification = new Notification(title, {
        body,
        vibrate: [1500, 200, 1500, 200, 2000, 300, 2000, 300, 2000, 300, 3000, 500, 3000],
        tag: 'new-grezto-order',
        requireInteraction: true,
        silent: false
      } as any);

      systemNotification.onclick = () => {
        window.focus();
        if (onClick) onClick();
        systemNotification.close();
      };
    } catch (e) {
      // Background worker failures safely ignored
      console.warn("Native Notification trigger skipped or unsupported:", e);
    }
  }
}

/**
 * Instantly clears all active/delivered native notifications from the device's tray.
 * Used when an order is accepted to clean up the screen.
 */
export async function clearAllNativeNotifications() {
  if (isNativePlatform()) {
    try {
      // 1. Cancel known ones
      if (activeLocalNotificationIds.length > 0) {
        await LocalNotifications.cancel({ notifications: activeLocalNotificationIds.map(id => ({ id })) });
        activeLocalNotificationIds = [];
      }
      
      // 2. Vigorously fetch all currently delivered (visible/ringing) notifications from the OS
      // and explicitly cancel them by ID. This ensures that even if JS state was reset (e.g. app cold start),
      // we still find the ringing notification and forcefully kill it so the sound stops.
      const delivered = await LocalNotifications.getDeliveredNotifications();
      if (delivered && delivered.notifications && delivered.notifications.length > 0) {
        await LocalNotifications.cancel({ 
          notifications: delivered.notifications.map(n => ({ id: n.id })) 
        });
        await LocalNotifications.removeDeliveredNotifications(delivered);
      }

      // 3. Fallback: ask OS to clear all from tray
      await LocalNotifications.removeAllDeliveredNotifications();
      await PushNotifications.removeAllDeliveredNotifications();
      console.log("🧹 Native notifications forcefully cleared & sound stopped.");
    } catch (e) {
      console.warn("Failed to clear native notifications:", e);
    }
  }
}
