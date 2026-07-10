import React from 'react';
import { motion } from 'motion/react';
import { Bike, Eye, MoreVertical, Phone, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { Rider } from './hooks/useRiderOperations';

interface RiderProfileCardProps {
  rider: Rider;
  metrics: {
    deliveredCount: number;
    liveEarnings: number;
    totalInvoicedAmount: number;
    totalGeneratedCod: number;
    liveCodBalance: number;
    totalDeliveryCharges: number;
    remainingDeliveryCharges: number;
  };
  isSelectedMenu: boolean;
  setOpenMenuRiderId: (id: string | null) => void;
  setSelectedRiderForOrders: (rider: Rider) => void;
  handleCleanRiderConsole: (rider: Rider) => void;
  handleUnregisterRider: (rider: Rider) => void;
  handleDeleteRiderTwoStep: (rider: Rider) => void;
  getSelectedDayForRider: (riderId: string) => { dayName: string; dateLabel: string; label: string; dateKey: string };
  setActiveLedgerRider: (rider: Rider) => void;
  setFullDaySelectActive: (active: boolean) => void;
  setShowCollectModal: (rider: Rider) => void;
  setCollectAmount: (amt: string) => void;
  setCollectSubMode: (mode: 'PAID' | 'UNPAID' | null) => void;
}

export default function RiderProfileCard({
  rider,
  metrics,
  isSelectedMenu,
  setOpenMenuRiderId,
  setSelectedRiderForOrders,
  handleCleanRiderConsole,
  handleUnregisterRider,
  handleDeleteRiderTwoStep,
  getSelectedDayForRider,
  setActiveLedgerRider,
  setFullDaySelectActive,
  setShowCollectModal,
  setCollectAmount,
  setCollectSubMode
}: RiderProfileCardProps) {
  const isSuspended = !!rider.unregistered;

  return (
    <motion.div 
      layout
      style={{ zIndex: isSelectedMenu ? 40 : 1 }}
      className={`p-4 py-4.5 rounded-[2.2rem] border relative overflow-visible transition-all duration-300 ${
        isSuspended 
          ? 'bg-slate-50/70 border-slate-200/60 opacity-80 shadow-none' 
          : 'bg-white border-slate-150 shadow-xs hover:shadow-md'
      }`}
    >
      {/* Decorative faint bike icon in card background */}
      <div className="absolute right-3 top-3 opacity-[0.02] text-rose-950 pointer-events-none scale-[2.2]">
        <Bike size={48} />
      </div>

      {/* Profile section with name & three-dot menu trigger */}
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-2.5">
          {/* Left icon box: visual bike / scooter representation - super cute & small */}
          <div className="w-9 h-9 bg-rose-50 border border-rose-100/70 rounded-full flex items-center justify-center shadow-xs flex-shrink-0">
            {rider.vehicle === 'Electric Scooter' ? (
              <span className="text-sm">🛵</span>
            ) : (
              <span className="text-sm">🏍️</span>
            )}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[11.5px] font-black uppercase text-slate-800 tracking-tight leading-none">
                {rider.name}
              </h3>
              {isSuspended ? (
                <span className="text-[6.5px] font-extrabold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-100">
                  Suspended
                </span>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${rider.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              )}
            </div>
            <p className="text-[8.5px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">
              +91 {rider.phone} • {rider.vehicle || 'Rider'}
            </p>
          </div>
        </div>

        {/* Three-dot vertical context menu with View Orders Eye button */}
        <div className="flex items-center gap-1.5 relative">
          <button 
            type="button"
            onClick={() => setSelectedRiderForOrders(rider)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl transition-all border border-slate-200/60 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-[0.95] duration-200"
            title="View Delivered Orders"
          >
            <Eye size={13.5} className="stroke-[2.5]" />
          </button>

          <button 
            type="button"
            onClick={() => setOpenMenuRiderId(isSelectedMenu ? null : rider.id)}
            className="p-1.5 px-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition-all border-0 cursor-pointer"
            title="More actions"
          >
            <MoreVertical size={15} />
          </button>

          {isSelectedMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpenMenuRiderId(null)} />
              <div className="absolute right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-150 p-1.5 min-w-[155px] z-40 space-y-0.5 text-left text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150">
                
                {/* Option 2: Call partner */}
                <a 
                  href={`tel:${rider.phone}`}
                  onClick={() => setOpenMenuRiderId(null)}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors no-underline text-slate-700 font-bold"
                >
                  <Phone size={13} className="text-emerald-500 shrink-0" />
                  <span>Call Partner</span>
                </a>

                {/* Option 2.5: Clean Console & Reset Cash */}
                <button
                  type="button"
                  onClick={() => handleCleanRiderConsole(rider)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-sky-50 text-sky-750 hover:text-sky-850 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                >
                  <RefreshCw size={13} className="text-sky-500 shrink-0" />
                  <span>Clean Console</span>
                </button>

                {/* Separation line */}
                <div className="border-t border-slate-100 my-1"></div>

                {/* Option 3: Suspend/Unregister */}
                <button
                  type="button"
                  onClick={() => handleUnregisterRider(rider)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50 text-amber-750 hover:text-amber-800 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                >
                  <AlertCircle size={13} className="text-amber-500 shrink-0" />
                  <span>Suspend Rider</span>
                </button>

                {/* Option 4: Delete */}
                <button
                  type="button"
                  onClick={() => handleDeleteRiderTwoStep(rider)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 text-rose-650 hover:text-rose-700 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                >
                  <Trash2 size={13} className="text-rose-600 shrink-0" />
                  <span>Delete Profile</span>
                </button>

              </div>
            </>
          )}
        </div>
      </div>

      {/* Cute rows detail section replacing the big boxes */}
      <div className="mt-3.5 bg-slate-50/70 px-4 py-3 rounded-2xl border border-slate-100 text-left space-y-2.5">
        {/* Row 1: COD */}
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
            <span>Total Money (Holding Cash)</span>
            <span>💰</span>
          </div>
          <div className="text-slate-850 font-black font-mono text-[11px] flex items-center gap-1.5">
            <span className="text-emerald-700 animate-pulse font-black">₹{metrics.liveCodBalance}</span>
            <span className="text-[6px] text-slate-400 font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 uppercase tracking-widest scale-90">Auto</span>
          </div>
        </div>

        {/* Cute dotted separation line */}
        <div className="border-t border-dashed border-slate-200 my-0.5"></div>

        {/* Row 1.5: Delivery Charge */}
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
            <span>Delivery Charge</span>
            <span>🛵</span>
          </div>
          <div className="text-right">
            <div className="text-amber-650 font-black font-mono text-[11px]">
              ₹{metrics.remainingDeliveryCharges || 0}
            </div>
            <p className="text-[6.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 leading-none">
              ₹{metrics.totalDeliveryCharges || 0} Total Collected
            </p>
          </div>
        </div>

        {/* Cute dotted separation line */}
        <div className="border-t border-dashed border-slate-200 my-0.5"></div>

        {/* Row 2: Rider Earning */}
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
            <span>Rider Earning</span>
            <span>💵</span>
          </div>
          <div className="text-right">
            <div className="text-indigo-650 font-black font-mono text-[11px]">
              ₹{metrics.liveEarnings}
            </div>
            <p className="text-[6.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 leading-none">
              {metrics.deliveredCount} Delivered • {rider.lastSettledDate ? `Last: ${rider.lastSettledDate}` : 'No settler'}
            </p>
          </div>
        </div>

        {/* Cute dotted separation line */}
        <div className="border-t border-dashed border-slate-200 my-0.5"></div>

        {/* Row 3: Current Selected Day Action */}
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
            <span>Selected Day</span>
            <span>🗓️</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-rose-850 uppercase tracking-tight">
              {getSelectedDayForRider(rider.id).dayName}
            </span>
            <span className={`ml-1.5 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider select-none transition-all duration-300 ${
              (rider.dailySettlements?.[getSelectedDayForRider(rider.id).dateKey] || 'UNPAID') === 'PAID'
                ? 'bg-emerald-500 text-white border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                : 'bg-rose-500 text-white border border-rose-450 shadow-[0_0_10px_rgba(244,63,94,0.7)]'
            }`}>
              {(rider.dailySettlements?.[getSelectedDayForRider(rider.id).dateKey] || 'UNPAID') === 'PAID' ? 'PAID ✓' : 'UNPAID'}
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Action buttons: Settlement & Collect cash */}
      <div className="mt-3.5 grid grid-cols-2 gap-3 pb-0.5">
        {/* Left button: Settlement */}
        <button 
          type="button"
          onClick={() => {
            setActiveLedgerRider(rider);
            setFullDaySelectActive(true);
          }}
          className="bg-slate-100 hover:bg-slate-150 text-slate-800 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200/50 cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-1 shadow-2xs"
        >
          🤝 Settlement
        </button>

        {/* Right button: Collect Cash */}
        <button 
          type="button"
          onClick={() => {
            setShowCollectModal(rider);
            setCollectAmount(String(metrics.liveCodBalance));
            setCollectSubMode(null);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-1 shadow-xs shadow-emerald-650/15"
        >
          💵 Collect Cash
        </button>
      </div>

    </motion.div>
  );
}
