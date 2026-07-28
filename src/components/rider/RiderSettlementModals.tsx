import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  dailySettlements?: Record<string, 'PAID' | 'UNPAID'>;
}

interface RiderSettlementModalsProps {
  showSettleModal: Rider | null;
  setShowSettleModal: (rider: Rider | null) => void;
  settlePayAmount: string;
  setSettlePayAmount: (val: string) => void;
  handleSettleEarnings: () => Promise<any>;
  getRiderMetrics: (rider: Rider) => { liveEarnings: number };
  fullDaySelectActive: boolean;
  setFullDaySelectActive: (active: boolean) => void;
  activeLedgerRider: Rider | null;
  setActiveLedgerRider: (rider: Rider | null) => void;
  getLast7Days: () => Array<{ dayName: string; dateLabel: string; label: string; dateKey: string }>;
  getSelectedDayForRider: (riderId: string) => { dayName: string; dateLabel: string; label: string; dateKey: string };
  setSelectedDayPerRider: React.Dispatch<React.SetStateAction<Record<string, { dayName: string; dateLabel: string; label: string; dateKey: string }>>>;
  isMounted: boolean;
}

export default function RiderSettlementModals({
  showSettleModal,
  setShowSettleModal,
  settlePayAmount,
  setSettlePayAmount,
  handleSettleEarnings,
  getRiderMetrics,
  fullDaySelectActive,
  setFullDaySelectActive,
  activeLedgerRider,
  setActiveLedgerRider,
  getLast7Days,
  getSelectedDayForRider,
  setSelectedDayPerRider,
  isMounted,
}: RiderSettlementModalsProps) {
  if (!isMounted) return null;

  return (
    <>
      {/* MODAL 3: Settlement modal */}
      {showSettleModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans text-slate-800">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden text-left"
            >
              <div className="p-5.5 bg-indigo-950 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Record Settlement</h3>
                  <p className="text-[8px] text-indigo-250 font-bold uppercase tracking-widest">Pay settlement balance</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettleModal(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer border-0"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5.5 space-y-4">
                <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-100">
                  <p className="text-[8px] font-black uppercase text-indigo-400 tracking-wider">Calculated Earnings</p>
                  <p className="text-lg font-black text-indigo-950 font-mono mt-1">₹{getRiderMetrics(showSettleModal).liveEarnings}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">Settle amount (₹)</label>
                  <input
                    autoFocus
                    type="number"
                    placeholder="Enter settled amount"
                    value={settlePayAmount}
                    onChange={(e) => setSettlePayAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSettleEarnings}
                  className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-[1.01] transition-all border-0 cursor-pointer"
                >
                  Save Settlement Ledger
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* MODAL 4: Full Screen Settlement Day Picker */}
      {fullDaySelectActive && activeLedgerRider && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[140] flex flex-col bg-slate-900/60 backdrop-blur-sm font-sans text-slate-800">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 210 }}
              className="bg-white flex-1 mt-14 rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden text-left"
            >
              {/* Day Selection Header */}
              <div className="px-5 py-4 border-b border-rose-100 flex items-center justify-between shrink-0 bg-rose-50/10">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFullDaySelectActive(false);
                      setActiveLedgerRider(null);
                    }}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer border-0"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h3 className="text-xs font-black uppercase text-rose-900 tracking-wider">
                      Select Settlement Day
                    </h3>
                    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                      Rider: {activeLedgerRider.name}
                    </p>
                  </div>
                </div>

                <span className="text-[8px] font-black bg-rose-100 border border-rose-205 px-2.5 py-1 rounded-full text-rose-800 uppercase tracking-wider font-mono">
                  ACTIVE SCHEDULE
                </span>
              </div>

              {/* Elegant dynamic full screen list of days */}
              <div className="p-5 flex-1 space-y-4 overflow-y-auto pb-24 bg-slate-50/50">
                <div className="px-1 shrink-0">
                  <h4 className="text-[10px] font-black text-rose-950 uppercase tracking-widest">
                    Available Settlement Days
                  </h4>
                  <p className="text-[8.5px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">
                    Select a day name below to instantly transition back.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {getLast7Days().map((day) => {
                    const dayStatus = activeLedgerRider.dailySettlements?.[day.dateKey] || 'UNPAID';
                    const isSelected = getSelectedDayForRider(activeLedgerRider.id).dateKey === day.dateKey;

                    return (
                      <div
                        key={day.dateKey}
                        onClick={() => {
                          setSelectedDayPerRider(prev => ({
                            ...prev,
                            [activeLedgerRider.id]: day
                          }));
                          setFullDaySelectActive(false);
                          toast.success(`Selected ${day.dayName} for settlement! 📅`);
                        }}
                        className={`py-1.5 px-3.5 rounded-[1.1rem] border transition-all duration-300 cursor-pointer flex items-center justify-between group active:scale-[0.98] ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/10 shadow-md ring-1.5 ring-orange-500/25'
                            : 'border-slate-100 bg-white hover:border-orange-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm group-hover:scale-105 transition duration-300">📅</span>
                          <div className="text-left animate-in fade-in duration-300">
                            <p className="text-[11.5px] font-black text-slate-850 tracking-tight leading-normal group-hover:text-orange-600 transition duration-200">
                              {day.dayName}
                            </p>
                            <p className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wide leading-none mt-0.5">
                              {day.dateLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          {dayStatus === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 text-[7.5px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md border border-emerald-450 hover:scale-105 transition-all shadow-[0_0_9px_rgba(16,185,129,0.7)] uppercase tracking-wider select-none">
                              PAID ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[7.5px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-md border border-rose-450 hover:scale-105 transition-all shadow-[0_0_9px_rgba(244,63,94,0.7)] uppercase tracking-wider select-none">
                              UNPAID
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
