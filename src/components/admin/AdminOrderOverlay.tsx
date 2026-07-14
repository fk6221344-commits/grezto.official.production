import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import SwipeButton from '../SwipeButton';

interface AdminOrderOverlayProps {
  incomingOrderAlert: any;
  onAccept: () => void;
}

export default function AdminOrderOverlay({
  incomingOrderAlert,
  onAccept
}: AdminOrderOverlayProps) {
  const hasIncoming = !!incomingOrderAlert;
  const currentIncoming = incomingOrderAlert;

  // We don't need a visible countdown timer for this UI based on the screenshot, 
  // but we can keep the logic if needed, or just let it ring.
  // The screenshot is a clean, minimal white UI.

  return (
    <AnimatePresence>
      {hasIncoming && currentIncoming && (
        <div className="fixed inset-0 z-[99999] bg-white text-slate-900 flex flex-col items-center justify-between py-16 px-8 font-sans select-none animate-fade-in">
          
          {/* Top Logo Section */}
          <div className="mt-8 flex flex-col items-center">
            <h1 className="text-5xl font-black tracking-tight" style={{ color: '#c8102e' }}>
              Grezto
            </h1>
            <span className="text-[9px] font-black tracking-[0.3em] uppercase mt-1" style={{ color: '#c8102e' }}>
              Assam Fresh Hub
            </span>
          </div>

          {/* Middle Icon and Text Section */}
          <div className="flex flex-col items-center flex-1 justify-center space-y-8 w-full max-w-sm mx-auto">
            
            {/* Glowing Icon */}
            <div className="relative flex items-center justify-center w-32 h-32">
              {/* Outer pulsing glow */}
              <div className="absolute inset-0 bg-red-500/10 rounded-full animate-ping scale-[1.5]" />
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
              
              {/* Icon Circle */}
              <div className="relative z-10 w-24 h-24 bg-white rounded-full shadow-lg shadow-red-500/10 border border-red-50 flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 animate-bounce" strokeWidth={2} style={{ color: '#c8102e' }} />
              </div>
            </div>

            {/* Text Information */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                New Order Incoming!
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Swipe right to accept
              </p>
            </div>

            {/* Animated Dots */}
            <div className="flex items-center justify-center space-x-2 pt-2">
              <motion.div 
                animate={{ opacity: [0.3, 1, 0.3] }} 
                transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                className="w-1.5 h-1.5 rounded-full bg-red-200" 
              />
              <motion.div 
                animate={{ opacity: [0.3, 1, 0.3] }} 
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                className="w-6 h-1.5 rounded-full" style={{ backgroundColor: '#c8102e' }} 
              />
              <motion.div 
                animate={{ opacity: [0.3, 1, 0.3] }} 
                transition={{ repeat: Infinity, duration: 1.5, delay: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-red-200" 
              />
            </div>
          </div>

          {/* Bottom Swipe Button Section (Shifted Lower) */}
          <div className="w-full max-w-sm mx-auto mb-4 relative z-10">
            {/* We will wrap the SwipeButton in a custom styled container to match the red theme of the image if needed, 
                or just use the existing one. The user's image shows a white button with red text and red arrows.
                Since SwipeButton is a standalone component, we might need to pass custom styles or just rely on its default.
                To perfectly match the image without altering SwipeButton for Rider, I will build a custom inline swipe logic here, 
                or assume SwipeButton accepts classes. Looking at the UI, a custom Red themed swipe slider is needed. */}
            
            <RedSwipeSlider onAccept={onAccept} />
          </div>

        </div>
      )}
    </AnimatePresence>
  );
}

// A custom swipe button specifically designed to match the provided Red/White UI exactly.
function RedSwipeSlider({ onAccept }: { onAccept: () => void }) {
  const [isSwiping, setIsSwiping] = React.useState(false);
  const [swipeProgress, setSwipeProgress] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLDivElement>(null);

  const handleDrag = (info: any) => {
    if (!containerRef.current || !buttonRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const buttonWidth = buttonRef.current.offsetWidth;
    const maxSwipe = containerWidth - buttonWidth - 8; // 4px padding on each side
    
    let newProgress = info.point.x - containerRef.current.getBoundingClientRect().left - (buttonWidth / 2);
    newProgress = Math.max(0, Math.min(newProgress, maxSwipe));
    
    setSwipeProgress(newProgress);
    setIsSwiping(true);

    if (newProgress >= maxSwipe - 10) {
      onAccept();
    }
  };

  const handleDragEnd = () => {
    setIsSwiping(false);
    if (containerRef.current && buttonRef.current) {
      const maxSwipe = containerRef.current.offsetWidth - buttonRef.current.offsetWidth - 8;
      if (swipeProgress < maxSwipe - 10) {
        setSwipeProgress(0);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-16 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-[0_8px_30px_rgb(200,16,46,0.12)] border border-red-100"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-sm font-semibold text-slate-600 z-0">
          Swipe right to <span style={{ color: '#c8102e' }}>accept</span>
        </span>
      </div>

      <motion.div
        ref={buttonRef}
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag(info)}
        onDragEnd={handleDragEnd}
        animate={{ x: swipeProgress }}
        transition={{ type: isSwiping ? 'tween' : 'spring', duration: isSwiping ? 0 : 0.5 }}
        className="absolute left-1 w-14 h-14 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <div className="flex space-x-0.5 text-red-300">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8102e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
        </div>
      </motion.div>
    </div>
  );
}
