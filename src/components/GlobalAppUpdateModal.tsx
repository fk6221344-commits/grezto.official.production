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
          className="fixed top-0 left-0 right-0 z-[9999] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] font-sans border-b border-gray-100"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-3.5 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3.5 flex-1 pr-2">
              <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                <DownloadCloud className="w-4.5 h-4.5 text-green-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900 font-extrabold text-[14px] tracking-tight leading-tight mb-0.5">{updateInfo.title || "New Update"}</span>
                <span className="text-gray-500 font-medium text-[11px] leading-snug line-clamp-2">{updateInfo.message || "Tap to update"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {!updateInfo.forceUpdate && (
                <button 
                  onClick={onDismiss}
                  className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors border-0 bg-transparent cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleUpdate}
                className="bg-[#0a2e1f] text-white hover:bg-[#061c12] active:scale-95 font-bold text-[11px] uppercase tracking-wide px-4 py-2.5 rounded-xl shadow-sm transition-all border-0 cursor-pointer shrink-0"
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
