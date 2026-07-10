import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

export function useSystemCountdown(isSystemOnline: boolean, systemReopenTime: string | null) {
  const [countdown, setCountdown] = useState<string>("");
  const timeWasPositive = useRef(false);

  useEffect(() => {
    if (isSystemOnline) return;

    const updateTimer = () => {
      const now = new Date();
      let target: Date;
      
      if (systemReopenTime) {
        target = new Date(systemReopenTime);
        if (target.getTime() <= now.getTime()) {
          target = new Date(); // Evaluate to 0
        }
      } else {
        target = new Date();
        target.setHours(8, 30, 0, 0);
        // If it's already past 8:30 AM today, target tomorrow 8:30 AM
        if (now.getTime() > target.getTime()) {
          target.setDate(target.getDate() + 1);
        }
      }

      const diff = target.getTime() - now.getTime();
      
      if (diff > 0) {
        timeWasPositive.current = true;
      }

      if (diff <= 0) {
        setCountdown("00h : 00m : 00s");
        if (timeWasPositive.current) {
          timeWasPositive.current = false;
          if (supabase) {
            // Optimistically try to reopen the system from the client
            supabase.from('system_config').upsert({ id: 'config', isSystemOnline: true, systemReopenTime: null }).then(() => {
              window.location.reload();
            });
          } else {
            window.location.reload();
          }
        }
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSystemOnline, systemReopenTime]);

  return countdown;
}
