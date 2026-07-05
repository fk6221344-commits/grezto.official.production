import React from 'react';
import { motion } from 'motion/react';
import { Bell, X, Info, ShieldCheck } from 'lucide-react';

interface GlobalNotificationsModalProps {
  onClose: () => void;
}

export default function GlobalNotificationsModal({ onClose }: GlobalNotificationsModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
    >
      <motion.div 
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.5 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="bg-white rounded-t-[2.5rem] w-full max-w-md p-6 pb-10 shadow-2xl relative overflow-hidden font-sans"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5"></div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100/60 text-red-900 rounded-2xl flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Notifications</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Your updates & announcements</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-10 h-10 hover:bg-gray-50 rounded-full flex items-center justify-center transition-colors text-gray-400 hover:text-red-900 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="p-4 rounded-3xl bg-amber-50/50 border border-amber-100/40 flex space-x-4 items-start text-left">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-800">Fresh organic avocados has arrived!</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-normal">Premium Hass avocados sourced directly from select organic gardens are now available in raw and perfectly ripe options.</p>
              <span className="text-[9px] font-black uppercase text-amber-700/80 tracking-wider block mt-2">Special Stock 🌿</span>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-emerald-50/50 border border-emerald-100/40 flex space-x-4 items-start text-left">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-gray-800">Assam Express delivery guarantees <span className="text-emerald-700">30 minutes</span></p>
              <p className="text-[10px] text-gray-400 mt-1 leading-normal">Our localized dispatch hubs across Kawarhagi guarantee express hygienically-packed dispatch to your doorstep in under half an hour!</p>
              <span className="text-[9px] font-black uppercase text-emerald-700/80 tracking-wider block mt-2">Active Guarantee ⚡</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
