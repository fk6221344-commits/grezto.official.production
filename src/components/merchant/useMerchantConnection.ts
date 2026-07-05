import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useMerchantConnection() {
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'syncing'>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);

  useEffect(() => {
    if (isSimulatingOffline) return;

    const handleOnline = () => {
      setConnectionStatus('syncing');
      const timer = setTimeout(() => {
        setConnectionStatus('online');
        toast.success("Database connection re-established! Synchronizing local cache... ☁️✅", {
          id: 'firebase-sync-toast',
          duration: 3000
        });
      }, 2500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setConnectionStatus('offline');
      toast.error("Cloud connection lost! Operating in local backup offline mode. ⭕", {
        id: 'firebase-sync-toast',
        duration: 4000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (typeof navigator !== 'undefined') {
      if (!navigator.onLine) {
        setConnectionStatus('offline');
      } else {
        setConnectionStatus('online');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatingOffline]);

  const toggleSimulateConnectionState = () => {
    if (isSimulatingOffline) {
      // Transitioning back to online
      setIsSimulatingOffline(false);
      setConnectionStatus('syncing');
      setTimeout(() => {
        setConnectionStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online');
        toast.success("Simulated Connection Restored! Synchronized online. ☁️⚡", {
          id: 'dev-sync-toast'
        });
      }, 2000);
    } else {
      // Going offline
      setIsSimulatingOffline(true);
      setConnectionStatus('offline');
      toast.error("Simulated Offline Mode Active. Local cache operational! 🛑💾", {
        id: 'dev-sync-toast'
      });
    }
  };

  return {
    connectionStatus,
    isSimulatingOffline,
    toggleSimulateConnectionState,
  };
}
