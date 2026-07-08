import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { logoBase64 } from './SplashLogoBase64';

export default function Splash({ onFinish }: { onFinish: () => void; key?: React.Key }) {
  useEffect(() => {
    // Exact 1000ms duration (1 second) for ultra-fast startup as per your requirement
    const timer = setTimeout(onFinish, 1000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="fixed inset-0 bg-[#fffdfa] flex flex-col items-center justify-center z-[9999] px-6"
    >
      <motion.div
        initial={{ scale: 0.8, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="w-32 h-32 bg-[#fffdfa] rounded-[2.5rem] flex items-center justify-center overflow-hidden shadow-2xl shadow-red-950/20 border-2 border-red-900/10"
      >
        <img 
          src={logoBase64} 
          alt="Grezto Logo" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-8 text-4xl font-extrabold text-red-900 tracking-tight"
      >
        Grezto
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-3 text-red-900/40 font-bold uppercase text-[10px] tracking-[0.3em] text-center"
      >
        ASSAM FRESH HUB
      </motion.p>
      
      <div className="absolute bottom-16 flex space-x-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
            className="w-1.5 h-1.5 bg-red-800 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
}
