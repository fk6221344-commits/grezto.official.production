import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Bike } from 'lucide-react';
import { triggerNativeImpactVibration } from '../services/nativeService';

interface SwipeButtonProps {
  onAccept: () => void;
}

export default function SwipeButton({ onAccept }: SwipeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isTriggered = useRef(false);
  
  // Total container width is 240px. The visual container has p-1 padding (4px).
  // Inner available width is 232px. Handles is 44px (w-11).
  // Total dragging range = 240 - 8 (padding) - 44 (knob) = 188px.
  // 184px is perfect to cover the boundaries with clean clearances.
  const maxDragX = 184;

  const x = useMotionValue(0);

  // Transform knob visual offset to dynamic background fill width
  const fillWidth = useTransform(x, [0, maxDragX], [44, 228]); // Fills background container fluidly
  
  // Smoothly fade out instructions when knob starts sliding
  const textOpacity = useTransform(x, [0, maxDragX / 1.8, maxDragX], [1, 0.2, 0]);

  const handleDragEnd = (_event: any, info: any) => {
    // Check if dragged beyond threshold (forgiving boundary to avoid native touchscreen release drops)
    const currentX = x.get();
    if (!isTriggered.current && (currentX >= maxDragX - 25 || info.offset.x >= maxDragX - 25)) {
      isTriggered.current = true;
      // Lock knob to active position
      x.set(maxDragX);
      
      // Perform heavy physical impact haptic confirmation
      triggerNativeImpactVibration();
      
      onAccept();
    } else if (!isTriggered.current) {
      // Spring reset seamlessly back to 0
      x.set(0);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-[240px] h-13 bg-slate-900 border border-slate-800 rounded-full flex items-center p-1 select-none overflow-hidden mx-auto shadow-inner"
    >
      {/* Background slide percentage track fill */}
      <motion.div 
        className="absolute left-1 top-1 bottom-1 bg-emerald-600 rounded-full"
        style={{ width: fillWidth }}
      />
      
      {/* Dynamic Instruction text */}
      <motion.span 
        style={{ opacity: textOpacity }}
        className="absolute inset-0 flex items-center justify-center font-sans text-[8.5px] font-black uppercase text-white/70 tracking-widest pointer-events-none select-none"
      >
        SWIPE TO ACCEPT ➔
      </motion.span>

      {/* Release trigger hint layer */}
      <motion.span 
        className="absolute left-10 text-[8.5px] font-black uppercase text-emerald-100 tracking-widest pointer-events-none select-none"
        style={{
          opacity: useTransform(x, [maxDragX / 2, maxDragX - 30], [0, 1])
        }}
      >
        RELEASE TO CONFIRM ✓
      </motion.span>

      {/* Draggable handle knob */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: maxDragX }}
        dragElastic={0.06} // Natural slight elastic outer push
        dragTransition={{ bounceStiffness: 450, bounceDamping: 28 }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="absolute left-1 w-11 h-11 bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg z-10 select-none"
      >
        <Bike size={18} className="stroke-[2.5]" />
      </motion.div>
    </div>
  );
}

