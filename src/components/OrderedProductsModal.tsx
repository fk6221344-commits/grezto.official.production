import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X } from 'lucide-react';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';

interface OrderedProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: any[];
  totalAmount: number;
  deliveryCharge?: number;
}

export default function OrderedProductsModal({ isOpen, onClose, items, totalAmount, deliveryCharge }: OrderedProductsModalProps) {
  // Catch native back button to close the Ordered Products modal/dialog cleanly
  useRegisterBackHandler(() => {
    if (isOpen) {
      onClose();
      return true;
    }
    return false;
  }, 40, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-[101] shadow-2xl"
          >
            <div className="bg-slate-900 text-white rounded-t-[1.5rem] p-5 flex items-center justify-between shadow-sm border-b-2 border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-400" />
                <h3 className="text-[12px] font-black tracking-widest uppercase mt-0.5">Ordered Package Items</h3>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl transition-all cursor-pointer border-none text-slate-300"
              >
                <X size={16} />
              </button>
            </div>
            <div className="bg-white rounded-b-[1.5rem] p-5 pt-6 shadow-sm overflow-hidden">
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pb-4" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                <style>{`
                  .no-scrollbar::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div className="no-scrollbar space-y-3">
                  {(() => {
                    let parsedItems = items;
                    if (typeof parsedItems === 'string') {
                      try { parsedItems = JSON.parse(parsedItems); } catch(e) { parsedItems = []; }
                    }
                    if (!Array.isArray(parsedItems)) parsedItems = [];
                    
                    return parsedItems.length > 0 ? (
                      parsedItems.map((item, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-2xl p-4 flex justify-between items-center bg-white shadow-xs">
                          <div>
                            <p className="text-[14px] font-black text-slate-950 leading-tight">
                              {typeof item === 'object' ? item.name : item}
                            </p>
                            <div className="mt-2.5">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                {typeof item === 'object' ? `${item.quantity || 1} ${item.unit || 'UNIT'}` : 1}
                              </span>
                            </div>
                          </div>
                          <div className="text-[14px] font-black text-slate-950">
                            ₹{typeof item === 'object' ? ((item.price || 0) * (item.quantity || 1)) : 0}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-[11px] font-bold text-slate-400 py-4 uppercase tracking-wider">No items found.</p>
                    );
                  })()}
                </div>
              <div className="pt-2 mt-2">
                {deliveryCharge !== undefined && deliveryCharge > 0 && (
                  <div className="flex justify-between items-center px-1 mb-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Delivery Charge</span>
                    <span className="text-[14px] font-black text-slate-700">₹{deliveryCharge}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 pt-3 px-1 mt-1">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Total Bill:</span>
                  <span className="text-[16px] font-black text-slate-900 drop-shadow-sm">₹{totalAmount}</span>
                </div>
              </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
