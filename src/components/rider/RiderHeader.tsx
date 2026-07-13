import React from 'react';
import { Bike, ArrowLeft, Info, History } from 'lucide-react';
import { motion } from 'motion/react';

interface RiderHeaderProps {
  onClose?: () => void;
  riderProfile: any;
  user: any;
  updatingDuty: boolean;
  showRiderInfoMenu: boolean;
  setShowRiderInfoMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  setLearningState: (state: 'idle' | 'loading' | 'success') => void;
  setShowRiderHistoryModal: (val: boolean) => void;
  handleToggleDuty: () => void;
  calculatedEarnings: number;
  totalCompletedJobs: number;
  currentCodBalance: number;
  remainingDeliveryCharges?: number;
  totalDeliveryCharges?: number;
}

export const RiderHeader: React.FC<RiderHeaderProps> = ({
  onClose,
  riderProfile,
  user,
  updatingDuty,
  showRiderInfoMenu,
  setShowRiderInfoMenu,
  setLearningState,
  setShowRiderHistoryModal,
  handleToggleDuty,
  calculatedEarnings,
  totalCompletedJobs,
  currentCodBalance,
  remainingDeliveryCharges = 0,
  totalDeliveryCharges = 0
}) => {
  return (
    <header className="bg-white px-5 pt-[max(env(safe-area-inset-top),32px)] pb-5 border-b border-slate-150/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-xl mx-auto space-y-4">
        
        <div className="flex justify-between items-center">
          {/* Left Profile Info with Back Arrow */}
          <div className="flex items-center gap-2.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1.5 text-slate-650 hover:text-black rounded-lg hover:bg-slate-100 transition duration-150 cursor-pointer flex items-center justify-center border-0 bg-transparent active:scale-90"
                title="Go Back"
              >
                <ArrowLeft size={19} strokeWidth={2.7} />
              </button>
            )}
            <div className="w-10 h-10 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center shadow-xs relative">
              <Bike size={18} className="text-slate-950 stroke-[2.5]" />
              {riderProfile?.status === 'Online' && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
              )}
              {riderProfile?.status === 'Online' && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="text-left">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">RIDER PORTAL</p>
              <h1 className="text-[13px] font-black text-slate-900 tracking-tight mt-1 leading-none">{user.name || 'Grezto Rider'}</h1>
            </div>
          </div>

          {/* Right-side status and Info Trigger dropdown */}
          <div className="flex items-center space-x-1">
            {riderProfile?.status === 'Online' ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-[8.5px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Active
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200 text-[8.5px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                Offline
              </div>
            )}

            {/* Discreet Info (i) button matching AdminPanel style */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRiderInfoMenu(prev => !prev)}
                className={`p-2 rounded-full active:scale-[0.93] transition-all cursor-pointer border-none flex items-center justify-center focus:outline-none ${
                  showRiderInfoMenu
                    ? "bg-amber-100/70 text-amber-700" 
                    : "bg-transparent text-slate-500 hover:bg-slate-100/60"
                }`}
                title="Info Menu"
              >
                <Info className="w-5 h-5 stroke-[2.2]" />
              </button>

              {/* Popover */}
              {showRiderInfoMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowRiderInfoMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    className="absolute right-0 mt-1 w-24 bg-white border border-slate-200/50 rounded-xl shadow-lg z-50 overflow-hidden font-sans border-solid"
                  >
                    <div className="p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLearningState('idle');
                          setShowRiderHistoryModal(true);
                          setShowRiderInfoMenu(false);
                        }}
                        className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-all cursor-pointer border-none focus:outline-none"
                      >
                        <History className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>History</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Grid - Earning / Balance Ledger */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {/* Stat 1: Duty Toggle with Switch Button (Premium Forest Green when Online) */}
          <button
            onClick={handleToggleDuty}
            disabled={updatingDuty}
            className={`p-2 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 active:scale-[0.96] cursor-pointer relative overflow-hidden min-h-[74px] py-2 ${
              riderProfile?.status === 'Online'
                ? 'bg-[#0f5132] text-white border-[#0a3622] shadow-md shadow-[#0f5132]/20'
                : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className={`text-[7px] font-black uppercase tracking-widest ${
                riderProfile?.status === 'Online' ? 'text-[#86b7fe]' : 'text-slate-400'
              }`}>Duty</span>
              {/* Visual Switch Control */}
              <div 
                className={`w-6 h-3.5 rounded-full transition-all duration-300 relative shrink-0 ${
                  riderProfile?.status === 'Online' ? 'bg-[#198754]' : 'bg-slate-300'
                }`}
              >
                <div 
                  className={`absolute top-[1.5px] w-2.5 h-2.5 rounded-full bg-white transition-all duration-300 shadow-sm ${
                    riderProfile?.status === 'Online' ? 'left-[12px]' : 'left-[1.5px]'
                  }`} 
                />
              </div>
            </div>
            <div className="mt-2">
              <p className={`text-[12px] font-black leading-none transition-colors duration-200 metric-box-text ${
                riderProfile?.status === 'Online' ? 'text-white' : 'text-slate-700'
              }`}>
                {updatingDuty ? '...' : riderProfile?.status === 'Online' ? 'Online' : 'Offline'}
              </p>
              <p className={`text-[5px] font-bold uppercase tracking-widest mt-1.5 leading-none ${
                riderProfile?.status === 'Online' ? 'text-[#86b7fe]' : 'text-slate-400'
              }`}>
                Tap to Toggle
              </p>
            </div>
          </button>

          {/* Stat 2: Delivery Charge Card (Vivid Royal Blue, Extremely High Sunlight Contrast) */}
          <div className="bg-[#0d6efd] border border-[#0a58ca] p-2 rounded-2xl text-left flex flex-col justify-between shadow-md shadow-[#0d6efd]/20 relative overflow-hidden min-h-[74px] py-2">
            <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-white/10 rounded-full blur-md" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[6px] font-black uppercase tracking-widest text-[#cfe2ff] leading-none">Del. Charge</span>
              <span className="text-[11px] animate-bounce" style={{ animationDuration: '2s' }}>🛵</span>
            </div>
            <div className="mt-2 relative z-10">
              <p className="text-[14px] font-black text-white leading-none font-mono tracking-tight drop-shadow-md metric-box-text">
                ₹{remainingDeliveryCharges}
              </p>
              <p className="text-[5px] font-black text-[#0a58ca] bg-[#cfe2ff] px-1.5 py-0.5 rounded uppercase tracking-wider mt-1.5 leading-none w-fit shadow-sm">
                ₹{totalDeliveryCharges} Total
              </p>
            </div>
          </div>

          {/* Stat 3: Held Cash (COD - Rich Warm Dark Golden & High Contrast Style) */}
          <div className="bg-[#663300] border border-[#4d2600] p-2 rounded-2xl text-left flex flex-col justify-between shadow-md shadow-[#663300]/20 min-h-[74px] py-2">
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-black uppercase tracking-widest text-[#ffcc00] leading-none">Total Cash</span>
              <span className="text-[11px]">💼</span>
            </div>
            <div className="mt-2">
              <p className="text-[14px] font-black text-white leading-none font-mono drop-shadow-sm select-all metric-box-text">
                ₹{currentCodBalance.toFixed(0)}
              </p>
              <p className="text-[5px] font-black text-[#ffcc00] uppercase tracking-widest mt-1.5 leading-none">
                Collected
              </p>
            </div>
          </div>

          {/* Stat 4: Earning Card (Purple/Indigo style) */}
          <div className="bg-[#6610f2] border border-[#520dc2] p-2 rounded-2xl text-left flex flex-col justify-between shadow-md shadow-[#6610f2]/20 relative overflow-hidden min-h-[74px] py-2">
            <div className="absolute -left-2 -bottom-2 w-12 h-12 bg-white/10 rounded-full blur-md" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[7px] font-black uppercase tracking-widest text-[#e0cffc] leading-none">Earning</span>
              <span className="text-[11px]">💰</span>
            </div>
            <div className="mt-2 relative z-10">
              <p className="text-[14px] font-black text-white leading-none font-mono drop-shadow-sm select-all metric-box-text">
                ₹{calculatedEarnings}
              </p>
              <p className="text-[5px] font-black text-[#520dc2] bg-[#e0cffc] px-1.5 py-0.5 rounded uppercase tracking-wider mt-1.5 leading-none w-fit shadow-sm">
                {totalCompletedJobs} Delivered
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
