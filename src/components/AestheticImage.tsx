import React, { useState, useEffect } from 'react';

interface AestheticImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  className?: string;
  fallbackSrc?: string;
  shimmerClassName?: string;
}

export default function AestheticImage({
  src,
  className = '',
  fallbackSrc = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  shimmerClassName = '',
  alt = 'Image',
  onError,
  ...props
}: AestheticImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    // Reset state on source URL change
    setIsLoaded(false);
    setErrorOccurred(false);
    setCurrentSrc(src);

    if (!src) {
      setIsLoaded(true);
      return;
    }

    const img = new Image();
    img.src = src;
    
    if (img.complete) {
      setIsLoaded(true);
    } else {
      img.onload = () => {
        setIsLoaded(true);
      };
      img.onerror = () => {
        setErrorOccurred(true);
        setIsLoaded(true); // stop showing loading skeleton
      };
    }
  }, [src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!errorOccurred) {
      setErrorOccurred(true);
      setCurrentSrc(fallbackSrc);
      if (onError) onError(e);
    }
  };

  const displaySrc = errorOccurred ? fallbackSrc : (currentSrc || fallbackSrc);

  return (
    <div className={`relative overflow-hidden w-full h-full ${className}`} style={{ contentVisibility: 'auto' }}>
      {/* Premium Shimmer Skeleton */}
      {!isLoaded && (
        <div 
          className={`absolute inset-0 bg-slate-100 flex items-center justify-center animate-pulse z-10 ${shimmerClassName}`} 
          id="aesthetic-shimmer-bg"
        >
          {/* Linear Shiny highlight overlay for rich metallic visual effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-red-shine" />
          <div className="w-6 h-6 rounded-full border border-slate-200 border-t-emerald-600 animate-spin opacity-30" />
        </div>
      )}

      {/* Hardware Accelerated High-fidelity Image Rendering */}
      <img
        src={displaySrc}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-full object-cover transition-all duration-500 ease-out ${
          isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-[1.015] blur-[1px]'
        }`}
        {...props}
      />
    </div>
  );
}
