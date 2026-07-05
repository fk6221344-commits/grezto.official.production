import React, { useState, useEffect } from 'react';

// A sleek smooth-rolling integer counter for micro-interactive transitions
export function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = count;
    const end = value;
    if (start === end) return;
    
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(start + progress * (end - start));
      setCount(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span>{count}</span>;
}
