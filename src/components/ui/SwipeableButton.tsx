import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface SwipeableButtonProps {
  onSwipeComplete: () => void;
  text?: string;
  color?: string;
}

export default function SwipeableButton({ 
  onSwipeComplete, 
  text = "SWIPE TO ACCEPT",
  color = "bg-gradient-to-r from-emerald-500 to-teal-500" 
}: SwipeableButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isTriggered = useRef(false);
  const [width, setWidth] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDragEnd = (event: any, info: any) => {
    if (!isTriggered.current && info.offset.x > width * 0.75) {
       isTriggered.current = true;
       setIsSuccess(true);
       onSwipeComplete();
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative h-14 w-full rounded-2xl flex items-center justify-center overflow-hidden border-2 ${isSuccess ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
    >
      {/* Background color fill when success */}
      {isSuccess && (
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          className={`absolute left-0 top-0 bottom-0 ${color} opacity-20`}
        />
      )}

      <span className={`font-black tracking-widest text-[11px] select-none z-0 ${isSuccess ? 'text-emerald-600' : 'text-slate-400'}`}>
        {isSuccess ? 'ACCEPTED!' : text}
      </span>

      {!isSuccess && width > 0 && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: width - 60 }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          whileTap={{ scale: 0.95 }}
          className={`absolute left-1.5 top-1.5 bottom-1.5 w-12 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-md ${color} text-white`}
        >
          <ChevronRight size={20} strokeWidth={3} />
          <ChevronRight size={20} strokeWidth={3} className="-ml-3 opacity-50" />
        </motion.div>
      )}
    </div>
  );
}
