import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { auth } from '../../services/firebase';
import { supabase } from '../../services/supabase';
import { uploadToR2 } from '../../lib/utils';

// Helper to convert base64 to Blob
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

interface ProfileImageCropperProps {
  cropImageSrc: string | null;
  setCropImageSrc: (src: string | null) => void;
  user: any;
  updateProfile: (data: { avatar: string }) => void;
}

export default function ProfileImageCropper({
  cropImageSrc,
  setCropImageSrc,
  user,
  updateProfile,
}: ProfileImageCropperProps) {
  const [cropShape, setCropShape] = useState<'square' | 'circle'>('square');

  // High-performance refs to prevent continuous full-page React re-renders on dragging and pinching
  const cropZoomRef = useRef<number>(1.2);
  const cropOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Multi-touch pinch track refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1.2);

  // Sync initial parameters on image change
  useEffect(() => {
    if (cropImageSrc) {
      cropZoomRef.current = 1.2;
      cropOffsetRef.current = { x: 0, y: 0 };
      if (cropImgRef.current) {
        cropImgRef.current.style.transform = `translate(0px, 0px) scale(1.2)`;
      }
    }
  }, [cropImageSrc]);

  // Mouse drag handlers (High performance, bypasses state, directly operates on image style)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    cropOffsetRef.current = {
      x: cropOffsetRef.current.x + dx,
      y: cropOffsetRef.current.y + dy,
    };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    if (cropImgRef.current) {
      cropImgRef.current.style.transform = `translate(${cropOffsetRef.current.x}px, ${cropOffsetRef.current.y}px) scale(${cropZoomRef.current})`;
    }
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Touch handlers for seamless 1-finger dragging AND 2-finger dynamic pinch-to-zoom (lag-free, buttery smooth)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartZoomRef.current = cropZoomRef.current;
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      dragStartRef.current = { x: clientX, y: clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / pinchStartDistRef.current;
      const newZoom = Math.min(Math.max(pinchStartZoomRef.current * factor, 1.0), 4.0);
      cropZoomRef.current = newZoom;
      if (cropImgRef.current) {
        cropImgRef.current.style.transform = `translate(${cropOffsetRef.current.x}px, ${cropOffsetRef.current.y}px) scale(${newZoom})`;
      }
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      cropOffsetRef.current = {
        x: cropOffsetRef.current.x + dx,
        y: cropOffsetRef.current.y + dy,
      };
      dragStartRef.current = { x: clientX, y: clientY };
      if (cropImgRef.current) {
        cropImgRef.current.style.transform = `translate(${cropOffsetRef.current.x}px, ${cropOffsetRef.current.y}px) scale(${cropZoomRef.current})`;
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchStartDistRef.current = null;
  };

  // Optional mousewheel/trackpad zoom for desktop users to make zooming highly accessible
  const handleWheel = (e: React.WheelEvent) => {
    const zoomSpeed = 0.08;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(Math.max(cropZoomRef.current + delta * zoomSpeed, 1.0), 4.0);
    cropZoomRef.current = newZoom;
    if (cropImgRef.current) {
      cropImgRef.current.style.transform = `translate(${cropOffsetRef.current.x}px, ${cropOffsetRef.current.y}px) scale(${newZoom})`;
    }
  };

  const handleSaveCrop = () => {
    const img = cropImgRef.current;
    if (!img || !cropImageSrc) return;

    const zoom = cropZoomRef.current;

    // Use a lighter, optimized canvas size (150x150 pixels) so it takes up extremely low local storage
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 150, 150);
    ctx.save();
    ctx.translate(75, 75);
    ctx.scale(zoom, zoom);

    // Visual crop viewport size is 220px, canvas is 150px
    const visualScale = 150 / 220;
    ctx.translate((cropOffsetRef.current.x * visualScale) / zoom, (cropOffsetRef.current.y * visualScale) / zoom);

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW = 150;
    let drawH = 150;
    if (imgAspect > 1) {
      drawH = 150;
      drawW = 150 * imgAspect;
    } else {
      drawW = 150;
      drawH = 150 / imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    try {
      toast.loading("Uploading optimized photo... ⏳✨", { id: "avatar-upload" });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.dismiss("avatar-upload");
          toast.error("Failed to crop image.");
          return;
        }

        try {
          const publicUrl = await uploadToR2(blob, 'avatars', `avatar_${Date.now()}.webp`);
          
          updateProfile({ avatar: publicUrl });
          setCropImageSrc(null);
          toast.dismiss("avatar-upload");
          toast.success("Profile photo updated instantly! 📸");
        } catch (uploadError: any) {
          toast.dismiss("avatar-upload");
          toast.error("Failed to upload avatar: " + uploadError.message);
        }
      }, 'image/webp', 0.90);
    } catch (err) {
      console.error(err);
      toast.error("Failed to crop photo. Try another image.");
    }
  };

  return (
    <AnimatePresence>
      {cropImageSrc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-stone-955/95 backdrop-blur-md z-[1000] flex flex-col items-center justify-center p-6 font-sans text-white"
        >
          <div className="w-full max-w-sm bg-stone-900 rounded-[2.5rem] border border-stone-800 shadow-2xl overflow-hidden p-6 flex flex-col">
            <div className="text-center mb-4">
              <h3 className="text-base font-black text-white uppercase tracking-tight italic">Crop photo</h3>
              <p className="text-[9px] text-stone-400 font-bold uppercase mt-1 tracking-wider">Drag to move • Pinch with 2 fingers to zoom</p>
            </div>

            {/* Aspect Ratio Shape Selector */}
            <div className="flex items-center justify-center gap-2.5 mb-4 bg-stone-950 p-1 rounded-2xl border border-stone-800/80">
              <button
                type="button"
                onClick={() => setCropShape('square')}
                className={`flex-1 py-2 px-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer ${
                  cropShape === 'square'
                    ? 'bg-amber-400 text-stone-950 shadow-md scale-102'
                    : 'bg-transparent text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 bg-current rounded-xs"></span>
                1:1 Square
              </button>
              <button
                type="button"
                onClick={() => setCropShape('circle')}
                className={`flex-1 py-2 px-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-0 cursor-pointer ${
                  cropShape === 'circle'
                    ? 'bg-amber-400 text-stone-950 shadow-md scale-102'
                    : 'bg-transparent text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                Circular Lens
              </button>
            </div>

            {/* Visual drag area container */}
            <div
              onWheel={handleWheel}
              className="relative w-full aspect-square bg-stone-950 rounded-[2rem] overflow-hidden flex items-center justify-center border border-stone-800 select-none cursor-grab active:cursor-grabbing"
            >
              <div
                className={`absolute inset-0 pointer-events-none z-10 border-4 border-amber-400 ${
                  cropShape === 'circle' ? 'rounded-full' : 'rounded-[2rem]'
                } m-8 shadow-[0_0_0_9999px_rgba(12,10,9,0.85)] flex items-center justify-center`}
              >
                {/* Subtle crosshair lines for centering alignment help */}
                <div className="absolute w-full h-px bg-white/20 border-dashed"></div>
                <div className="absolute h-full w-px bg-white/20 border-dashed"></div>
              </div>

              {/* Moveable Image element */}
              <div
                className="w-full h-full overflow-hidden flex items-center justify-center relative touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  ref={cropImgRef}
                  src={cropImageSrc}
                  alt="Source"
                  draggable="false"
                  style={{
                    transform: 'translate(0px, 0px) scale(1.2)',
                    transition: 'none',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                  className="select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-3.5 mt-6">
              <button
                type="button"
                onClick={() => setCropImageSrc(null)}
                className="flex-1 bg-stone-800 border border-stone-700 py-3.5 rounded-2xl text-[10px] font-extrabold text-stone-400 hover:text-white uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                Apply & Save
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
