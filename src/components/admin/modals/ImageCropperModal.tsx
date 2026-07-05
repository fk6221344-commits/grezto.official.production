import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { Crop as CropIcon } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string | null;
  setImageSrc: (val: string | null) => void;
  crop: { x: number; y: number };
  setCrop: (val: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (val: number) => void;
  onCropComplete: (croppedArea: any, croppedAreaPixels: any) => void;
  createCroppedImage: () => Promise<any> | any;
}

export default function ImageCropperModal({
  imageSrc,
  setImageSrc,
  crop,
  setCrop,
  zoom,
  setZoom,
  onCropComplete,
  createCroppedImage
}: ImageCropperModalProps) {
  return (
    <AnimatePresence>
      {imageSrc && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col font-sans">
          <div className="flex-1 relative">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="bg-white p-8 rounded-t-[3rem] sticky bottom-0 flex flex-col items-center">
            <h4 className="text-xl font-black text-gray-800 tracking-tight uppercase mb-6">Crop Photo</h4>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mb-8 accent-emerald-600"
            />
            <div className="flex w-full gap-4">
              <button 
                type="button"
                onClick={() => setImageSrc(null)} 
                className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 border-0 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={createCroppedImage} 
                className="flex-[2] py-4 bg-emerald-600 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 flex items-center justify-center space-x-2 border-0 cursor-pointer"
              >
                <CropIcon className="w-4 h-4" />
                <span>Use This Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
