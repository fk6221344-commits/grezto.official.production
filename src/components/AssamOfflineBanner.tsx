import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AssamOfflineBanner() {
  // Online/Offline State monitoring
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online! Connection restored. 🎉", { id: 'grezto-network-toast' });
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-sm pointer-events-none"
        >
          <div className="bg-[#2c2c2c] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#3c3c3c]">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5 text-gray-200" />
            </div>
            <div className="flex flex-col font-sans">
              <span className="text-white text-[13px] font-bold tracking-tight">You're currently offline</span>
              <span className="text-gray-400 text-[11px] font-semibold">Please check your internet connection</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

