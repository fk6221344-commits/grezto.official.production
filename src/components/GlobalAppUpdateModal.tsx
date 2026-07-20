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
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg font-sans"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <DownloadCloud className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-[13px] tracking-wide">{updateInfo.title || "New Update"}</span>
                <span className="text-white/80 font-semibold text-[9.5px] uppercase tracking-wider">{updateInfo.message || "Tap to update"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!updateInfo.forceUpdate && (
                <button 
                  onClick={onDismiss}
                  className="p-1.5 rounded-full text-emerald-100 hover:bg-white/10 hover:text-white transition-colors border-0 bg-transparent cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleUpdate}
                className="bg-white text-emerald-700 hover:bg-stone-50 active:scale-95 font-black text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl shadow-sm transition-all border-0 cursor-pointer"
              >
                Update
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAppUpdateModal;
