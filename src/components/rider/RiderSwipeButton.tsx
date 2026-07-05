import React, { useState, useRef } from 'react';
import { Bike } from 'lucide-react';

export const SwipeButton = ({ onAccept }: { onAccept: () => void }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const maxDrag = 180; // Drag boundary limit
  const containerRef = useRef<HTMLDivElement>(null);
  const isTriggered = useRef(false);

  const handleStart = () => {
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offset = clientX - rect.left - 24; // 24 is half of knob (48px wide)
    const cleanX = Math.max(0, Math.min(offset, maxDrag));
    setDragX(cleanX);
    
    // Instantly accept when threshold is crossed during drag
    if (!isTriggered.current && cleanX >= maxDrag - 5) {
      isTriggered.current = true;
      setIsDragging(false);
      setDragX(maxDrag);
      onAccept();
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (!isTriggered.current && dragX >= maxDrag - 5) {
      isTriggered.current = true;
      setDragX(maxDrag);
      onAccept();
    } else if (!isTriggered.current) {
      setDragX(0);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-[240px] h-13 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center p-1 select-none overflow-hidden mx-auto shadow-inner"
      onTouchMove={(e) => {
        if (e.touches && e.touches.length > 0) {
          handleMove(e.touches[0].clientX);
        }
      }}
      onTouchEnd={handleEnd}
      onMouseMove={(e) => {
        handleMove(e.clientX);
      }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {/* Background slide percentage track fill */}
      <div 
        className="absolute left-0 top-0 bottom-0 bg-emerald-600/90 transition-all duration-75"
        style={{ width: `${Math.max(48, dragX + 48)}px` }}
      />
      
      {/* Dynamic Instruction text */}
      <span className="absolute text-[8.5px] font-black uppercase text-white/60 tracking-widest pointer-events-none animate-pulse">
        {dragX > maxDrag / 2 ? "RELEASE TO ACCEPT ✓" : "SWIPE TO ACCEPT ➔"}
      </span>

      {/* Draggable handle knob */}
      <div
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        className="absolute left-1 w-11 h-11 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-transform duration-75 ease-out flex-shrink-0"
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <Bike size={18} className="stroke-[2.5]" />
      </div>
    </div>
  );
};
