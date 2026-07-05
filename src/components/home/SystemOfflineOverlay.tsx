import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface SystemOfflineOverlayProps {
  countdown: string;
}

export default function SystemOfflineOverlay({ countdown }: SystemOfflineOverlayProps) {
  if (!countdown || countdown === "00h : 00m : 00s") return null;
  
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="bg-gradient-to-b from-[#e53935] to-[#b71c1c] pb-4 pt-4 px-4 text-center text-white shadow-xl mb-4 relative overflow-hidden rounded-b-[2.2rem]"
      >
        {/* Premium subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/30 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
          {/* Top Status */}
          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-sm">System Offline</span>
          </div>
          
          {/* Main Content */}
          <div className="flex flex-col items-center justify-center -space-y-0.5 mt-1">
            <h2 className="text-sm font-bold text-red-50 drop-shadow-md">Market opens in</h2>
            <div className="text-[#fef08a] font-sans text-[2.4rem] leading-none font-black tracking-tight drop-shadow-lg tabular-nums mt-1">
              {countdown}
            </div>
          </div>
          
          {/* Bottom Alert */}
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-red-100/90 mt-1 uppercase tracking-widest bg-red-900/30 px-3 py-1.5 rounded-xl backdrop-blur-sm border border-red-400/20 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5" />
            Ordering is currently suspended
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
