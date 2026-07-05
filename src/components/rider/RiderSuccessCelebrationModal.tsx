import React from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RiderSuccessCelebrationModalProps {
  celebrationData: { orderId: string, customerName: string, amount: number } | null;
  setCelebrationData: (data: any | null) => void;
}

export const RiderSuccessCelebrationModal: React.FC<RiderSuccessCelebrationModalProps> = ({
  celebrationData,
  setCelebrationData
}) => {
  return (
    <AnimatePresence>
      {celebrationData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white/95 border border-slate-100 rounded-[2.5rem] shadow-2xl p-7 max-w-sm w-full text-center relative overflow-hidden"
          >
            {/* Top confetti decorative banner */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-500" />
            
            {/* Sparkle icons */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
              className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-3xl mb-4 relative shadow-lg"
            >
              💰
              <span className="absolute -top-1.5 -right-1.5 text-lg">💡</span>
              <span className="absolute -bottom-1.5 -left-1.5 text-lg">✨</span>
            </motion.div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">Congratulations! 🎉🏆</h3>
              <p className="text-[10.5px] text-emerald-700 font-black tracking-widest uppercase">DELIVERY COMPLETED</p>
            </div>

            {/* Cash incentive box */}
            <div className="my-5 p-4.5 bg-slate-50 border border-slate-150 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none">Job payout incentive credited</span>
              <motion.span 
                initial={{ scale: 0.6 }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="text-4xl font-extrabold text-slate-900 font-mono mt-1"
              >
                +₹{celebrationData.amount}
              </motion.span>
              <div className="flex items-center gap-1.5 mt-2.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Check size={11} className="text-emerald-750 stroke-[3]" />
                <span className="text-[8.5px] text-emerald-800 font-extrabold uppercase tracking-wide">Transferred into Payout Vault</span>
              </div>
            </div>

            <div className="space-y-4 font-sans">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-bold leading-tight">
                  Order ID: <span className="text-slate-850 font-black">#{celebrationData.orderId}</span>
                </p>
                <p className="text-[10.5px] text-slate-500 font-bold leading-tight">
                  Delivered to: <span className="text-slate-850 font-black">{celebrationData.customerName}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCelebrationData(null)}
                className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black text-[9.5px] uppercase tracking-widest cursor-pointer transition shadow-lg active:scale-97 flex items-center justify-center gap-1.5 border-0 hover:shadow-xl font-sans"
              >
                CLAIM PAYOUT & LOGOUT ⚡
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
