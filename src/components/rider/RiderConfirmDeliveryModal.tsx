import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RiderConfirmDeliveryModalProps {
  orderToConfirm: any | null;
  setOrderToConfirm: (order: any | null) => void;
  isSubmittingDelivery: boolean;
  enteredOtp: string;
  setEnteredOtp: (val: string) => void;
  otpError: boolean;
  setOtpError: (val: boolean) => void;
  handleDeliverOrder: () => void;
  riderProfile: any;
}

export const RiderConfirmDeliveryModal: React.FC<RiderConfirmDeliveryModalProps> = ({
  orderToConfirm,
  setOrderToConfirm,
  isSubmittingDelivery,
  enteredOtp,
  setEnteredOtp,
  otpError,
  setOtpError,
  handleDeliverOrder,
  riderProfile
}) => {
  return (
    <AnimatePresence>
      {orderToConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-white rounded-[2rem] border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden text-left"
          >
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                ✓ Confirm Delivery
              </h3>
              <button 
                onClick={() => setOrderToConfirm(null)}
                disabled={isSubmittingDelivery}
                className="p-1 bg-white/10 hover:bg-white/20 text-white rounded-lg border-0 cursor-pointer disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5.5 space-y-4 text-slate-800">
              <p className="text-[11px] font-bold leading-relaxed">
                Confirm that you have successfully delivered order <span className="font-extrabold text-slate-950">#{orderToConfirm.id?.slice(-5).toUpperCase()}</span> to customer <span className="font-extrabold text-slate-950">{orderToConfirm.customerName}</span>.
              </p>

              {/* COD Warning Box */}
              <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl flex items-start gap-2.5 text-emerald-950">
                <span className="text-sm">💰</span>
                <div>
                  <p className="text-[8.5px] font-black uppercase tracking-wider text-emerald-600">COD CASH COLLECTION</p>
                  <p className="text-[12px] font-black font-mono leading-none mt-1">₹{orderToConfirm.totalAmount || orderToConfirm.amount} Cash</p>
                  <p className="text-[8px] font-medium text-emerald-700 line-clamp-1 mt-1">
                    Please collect cash from the customer!
                  </p>
                </div>
              </div>

              {/* OTP Verification Input Form Box */}
              <div className="pt-3 border-t border-slate-100 flex flex-col items-center space-y-2 text-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">ENTER CUSTOMER SECURE OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  value={enteredOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setEnteredOtp(val);
                    setOtpError(false);
                  }}
                  placeholder="••••••"
                  className={`w-full max-w-[150px] bg-slate-50 border text-center text-xl font-mono font-black py-2.5 rounded-2xl tracking-widest outline-none transition-all duration-150 focus:ring-4 focus:ring-slate-905/10 focus:border-slate-800 ${
                    otpError ? 'border-red-500 bg-red-50 text-red-700 animate-pulse' : 'border-slate-200 text-slate-900'
                  }`}
                />
                {otpError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-[9px] text-red-650 font-black uppercase mt-1 leading-none tracking-wide"
                  >
                    ❌ GALAT OTP! SAHI OTP DAALEIN
                  </motion.p>
                )}
                <p className="text-[8.5px] text-slate-400 font-medium italic mt-1 leading-tight">
                  (Tip: The OTP is visible on the Customer's mobile screen on the Tracking Page)
                </p>
              </div>
            </div>

            {/* Confirm Bottom Buttons */}
            <div className="p-5 bg-slate-50 border-t border-slate-150 flex gap-2.5">
              <button
                type="button"
                onClick={() => setOrderToConfirm(null)}
                disabled={isSubmittingDelivery}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-900 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeliverOrder}
                disabled={isSubmittingDelivery || riderProfile?.status !== 'Online'}
                className="flex-[1.5] bg-slate-900 hover:bg-black text-white border-0 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition active:scale-97 disabled:opacity-40 flex items-center justify-center gap-1"
              >
                {isSubmittingDelivery ? 'Submitting...' : 'DELIVERED ✓'}
              </button>
            </div>

            {riderProfile?.status !== 'Online' && (
              <div className="bg-rose-50 text-rose-800 text-[8px] font-black uppercase tracking-wider p-2 text-center border-t border-rose-100">
                ⚠️ You must be on Active Duty (ONLINE) to complete this!
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
