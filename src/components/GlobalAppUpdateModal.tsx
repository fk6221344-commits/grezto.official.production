import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadCloud, X } from 'lucide-react';
import { AppUpdateInfo } from '../hooks/useAppUpdate';
import { Browser } from '@capacitor/browser';

interface Props {
  show: boolean;
  updateInfo: AppUpdateInfo | null;
  onDismiss: () => void;
}

const GlobalAppUpdateModal: React.FC<Props> = ({ show, updateInfo, onDismiss }) => {
  if (!updateInfo) return null;

  const handleUpdate = async () => {
    if (updateInfo.downloadUrl) {
      try {
        await Browser.open({ url: updateInfo.downloadUrl });
      } catch (err) {
        window.open(updateInfo.downloadUrl, '_system');
      }
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative w-full max-w-[340px] bg-white rounded-[2rem] shadow-2xl overflow-hidden p-6 text-center border border-gray-100"
          >
            {/* Close Button (only if not forced) */}
            {!updateInfo.forceUpdate && (
              <button 
                onClick={onDismiss}
                className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Icon */}
            <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5 mt-2 relative">
              <div className="absolute inset-0 bg-green-400 opacity-20 rounded-full animate-ping" />
              <DownloadCloud className="w-10 h-10 text-green-600 relative z-10" />
            </div>

            {/* Title & Message */}
            <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">
              {updateInfo.title || "Update Available"}
            </h2>
            <p className="text-[13px] font-medium text-gray-500 leading-relaxed mb-6 px-2">
              {updateInfo.message || "A new version of the app is available. Please update to enjoy the latest features."}
            </p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleUpdate}
                className="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white font-extrabold text-[13px] tracking-widest uppercase py-4 rounded-2xl shadow-[0_4px_14px_rgba(22,163,74,0.4)] transition-all border-0 cursor-pointer"
              >
                Download Update Now
              </button>

              {!updateInfo.forceUpdate && (
                <button
                  onClick={onDismiss}
                  className="w-full bg-transparent text-gray-400 hover:text-gray-600 font-bold text-[12px] uppercase py-2 transition-colors border-0 cursor-pointer"
                >
                  I'll do it later
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAppUpdateModal;
