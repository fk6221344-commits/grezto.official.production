import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  type: 'delete' | 'block' | '';
  shopName: string;
  shopId: string;
  shopObj: any;
  currentStep: number;
  setConfirmModal: React.Dispatch<React.SetStateAction<any>>;
  handleDeleteShop: (shopId: string) => Promise<any> | any;
  handleToggleBlockShop: (shop: any) => Promise<any> | any;
}

export default function ConfirmationModal({
  isOpen,
  type,
  shopName,
  shopId,
  shopObj,
  currentStep,
  setConfirmModal,
  handleDeleteShop,
  handleToggleBlockShop
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-5">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal((prev: any) => ({ ...prev, isOpen: false, currentStep: 1 }))}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div 
            initial={{ y: '100%', scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-10 relative z-[251] text-center shadow-2xl border border-red-50 font-sans"
          >
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-rose-600 shadow-inner">
              <AlertTriangle size={22} className="animate-pulse" />
            </div>

            <h3 className="text-sm font-black text-gray-905 tracking-tight uppercase">
              {type === 'delete' ? "Delete Partner Shop 🚫" : "Block Partner Shop 🔒"}
            </h3>
            
            <p className="text-[10px] text-gray-400 font-extrabold uppercase mt-1.5 tracking-wider leading-relaxed">
              Target: <span className="text-rose-600 font-black">{shopName}</span>
            </p>

            {/* Progress visual steps */}
            <div className="flex justify-center space-x-2 my-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-col items-center space-y-1">
                  <div 
                    className={`w-14 h-2 rounded-full transition-all duration-300 ${
                      currentStep >= step 
                        ? 'bg-rose-600 shadow-sm shadow-rose-200' 
                        : 'bg-gray-100'
                    }`}
                  />
                  <span className="text-[8px] font-black tracking-widest text-gray-450">STEP {step}</span>
                </div>
              ))}
            </div>

            {/* Warnings based on validation steps */}
            <div className="bg-rose-50/50 rounded-2xl p-4 mb-6 border border-rose-100/30 min-h-[70px] flex items-center justify-center text-left">
              <p className="text-[11.5px] font-black text-rose-800 uppercase tracking-wide leading-normal">
                {currentStep === 1 && "Confirm 1/3: Are you absolutely sure you want to proceed with this critical action?"}
                {currentStep === 2 && "Confirm 2/3: Warning! Performing this action might impact active products, associated menus, and merchant access."}
                {currentStep === 3 && "Confirm 3/3: Final clearance. Click the Authorize button to execute permanently."}
              </p>
            </div>

            <div className="flex space-x-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal((prev: any) => ({ ...prev, isOpen: false, currentStep: 1 }))}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (currentStep < 3) {
                    setConfirmModal((prev: any) => ({ ...prev, currentStep: prev.currentStep + 1 }));
                  } else {
                    setConfirmModal((prev: any) => ({ ...prev, isOpen: false, currentStep: 1 }));
                    if (type === 'delete') {
                      await handleDeleteShop(shopId);
                    } else {
                      await handleToggleBlockShop(shopObj);
                    }
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 shadow-md transition-all cursor-pointer shadow-rose-100"
              >
                {currentStep < 3 ? "Next Step" : "Authorize Action ✔️"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
