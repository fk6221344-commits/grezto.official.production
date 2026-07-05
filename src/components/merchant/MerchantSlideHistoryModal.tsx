import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, ChevronRight } from 'lucide-react';
import { MerchantOrderCard } from '../MerchantOrderCard';

interface MerchantSlideHistoryModalProps {
  showMerchantHistoryModal: boolean;
  setShowMerchantHistoryModal: (show: boolean) => void;
  shop: any;
  riders: any[];
  handleUpdateStatus: (orderId: string, status: string) => void;
  mapsAuthError: boolean;
  busyRiders: Set<string> | string[];
  historyOrders: any[];
}

export default function MerchantSlideHistoryModal({
  showMerchantHistoryModal,
  setShowMerchantHistoryModal,
  shop,
  riders,
  handleUpdateStatus,
  mapsAuthError,
  busyRiders,
  historyOrders,
}: MerchantSlideHistoryModalProps) {

  return (
    <AnimatePresence>
      {showMerchantHistoryModal && (
        <div className="fixed inset-0 z-[9998] bg-slate-50 flex flex-col h-full w-full overflow-hidden">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="bg-slate-50 w-full h-full flex flex-col overflow-hidden text-left font-sans"
          >
            {/* Header */}
            <div className="px-5 pt-11 pb-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <History className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Store Order History</h3>
                  <p className="text-[8px] font-black uppercase text-emerald-300 tracking-widest leading-none mt-1">LATEST DELIVERED ORDERS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMerchantHistoryModal(false);
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
                  <span className="text-2xl mb-2">{"📦"}</span>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700">
                    {"No delivered history yet"}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 mt-1 max-w-[200px]">
                    {"Orders delivered successfully at your venue will show up here."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 max-w-sm mx-auto">
                    {historyOrders.map((order: any) => (
                      <MerchantOrderCard 
                        key={order.id}
                        order={order}
                        shop={shop}
                        riders={riders}
                        handleUpdateStatus={handleUpdateStatus}
                        mapsAuthError={mapsAuthError}
                        busyRiders={Array.isArray(busyRiders) ? busyRiders : []}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
