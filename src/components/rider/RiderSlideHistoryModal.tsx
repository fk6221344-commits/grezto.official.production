import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, ChevronRight } from 'lucide-react';

interface RiderSlideHistoryModalProps {
  showRiderHistoryModal: boolean;
  setShowRiderHistoryModal: (show: boolean) => void;
  setLearningState: (state: any) => void;
  historyOrders: any[];
  fetchRiderHistory: (isInitial: boolean) => void;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
}

export default function RiderSlideHistoryModal({
  showRiderHistoryModal,
  setShowRiderHistoryModal,
  setLearningState,
  historyOrders,
  fetchRiderHistory,
  isLoadingHistory,
  hasMoreHistory,
}: RiderSlideHistoryModalProps) {
  return (
    <AnimatePresence>
      {showRiderHistoryModal && (
        <div className="fixed inset-0 z-[9998] bg-slate-50 flex flex-col h-full w-full overflow-hidden">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="bg-slate-50 w-full h-full flex flex-col overflow-hidden text-left font-sans"
          >
            {/* Header */}
            <div className="px-5 pt-11 pb-5 bg-gradient-to-r from-slate-900 to-slate-850 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                  <History className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Delivery History</h3>
                  <p className="text-[8px] font-black uppercase text-amber-300 tracking-widest leading-none mt-1">LATEST 5 COMPLETED JOBS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRiderHistoryModal(false);
                  setLearningState('idle');
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer transition active:scale-90 focus:outline-none"
              >
                <X size={16} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar bg-slate-50/50 pb-28">
              {historyOrders.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400">
                  <span className="text-2xl mb-2">{isLoadingHistory ? "..." : "📦"}</span>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700">
                    {isLoadingHistory ? "Loading History..." : "No delivered history yet"}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 mt-1 max-w-[200px]">
                    {isLoadingHistory ? "Please wait..." : "Complete your first order to unlock active history."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-w-md mx-auto">
                    {historyOrders.map((order: any) => {
                      const orderItems = order.items || order.fullItems || [];
                      const itemsCount = orderItems.length > 0 
                        ? orderItems.length 
                        : 1;
                      return (
                        <div 
                          key={order.id} 
                          className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2 text-left hover:border-slate-350 transition shadow-xs"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[7.5px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-250">
                                  #{order.id?.slice(-5).toUpperCase() || 'ORDER'}
                                </span>
                                <span className="text-[7.5px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                                  Delivered
                                </span>
                              </div>
                              <h4 className="text-[11px] font-extrabold text-slate-800">{order.customerName || 'Loyal Customer'}</h4>
                            </div>
                            <div className="text-right">
                              <span className="block text-[7px] font-black text-slate-400 uppercase">Cash Collected</span>
                              <span className="text-[11px] font-black text-emerald-700 font-mono">₹{order.finalAmount || (Number(order.totalAmount || order.amount || 0) + Number(order.deliveryCharge || 0))}</span>
                            </div>
                          </div>
                          <div className="text-[8px] font-bold text-slate-400 flex justify-between pt-1 border-t border-slate-100/60">
                            <span>Items: {itemsCount} units</span>
                            <span>Time: {order.createdAt ? new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleDateString([], {day: 'numeric', month: 'short'}) : 'Continuous'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {hasMoreHistory && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pt-2 pb-6 flex justify-end pr-2 max-w-md mx-auto"
                    >
                      <button
                        disabled={isLoadingHistory}
                        onClick={() => fetchRiderHistory(false)}
                        className="px-3 py-1.5 text-amber-600 hover:text-amber-700 bg-amber-50/40 hover:bg-amber-50 border border-amber-100/60 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        {isLoadingHistory ? (
                          <>
                            <span className="w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                            <span className="text-[8px]">Loading...</span>
                          </>
                        ) : (
                          <>
                            <span>Load More</span>
                            <ChevronRight size={11} className="stroke-[3]" />
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
