import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  codBalance?: number;
}

interface RiderCollectModalProps {
  showCollectModal: Rider | null;
  setShowCollectModal: (rider: Rider | null) => void;
  getSelectedDayForRider: (riderId: string) => { dayName: string; dateLabel: string; label: string; dateKey: string };
  getRiderMetrics: (rider: Rider) => { liveCodBalance: number };
  collectSubMode: 'PAID' | 'UNPAID' | null;
  setCollectSubMode: (mode: 'PAID' | 'UNPAID' | null) => void;
  collectAmount: string;
  setCollectAmount: (val: string) => void;
  handleUnpaidCollectVerification: () => Promise<any>;
  handlePaidCollectAndSetStatus: () => Promise<any>;
  isMounted: boolean;
}

export default function RiderCollectModal({
  showCollectModal,
  setShowCollectModal,
  getSelectedDayForRider,
  getRiderMetrics,
  collectSubMode,
  setCollectSubMode,
  collectAmount,
  setCollectAmount,
  handleUnpaidCollectVerification,
  handlePaidCollectAndSetStatus,
  isMounted,
}: RiderCollectModalProps) {
  if (!isMounted || !showCollectModal) return null;

  const riderSelectedDay = getSelectedDayForRider(showCollectModal.id);
  const collectMetrics = getRiderMetrics(showCollectModal);

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans text-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden text-left"
        >
          <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                <span>💰</span> Cash Collection
              </h3>
              <p className="text-[8.5px] text-emerald-250 font-bold uppercase tracking-widest mt-0.5">
                {showCollectModal.name} • {riderSelectedDay.dayName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCollectModal(null);
                setCollectSubMode(null);
              }}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer border-0"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5.5 space-y-4">
            {collectSubMode === null ? (
              <div className="space-y-3.5 py-1">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Select status for {riderSelectedDay.dayName}:
                </p>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {/* Option 1: Paid */}
                  <button
                    type="button"
                    onClick={() => setCollectSubMode('PAID')}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-4.5 rounded-2xl border border-emerald-200 cursor-pointer transition active:scale-[0.97] flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <span className="text-xl">💰</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">Paid</span>
                  </button>

                  {/* Option 2: Unpaid */}
                  <button
                    type="button"
                    onClick={handleUnpaidCollectVerification}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-4.5 rounded-2xl border border-slate-200 cursor-pointer transition active:scale-[0.97] flex flex-col items-center gap-1 shadow-2xs"
                  >
                    <span className="text-xl">⏳</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">Unpaid</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Compact Rider Holding Cash Box */}
                <div className="bg-slate-50/80 px-4 py-2.5 rounded-xl border border-slate-150 flex items-center justify-between text-left">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                    Current Rider Holding Cash
                  </span>
                  <p className="text-xs font-black text-slate-800 font-mono">
                    ₹{collectMetrics.liveCodBalance}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase text-slate-450 tracking-widest ml-1">
                    Amount to register as collected (₹)
                  </label>
                  <input
                    autoFocus
                    type="number"
                    placeholder="Enter collection amount"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex gap-2.5 pt-1.5 pb-0.5">
                  <button
                    type="button"
                    onClick={() => setCollectSubMode(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider border border-slate-200/40 cursor-pointer transition active:scale-95"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handlePaidCollectAndSetStatus}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider shadow-sm shadow-emerald-500/30 hover:scale-[1.01] transition-all border-0 cursor-pointer"
                  >
                    Confirm Cash Collect
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
