import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebase';
import { supabase } from './supabase';
import toast from 'react-hot-toast';
import config from '../../firebase-applet-config.json';

// Play a loud alarm sound
// Using a web worker message or directly passing down
const ALARM_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg";
let currentAlarm: HTMLAudioElement | null = null;

export const playAlarm = () => {
  // Sound permanently disabled as requested
  console.log("🔊 Push notification alarm playback disabled permanently.");
};

export const stopAlarm = () => {
  if (currentAlarm) {
    currentAlarm.pause();
    currentAlarm.currentTime = 0;
    currentAlarm = null;
  }
};

export const setupPushNotifications = async (userIdStr?: string) => {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn("Service workers are not supported.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Notification permission not granted");
      return;
    }

    // Register custom Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log("Service Worker registered successfully!");

    // Send config to service worker
    if (registration.active) {
       registration.active.postMessage({
         type: 'FIREBASE_CONFIG',
         config: config
       });
    }

    // Wait for messaging to be initialized asynchronously
    if (!messaging) {
       console.warn("FCM is not supported in this environment or not initialized yet.");
    } else {
        try {
            const token = await getToken(messaging, { 
                serviceWorkerRegistration: registration 
                // vapidKey: 'YOUR_VAPID_KEY_HERE' 
            });
            console.log("FCM Device Token:", token);
            
            // Store token in Supabase if logged in
            if (userIdStr && supabase) {
               try {
                 await supabase.from('device_tokens').upsert({
                   id: userIdStr,
                   token: token,
                   updatedAt: new Date().toISOString()
                 });
                 console.log("Device token saved mapping to userId:", userIdStr);
               } catch (e) {
                 console.error("Failed to save device token:", e);
               }
            }
        } catch (tokenErr) {
            console.warn("Could not get FCM token (VAPID key might be missing):", tokenErr);
        }

        // Handle foreground notifications
        onMessage(messaging, (payload) => {
            console.log("Foreground message received:", payload);
            const title = payload.notification?.title || "Mission Alert 🚨";
            const body = payload.notification?.body || "New order assigned!";
            
            toast.custom(
                (t) => (
                    <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-xl shadow-2xl flex items-start max-w-sm">
                       <span className="text-3xl mr-3 blink-animation">🚨</span>
                       <div>
                         <h1 className="text-emerald-400 font-black tracking-wider uppercase mb-1">{title}</h1>
                         <p className="text-white text-sm font-bold">{body}</p>
                         <button 
                           onClick={() => { stopAlarm(); toast.dismiss(t.id); }}
                           className="mt-3 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                         >
                           Acknowledge
                         </button>
                       </div>
                    </div>
                ),
                { duration: 15000, position: 'top-center' }
            );

            playAlarm();
        });
    }

    // Listen to messages from the background service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ALARM_TRIGGERS') {
        console.log("Alarm triggered via background SW");
        playAlarm();
      }
      if (event.data && event.data.type === 'STOP_ALARM') {
         console.log("Stop Alarm via background SW click");
         stopAlarm();
      }
    });

  } catch (error) {
    console.error("Error setting up push notifications:", error);
  }
};
