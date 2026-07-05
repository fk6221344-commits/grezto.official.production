import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Truck, Package, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Howl } from 'howler';
import { useLanguage } from '../context/LanguageContext';

export default function OrderSuccess({ 
  onTrack, 
  onBack, 
  lastOrderDetails 
}: { 
  onTrack: () => void, 
  onBack?: () => void, 
  lastOrderDetails?: any 
}) {
  const { t } = useLanguage();

  useEffect(() => {
    // 1. Fire Confetti
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 40 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // 2. Play Sound (High Quality Confirmation)
    const sound = new Howl({
      src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_c3502c1e6a.mp3'], // High quality success chime
      volume: 1.0,
      autoplay: true,
      html5: true
    });

    // Trigger one big burst immediately
    confetti({
      particleCount: 120,
      spread: 60,
      origin: { y: 0.55 },
      colors: ['#10b981', '#34d399', '#ffffff', '#fbbf24']
    });

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#fbfdfd] via-[#f9fafb] to-[#f3f4f6] z-[60] flex flex-col justify-between px-5 py-6 overflow-hidden select-none">
      
      {/* Top Header with beautiful back button */}
      <div className="w-full flex items-center justify-start h-10 mt-1">
        {onBack && (
          <button 
            type="button"
            onClick={onBack}
            className="w-9 h-9 bg-white hover:bg-slate-50 text-slate-700 rounded-xl active:scale-95 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-center cursor-pointer"
            id="back-from-success-btn"
          >
            <ArrowLeft size={16} className="stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Main Content Container (Scroll prevented, highly compact) */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xs mx-auto -mt-2">
        
        {/* Compact Centered Badge with gorgeous glow */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="relative mb-6"
        >
          {/* Outer elegant glow effects */}
          <div className="absolute inset-x-0 -top-2 -bottom-2 bg-gradient-to-tr from-rose-600/10 to-red-600/5 rounded-full blur-xl animate-pulse" />
          <div className="absolute -inset-1 bg-gradient-to-tr from-red-600/15 via-pink-500/8 to-rose-400/5 rounded-[2rem] blur-lg opacity-75" />

          {/* Sizing reduced to w-20/h-20 and styled like a luxury badge */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-20 h-20 bg-gradient-to-tr from-red-950 via-red-900 to-rose-800 rounded-[1.8rem] flex items-center justify-center shadow-[0_16px_36px_rgba(153,27,27,0.25)] border border-rose-400/20 relative z-10"
          >
            {/* Inner Ring decoration */}
            <div className="absolute inset-1 rounded-[1.5rem] border border-rose-300/10 bg-black/5" />
            
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 14, delay: 0.15 }}
            >
              <CheckCircle className="text-white w-10 h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Dynamic Headings with downscaled typography and margin */}
        <div className="text-center w-full px-1">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-col items-center"
          >
            <h2 className="text-[17px] font-black text-slate-800 mb-1 tracking-tight flex items-center justify-center gap-1.5">
              🎉 Congratulations 🙏
            </h2>
            
            {/* Elegant Sub-Header */}
            <div className="relative inline-block mb-4">
              <span className="text-[8.5px] font-black tracking-[0.3em] uppercase bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 bg-clip-text text-transparent">
                Order Authenticated
              </span>
              <div className="h-[1px] w-8 bg-rose-200 mx-auto mt-1 rounded-[1px]" />
            </div>

            {/* Downscaled light text banner card with a lovely, sweet, and premium rose blossom color */}
            <p className="text-[10px] font-extrabold text-rose-600/90 leading-normal uppercase tracking-wider max-w-[240px] mx-auto bg-rose-50/40 px-3.5 py-2 rounded-xl border border-rose-100/50 shadow-[0_2px_8px_rgba(244,63,94,0.03)]">
              {t('order_success')}
            </p>
          </motion.div>
        </div>

        {/* Elegant Bento Grid Status Cards with compact sizing */}
        <motion.div 
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-6 grid grid-cols-2 gap-3.5 w-full"
        >
          {/* Card 1: Status */}
          <div className="bg-white/80 border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.015)] p-4 rounded-[1.6rem] flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.01]">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 shadow-[0_3px_8px_rgba(13,148,136,0.08)]">
              <Package size={18} className="stroke-[2.2]" />
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
            <span className="text-[10px] font-black text-slate-800 mt-1.5 uppercase tracking-wide">{t('status_received')}</span>
          </div>

          {/* Card 2: Arrival */}
          <div className="bg-white/80 border border-slate-100/80 shadow-[0_4px_12px_rgba(0,0,0,0.015)] p-4 rounded-[1.6rem] flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.01]">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 shadow-[0_3px_8px_rgba(79,70,229,0.08)]">
              <Truck size={18} className="stroke-[2.2]" />
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Arrival</span>
            <span className="text-[10px] font-black text-slate-800 mt-1.5 uppercase tracking-wide">~ 30 Mins</span>
          </div>
        </motion.div>

        {/* Dynamic Compact Action Button right after stats cards */}
        <div className="w-full max-w-[200px] mt-7">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onTrack}
            className="w-full bg-gradient-to-r from-emerald-950 to-slate-900 border border-emerald-950/10 hover:from-black hover:to-emerald-950 py-2.5 px-4 rounded-xl text-white text-[9px] font-black uppercase tracking-[0.18em] shadow-[0_6px_18px_rgba(6,78,59,0.15)] cursor-pointer"
            id="view-orders-after-success-btn"
          >
            {t('track_order')}
          </motion.button>
        </div>

      </div>

    </div>
  );
}

