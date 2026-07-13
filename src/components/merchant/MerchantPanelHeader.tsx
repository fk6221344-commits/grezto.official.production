import React from 'react';
import { ChevronLeft, Info, History } from 'lucide-react';
import { motion } from 'motion/react';

interface MerchantPanelHeaderProps {
  onClose: () => void;
  shopName: string;
  showMerchantInfoMenu: boolean;
  setShowMerchantInfoMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  setShowMerchantHistoryModal: (val: boolean) => void;
}

export const MerchantPanelHeader: React.FC<MerchantPanelHeaderProps> = ({
  onClose, shopName,
  showMerchantInfoMenu, setShowMerchantInfoMenu, setShowMerchantHistoryModal
}) => {
  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 pt-[max(env(safe-area-inset-top),32px)] pb-4 flex items-center justify-between z-40 shadow-xs">
        <div className="flex items-center space-x-3.5 min-w-0">
          <button 
            onClick={onClose}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border-0 rounded-xl transition-all text-slate-500 cursor-pointer"
          >
            <ChevronLeft size={20} className="stroke-[2.5]" />
          </button>
          <div className="min-w-0">
            <span className="text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md tracking-widest border border-emerald-100 leading-none block w-fit mb-1">
              🏪 RESTAURANT / MERCHANT ADMIN
            </span>
            <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none truncate">{shopName}</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Info Option Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMerchantInfoMenu(prev => !prev)}
              className={`p-2.5 rounded-xl active:scale-[0.93] transition-all cursor-pointer border-none flex items-center justify-center focus:outline-none ${
                showMerchantInfoMenu
                  ? "bg-slate-100 text-slate-900" 
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
              title="Info Menu"
            >
              <Info className="w-5 h-5 stroke-[2.2]" />
            </button>

            {showMerchantInfoMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowMerchantInfoMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-2.5 space-y-1.5"
                >
                  <p className="text-[8.5px] font-black uppercase text-slate-400 px-2.5 tracking-wider mb-1">Options</p>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowMerchantHistoryModal(true);
                      setShowMerchantInfoMenu(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-left rounded-xl transition hover:bg-slate-50 active:bg-slate-100 cursor-pointer text-slate-700 border-none bg-transparent"
                  >
                    <History className="w-4 h-4 text-slate-500 stroke-[2.2]" />
                    <span className="text-[10px] font-black uppercase tracking-wider">History</span>
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>
  );
};
