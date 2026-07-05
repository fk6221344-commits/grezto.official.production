import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, VolumeX, Volume2, ArrowRight } from 'lucide-react';

interface IncomingOrderAlertProps {
  incomingOrderAlert: any;
  setIncomingOrderAlert: (alert: any) => void;
  dismissedOrderIdsRef: React.MutableRefObject<Set<string>>;
  stopAlertAlarmLoop: () => void;
  startAlertAlarmLoop: () => void;
  alarmMuted: boolean;
  setAlarmMuted: (muted: boolean) => void;
  onAccept: (order: any) => void;
}

export default function IncomingOrderAlert({
  incomingOrderAlert,
  setIncomingOrderAlert,
  dismissedOrderIdsRef,
  stopAlertAlarmLoop,
  startAlertAlarmLoop,
  alarmMuted,
  setAlarmMuted,
  onAccept
}: IncomingOrderAlertProps) {
  return (
    <AnimatePresence>
      {incomingOrderAlert && (
        <motion.div
          initial={{ y: -120, opacity: 0, scale: 0.95 }}
          animate={{ y: 20, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className="fixed top-4 left-4 right-4 z-[900] max-w-sm mx-auto bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 rounded-[2.5rem] p-5 text-white shadow-[0_25px_50px_-12px_rgba(220,38,38,0.4)] border border-white/20 flex flex-col font-sans"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center text-xl shrink-0 animate-bounce">
                ⚡
              </div>
              <div className="min-w-0">
                <span className="text-[8px] font-black uppercase tracking-widest bg-black/15 px-2 py-0.5 rounded-md text-white/90 border border-white/5 inline-block">
                  New Order Incoming
                </span>
                <h4 className="text-sm font-black tracking-tight mt-1.5 truncate">
                  ₹{incomingOrderAlert.amount || incomingOrderAlert.totalAmount} from {incomingOrderAlert.customerName}
                </h4>
                <p className="text-[9px] text-white/85 font-extrabold mt-0.5 max-w-[210px] truncate leading-tight uppercase tracking-wider">
                  Click to process instantly
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (incomingOrderAlert) {
                  dismissedOrderIdsRef.current.add(incomingOrderAlert.id);
                }
                stopAlertAlarmLoop();
                setIncomingOrderAlert(null);
              }}
              className="w-8 h-8 bg-black/10 hover:bg-black/20 text-white rounded-full flex items-center justify-center transition-colors active:scale-90 shrink-0"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex justify-between items-center mt-4.5 pt-4 border-t border-white/10 shrink-0">
            <button 
              onClick={() => {
                setAlarmMuted(!alarmMuted);
                if (!alarmMuted) {
                  stopAlertAlarmLoop();
                } else {
                  startAlertAlarmLoop();
                }
              }}
              className="flex items-center space-x-1.5 text-[8px] font-extrabold uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {alarmMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            <button
              onClick={() => onAccept(incomingOrderAlert)}
              className="bg-white text-rose-700 font-black tracking-wider pb-2 pt-2 px-4 rounded-xl text-[9px] uppercase hover:bg-neutral-50 active:scale-95 transition-all shadow-md shadow-rose-900/10 flex items-center space-x-1.5 cursor-pointer border-none"
            >
              <span>Accept Order</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
