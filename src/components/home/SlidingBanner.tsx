import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

const extractDominantColor = (imageUrl: string, callback: (hex: string, isLight: boolean) => void) => {
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    // Sample the top 20 pixels of the banner for status bar match
    const w = Math.min(img.width, 100);
    const h = 20; 
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      const luminance = getLuminance(r, g, b);
      callback(hex, luminance > 0.5);
    } catch (e) {
      console.warn("Could not extract dominant color.", e);
    }
  };
  img.src = imageUrl;
};

const updateStatusBarColor = (colorHex: string, isLight: boolean) => {
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.setAttribute('content', colorHex);
  
  // Note: For actual Capacitor native app, you would use:
  // import { StatusBar, Style } from '@capacitor/status-bar';
  // StatusBar.setBackgroundColor({ color: colorHex });
  // StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark });
};

const banners = [
  { 
    id: 2, 
    badge: "FRESH GROCERY",
    line1: "100% PURE &",
    line2: "ORGANIC",
    sub: "Purest farm-to-table organic greens & essential daily needs.", 
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop"
  },
  { 
    id: 1, 
    badge: "PREMIUM CHOICE",
    line1: "ROYAL CHICKEN",
    line2: "BIRYANI",
    sub: "Delicious aromatic slow-cooked Basmati with juicy spiced leg pieces.", 
    image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=1200&auto=format&fit=crop"
  },
  { 
    id: 3, 
    badge: "PREMIUM POULTRY",
    line1: "100% RAW &",
    line2: "FRESH CHICKEN",
    sub: "Hygienically custom-cut farm-fresh whole chicken delivered safely.", 
    image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?q=80&w=1200&auto=format&fit=crop"
  },
  { 
    id: 4, 
    badge: "LOCAL HARVEST",
    line1: "DIRECT FROM",
    line2: "ASSAM FARMS",
    sub: "Handpicked daily by local hard-working farmers of Assam.", 
    image: "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?q=80&w=1200&auto=format&fit=crop"
  }
];

const SlidingBanner = React.memo(() => {
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    // Extract color and update status bar when banner changes
    extractDominantColor(banners[bannerIdx].image, (hex, isLight) => {
      updateStatusBarColor(hex, isLight);
    });
  }, [bannerIdx]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="px-1 mb-8 mt-5 select-none" id="sliding-banner-container">
      <div className="relative h-40 rounded-3xl overflow-hidden shadow-lg shadow-gray-200/40 bg-stone-100 group" id="sliding-banner-frame">
        <AnimatePresence initial={false}>
          <motion.div
            key={bannerIdx}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 160, damping: 24, mass: 0.9 }}
            className="absolute inset-0 flex items-center p-5 sm:p-7 cursor-pointer w-full h-full"
            onClick={() => setBannerIdx((prev) => (prev + 1) % banners.length)}
            id={`sliding-banner-slide-${bannerIdx}`}
          >
            {/* Background image covering full-width, bright and vibrant */}
            <div className="absolute inset-0 w-full h-full" id="sliding-banner-image-wrapper">
              <img 
                fetchPriority="high"
                src={banners[bannerIdx].image || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                alt=""
                id="sliding-banner-img"
              />
              {/* Ultra-soft elegant text protection gradient (fully transparent on the right) */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" 
                id="sliding-banner-gradient" 
              />
            </div>
            
            {/* Styled typography details matching premium food covers */}
            <div className="relative z-10 w-[70%] sm:w-[65%] text-left flex flex-col justify-center h-full pt-1.5 pb-2" id="sliding-banner-text-block">
              <p className="text-[8px] font-black tracking-[0.25em] text-[#fcd34d] uppercase mb-1 font-sans" id="sliding-banner-badge">
                {banners[bannerIdx].badge}
              </p>
              <h2 className="text-white text-base sm:text-lg font-black leading-[1.1] uppercase tracking-tight font-sans drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" id="sliding-banner-title">
                <div>{banners[bannerIdx].line1}</div>
                <div className="text-stone-100 -mt-0.5">{banners[bannerIdx].line2}</div>
              </h2>
              <p className="text-stone-200 text-[9px] leading-tight mt-1 opacity-95 line-clamp-2 max-w-[95%] font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" id="sliding-banner-sub">
                {banners[bannerIdx].sub}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Elegant Pill Indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-20 bg-black/20 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10" id="sliding-banner-indicators">
          {banners.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-300 ${i === bannerIdx ? "w-4 bg-white" : "w-1 bg-white/40"}`}
              id={`sliding-banner-indicator-dot-${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default SlidingBanner;
