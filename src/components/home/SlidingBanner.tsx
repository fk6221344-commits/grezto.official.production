import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AestheticImage from '../AestheticImage';

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
    badge: "SPECIAL OFFER",
    line1: "FIRST ORDER",
    line2: "100% FREE DELIVERY",
    sub: "Flat 50% OFF delivery on ₹499+ & 100% FREE on ₹1000+ orders.", 
    image: "/premium-delivery-banner.png"
  },
  { 
    id: 1, 
    badge: "PREMIUM CHOICE",
    line1: "ROYAL CHICKEN",
    line2: "BIRYANI",
    sub: "Delicious aromatic slow-cooked Basmati with juicy spiced leg pieces.", 
    image: "https://i.postimg.cc/TYKQ1gV9/36ddbea6-caba-43c3-87c4-e93b47a5a155.png"
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
  const [direction, setDirection] = useState(1); // 1 for next, -1 for prev

  useEffect(() => {
    // Extract color and update status bar when banner changes
    extractDominantColor(banners[bannerIdx].image, (hex, isLight) => {
      updateStatusBarColor(hex, isLight);
    });
  }, [bannerIdx]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setBannerIdx((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0.95
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0.95
    })
  };

  return (
    <div className="px-1 mb-3 mt-3 select-none" id="sliding-banner-container">
      <div className="relative h-40 rounded-3xl overflow-hidden shadow-lg shadow-gray-200/40 bg-stone-100 group" id="sliding-banner-frame">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={bannerIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(e, info) => {
              const swipeThreshold = 50;
              if (info.offset.x < -swipeThreshold) {
                // Swiped Left -> Show next banner
                setDirection(1);
                setBannerIdx((prev) => (prev + 1) % banners.length);
              } else if (info.offset.x > swipeThreshold) {
                // Swiped Right -> Show prev banner
                setDirection(-1);
                setBannerIdx((prev) => (prev - 1 + banners.length) % banners.length);
              }
            }}
            onTap={() => {
              // Click/Tap to go next (only if not dragged)
              setDirection(1);
              setBannerIdx((prev) => (prev + 1) % banners.length);
            }}
            className="absolute inset-0 flex items-center p-5 sm:p-7 cursor-grab active:cursor-grabbing w-full h-full select-none touch-pan-y"
            id={`sliding-banner-slide-${bannerIdx}`}
          >
            {/* Background image covering full-width, bright and vibrant */}
            <div className="absolute inset-0 w-full h-full" id="sliding-banner-image-wrapper">
              <AestheticImage 
                src={banners[bannerIdx].image || ""} 
                className="w-full h-full"
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
