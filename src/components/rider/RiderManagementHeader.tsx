import React from 'react';
import { ArrowLeft, Plus, Bike } from 'lucide-react';

interface RiderManagementHeaderProps {
  onClose: () => void;
  resetForm: () => void;
  setShowAddForm: (show: boolean) => void;
  totalRiders: number;
  activeRiders: number;
  totalUncollectedMoney: number;
}

export default function RiderManagementHeader({
  onClose,
  resetForm,
  setShowAddForm,
  totalRiders,
  activeRiders,
  totalUncollectedMoney
}: RiderManagementHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-[#3b0712] via-[#4c0519] to-[#700d23] text-white pt-10 pb-6 px-2.5 shrink-0 shadow-xl rounded-b-[1.8rem] relative overflow-hidden border-b border-rose-950/30">
      {/* Subtle background glow effect */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-rose-950/40 rounded-full blur-xl pointer-events-none"></div>

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/5 active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="text-left">
            <h1 className="text-[13px] font-black uppercase tracking-wider text-rose-50 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-white" /> Rider Management
            </h1>
            <p className="text-[7.5px] font-bold uppercase tracking-widest text-rose-300">Control Panel & Settlements</p>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-1.5 active:scale-95 transition-all outline-none border-0 cursor-pointer"
        >
          <Plus size={11} strokeWidth={3} /> Add Rider
        </button>
      </div>

      {/* Cohesive, Cute Metrics Summary boxes directly underneath with premium, custom non-basic color palettes */}
      <div className="flex items-center justify-between gap-2.5 mt-5">
        {/* Total Riders Box - Velvet Plum */}
        <div className="flex-1 text-center bg-rose-950/50 p-2.5 rounded-[1.1rem] border border-rose-500/20 shadow-inner">
          <p className="text-[6.5px] font-black uppercase tracking-widest text-rose-350">Total Rider</p>
          <h3 className="text-[13px] font-black mt-0.5 tracking-tight font-mono text-rose-100">
            {totalRiders < 10 ? `0${totalRiders}` : totalRiders}
          </h3>
        </div>

        {/* Active Riders Box - Sage Teal */}
        <div className="flex-1 text-center bg-[#064e3b]/45 p-2.5 rounded-[1.1rem] border border-emerald-500/20 shadow-inner">
          <p className="text-[6.5px] font-black uppercase tracking-widest text-emerald-300">Active Rider</p>
          <div className="flex items-center justify-center gap-1.5 mt-0.5 font-mono">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
            <h3 className="text-[13px] font-black tracking-tight text-white">{activeRiders}</h3>
          </div>
        </div>

        {/* Total Money Box - Antique Amber */}
        <div className="flex-1 text-center bg-amber-950/45 p-2.5 rounded-[1.1rem] border border-amber-500/20 shadow-inner">
          <p className="text-[6.5px] font-black uppercase tracking-widest text-amber-200">Total Money</p>
          <h3 className="text-[13px] font-black mt-0.5 tracking-tight font-mono text-amber-100">
            ₹{totalUncollectedMoney}
          </h3>
        </div>
      </div>
    </div>
  );
}
