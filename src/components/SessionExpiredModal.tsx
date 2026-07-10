import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface SessionExpiredModalProps {
  showSessionExpiredModal: boolean;
  handleSessionExpiredReset: () => void;
}

export default function SessionExpiredModal({
  showSessionExpiredModal,
  handleSessionExpiredReset
}: SessionExpiredModalProps) {
  return (
    <AnimatePresence>
      {showSessionExpiredModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col items-center text-center"
          >
            {/* Alert Icon */}
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 animate-bounce">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              Session Expired! 🛑
            </h3>
            
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Bhai, security aur privacy reasons ki wajah se aapka login session expire ho gaya hai. Kripya fir se login karein taki aap smoothly orders aur menus manage kar sakein.
            </p>

            <button
              onClick={handleSessionExpiredReset}
              className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-2xl shadow-lg shadow-red-500/20 transition-all duration-200"
            >
              Login Fir Se Karein 🔐
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
