import React from 'react';
import { Shield, ChevronRight, BarChart, Bike } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileConsoleButtonsProps {
  user: any;
  userShop: any;
  onAdminClick: () => void;
  onOpenAnalytics?: () => void;
  setShowAnalyticsModal: (val: boolean) => void;
  onRiderManagementClick?: () => void;
  onMerchantClick: (shop: any) => void;
  onOpenCalculation?: () => void;
  setShowMerchantCalculationModal: (val: boolean) => void;
  onRiderClick?: () => void;
}

export default function ProfileConsoleButtons({
  user,
  userShop,
  onAdminClick,
  onOpenAnalytics,
  setShowAnalyticsModal,
  onRiderManagementClick,
  onMerchantClick,
  onOpenCalculation,
  setShowMerchantCalculationModal,
  onRiderClick,
}: ProfileConsoleButtonsProps) {
  return (
    <div className="space-y-3 pt-1">
      {/* Admin Dashboard Control Console */}
      {user.isAdmin && (
        <div className="space-y-3 pt-1">
          <button 
            onClick={onAdminClick}
            className="w-full bg-[#3b4b5e] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform border-0 cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider">Admin Panel</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-white/10 px-2 py-1 rounded-md border border-white/5 flex items-center space-x-1.5">
                  <Shield size={8} className="text-white/50" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/70">PIN: Manager</span>
               </div>
               <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>

          <button 
            onClick={() => onOpenAnalytics ? onOpenAnalytics() : setShowAnalyticsModal(true)}
            className="w-full bg-yellow-600 p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform shadow-lg border border-yellow-700 cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <BarChart className="w-4 h-4 text-white" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider text-yellow-50">Global Analytics</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-yellow-900/30 px-2 py-1 rounded-md border border-yellow-900/20 flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-100">Live</span>
               </div>
               <ChevronRight className="text-yellow-100/50 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>

          <button 
            type="button"
            onClick={() => onRiderManagementClick ? onRiderManagementClick() : window.dispatchEvent(new CustomEvent('grezto-open-rider-management'))}
            className="w-full bg-[#881337] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform shadow-lg border border-rose-950 cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bike className="w-4 h-4 text-white" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-50">Rider Management</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-rose-950/30 px-2 py-1 rounded-md border border-rose-950/20 flex items-center space-x-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-200">Fleet</span>
               </div>
               <ChevronRight className="text-rose-100/50 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>
        </div>
      )}

      {/* Merchant Admin Panel Card */}
      {userShop && (
        <div className="w-full space-y-3 pt-1">
          <button 
            onClick={() => {
              if (userShop.status === 'blocked') {
                toast.error("Your account has been blocked by the admin. Please contact support.", { duration: 4500 });
              } else {
                toast.dismiss();
                toast.success(`Welcome back ${userShop.ownerName || 'Merchant'}! Access granted 🔓`, { duration: 1500 });
                onMerchantClick(userShop);
              }
            }}
            className={`w-full p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-all border-0 cursor-pointer ${
              userShop.status === 'blocked' ? 'bg-red-800/80 hover:bg-red-800' : 'bg-rose-600 hover:bg-rose-750'
            }`}
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-sm">
                  🏪
               </div>
               <div className="text-left leading-none text-left">
                  <p className="text-[9.5px] font-black uppercase tracking-wider mb-0.5">{userShop.name}</p>
                  <p className="text-[7.5px] font-bold text-white/70 uppercase tracking-wider">Shop Merchant Console</p>
               </div>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-white/15 px-2 py-1 rounded-md border border-white/5 flex items-center space-x-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider">
                    {userShop.status === 'blocked' ? '🔴 Blocked' : '🟢 Merchant Panel'}
                  </span>
               </div>
               <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>
          {userShop.status === 'blocked' && (
            <p className="text-[8px] text-red-650 font-black bg-red-50 p-1.5 rounded-lg border border-red-100/65 text-center uppercase tracking-wider leading-none">
              ⚠️ Your shop registration is BLOCKED. Contact Grezto Support.
            </p>
          )}
          
          {userShop.status !== 'blocked' && (
            <button 
              onClick={() => onOpenCalculation ? onOpenCalculation() : setShowMerchantCalculationModal(true)}
              className="w-full bg-indigo-500 p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform shadow-md border border-indigo-600 cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                 <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                    <BarChart className="w-4 h-4 text-white" />
                 </div>
                 <p className="text-[9.5px] font-black uppercase tracking-wider text-indigo-50">Business Calculation</p>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="bg-indigo-950/20 px-2 py-1 rounded-md border border-indigo-950/10 flex items-center space-x-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-50">Ledger</span>
                 </div>
                 <ChevronRight className="text-indigo-50/50 group-hover:translate-x-1 transition-transform" size={14} />
              </div>
            </button>
          )}
        </div>
      )}

      {/* Rider Console Access Card */}
      {user.role === 'Rider' && (
        <button 
          type="button"
          onClick={() => onRiderClick ? onRiderClick() : window.dispatchEvent(new CustomEvent('grezto-open-rider'))}
          className="w-full bg-[#1e293b] hover:bg-[#334155] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-all border-0 cursor-pointer"
        >
          <div className="flex items-center space-x-2.5">
             <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-sm">
                🏍️
             </div>
             <div className="text-left leading-none text-left">
                <p className="text-[9.5px] font-black uppercase tracking-wider mb-0.5">Rider Work Desk</p>
                <p className="text-[7.5px] font-bold text-white/70 uppercase tracking-wider">Access delivery orders & maps</p>
             </div>
          </div>
          <div className="flex items-center space-x-2">
             <div className="bg-emerald-500/25 px-2 py-1 rounded-md border border-emerald-500/10 flex items-center space-x-1.5 animate-pulse">
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">
                   Active Rider
                </span>
             </div>
             <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
          </div>
        </button>
      )}
    </div>
  );
}
