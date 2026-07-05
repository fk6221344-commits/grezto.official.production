import React, { useState, useEffect, useRef } from 'react';

interface VirtualListItemProps {
  children: React.ReactNode;
  height?: number;
  id?: string;
}

/**
 * [PILLAR 4: DOM VIRTUALIZATION]
 * Lightweight, zero-dependency, and extremely robust virtualization wrapper.
 * Uses IntersectionObserver to dynamically mount/unmount items from the DOM,
 * replacing out-of-viewport items with empty placeholders of precise height.
 * This ensures fluid 60fps scrolling on low-end mobile devices and prevents memory crashes.
 */
export function VirtualListItem({ children, height = 76, id }: VirtualListItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '250px 0px', // Pre-render slightly before entering viewport for an ultra-smooth visual feel
        threshold: 0,
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <div 
      ref={ref} 
      id={id}
      style={{ minHeight: isVisible ? undefined : `${height}px` }}
      className="transition-all duration-150 ease-in-out"
    >
      {isVisible ? children : <div style={{ height: `${height}px` }} className="w-full bg-transparent border border-transparent" />}
    </div>
  );
}
