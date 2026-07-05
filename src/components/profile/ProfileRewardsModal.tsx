import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Coins, Ticket, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  redeemVoucher: (id: string, code: string, type: any, value: number, cost: number, title: string) => boolean;
}

export default function ProfileRewardsModal({
  isOpen,
  onClose,
  user,
  redeemVoucher
}: ProfileRewardsModalProps) {
  const [rewardsTab, setRewardsTab] = useState<'redeem' | 'wallet'>('redeem');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-end justify-center font-sans">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
      />
      
      {/* Modal Sheet */}
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="relative w-full max-w-md bg-stone-50 rounded-t-[32px] overflow-hidden flex flex-col max-h-[85vh] z-10 shadow-2xl border-t border-stone-200"
      >
        {/* Top Handle bar */}
        <div className="w-full flex justify-center py-2 shrink-0">
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between border-b border-stone-100 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 border border-amber-200/50">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#1c1917]">Rewards Club</h3>
              <p className="text-[8px] text-gray-400 font-extrabold uppercase tracking-widest font-sans">Earn & Redeem Points</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 bg-stone-100 rounded-full flex items-center justify-center border-0 cursor-pointer active:scale-95 transition-all text-[#1c1917]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          
          {/* Total Points Card */}
          <div className="bg-gradient-to-br from-stone-800 to-[#1c1917] p-4 rounded-3xl text-white relative overflow-hidden shadow-md">
            {/* Subtle Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
            
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <p className="text-[8px] text-amber-400 font-black uppercase tracking-widest leading-none mb-1">Available Loyalty Points</p>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-3xl font-black tracking-tight text-amber-400 font-mono">
                    {user.points !== undefined ? user.points : 150}
                  </span>
                  <span className="text-[10px] font-bold text-amber-100/70 uppercase">PTS</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-amber-400/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-400/20 shadow-xs">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            
            {/* Small hint text */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-stone-400">
              <span>1 Point earned per ₹10 spent</span>
              <span className="text-amber-400">Welcome Bonus Active √</span>
            </div>
          </div>

          {/* Tabs selection: Redeem vs Wallet */}
          <div className="bg-stone-200/50 p-1 rounded-2xl flex gap-1 border border-stone-200">
            <button 
              onClick={() => setRewardsTab('redeem')}
              className={`flex-1 py-2 text-center text-[9px] font-black uppercase tracking-widest rounded-xl border-y-0 border-x-0 transition-all cursor-pointer ${rewardsTab === 'redeem' ? 'bg-white text-emerald-850 shadow-xs scale-[1.02]' : 'bg-transparent text-stone-500 hover:text-stone-700'}`}
            >
               Redeem Offers
            </button>
            <button 
              onClick={() => setRewardsTab('wallet')}
              className={`flex-1 py-2 text-center text-[9px] font-black uppercase tracking-widest rounded-xl border-y-0 border-x-0 transition-all cursor-pointer ${rewardsTab === 'wallet' ? 'bg-white text-emerald-850 shadow-xs scale-[1.02]' : 'bg-transparent text-stone-500 hover:text-stone-700'}`}
            >
               My Wallet ({user.redeemedVouchers ? user.redeemedVouchers.filter((v: any) => !v.used).length : 0})
            </button>
          </div>

          {/* Tab Content */}
          {rewardsTab === 'redeem' ? (
            <div className="space-y-3">
              {[
                { id: 'v_20_off', title: '₹20 Discount Voucher', desc: 'Saves flat ₹20 on your next grocery order.', cost: 100, type: 'amount', value: 20 },
                { id: 'v_50_off', title: '₹50 Harvest Coupon', desc: 'Saves flat ₹50. Min order ₹150.', cost: 200, type: 'amount', value: 50 },
                { id: 'v_100_off', title: '₹100 Royal Coupon', desc: 'Saves flat ₹100. Min order ₹300.', cost: 400, type: 'amount', value: 100 },
                { id: 'v_free_del', title: 'Free Delivery Pass', desc: 'Waives delivery fee completely at checkout.', cost: 150, type: 'freedelivery', value: 0 }
              ].map((offer) => {
                const pointsBalance = user.points !== undefined ? user.points : 150;
                const isAffordable = pointsBalance >= offer.cost;
                
                return (
                  <div 
                    key={offer.id}
                    className="bg-white rounded-2xl border border-stone-200/80 p-3.5 flex items-center justify-between shadow-xs relative overflow-hidden group"
                  >
                    <div className="space-y-1 max-w-[70%] text-left">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-stone-850 uppercase tracking-wide">{offer.title}</span>
                        <span className="bg-amber-100 text-[#78350f] text-[7.5px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          {offer.cost} PTS
                        </span>
                      </div>
                      <p className="text-[8.5px] font-bold text-gray-500 leading-normal">{offer.desc}</p>
                    </div>
                    
                    <button 
                      disabled={!isAffordable}
                      onClick={() => {
                        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                        const typeCode = offer.type === 'freedelivery' ? 'FD' : `D${offer.value}`;
                        const voucherCode = `GRZ-${typeCode}-${randomSuffix}`;
                        
                        const success = redeemVoucher(
                          offer.id + '_' + Date.now(), 
                          voucherCode, 
                          offer.type as any, 
                          offer.value, 
                          offer.cost, 
                          offer.title
                        );
                        
                        if (success) {
                          toast.success(`🎉 Redeemed successfully! Voucher added to your Wallet.`, { position: "top-center" });
                          setRewardsTab('wallet');
                        } else {
                          toast.error("Insufficient points to redeem this voucher.");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl border-0 text-[8px] font-black uppercase tracking-wider transition-all scale-100 cursor-pointer ${isAffordable ? 'bg-emerald-650 hover:bg-emerald-700 text-white shadow-xs active:scale-95' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                    >
                      Redeem
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {(!user.redeemedVouchers || user.redeemedVouchers.filter((v: any) => !v.used).length === 0) ? (
                <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
                  <Ticket className="w-10 h-10 text-stone-300 stroke-1 animate-bounce" />
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest font-sans">No Active Vouchers</p>
                  <p className="text-[8.5px] text-gray-400 font-bold max-w-[200px] leading-relaxed">
                    Redeem your points to unlock exclusive vouchers! They will appear here immediately.
                  </p>
                </div>
              ) : (
                user.redeemedVouchers.filter((v: any) => !v.used).map((v: any) => (
                  <div 
                    key={v.id}
                    className="bg-white rounded-3xl border border-dashed border-emerald-500/30 bg-emerald-50/5 p-4 relative overflow-hidden text-left"
                  >
                    {/* Left notch decoration */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-stone-50 rounded-r-full border-r border-[#cbd5e1] -ml-1" />
                    {/* Right notch decoration */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-stone-50 rounded-l-full border-l border-[#cbd5e1] -mr-1" />
                    
                    <div className="flex justify-between items-center pl-2 pr-2">
                      <div className="space-y-1 max-w-[65%]">
                        <p className="text-[10px] font-black text-emerald-850 uppercase tracking-wider leading-none mt-1">{v.description}</p>
                        <div className="flex items-center space-x-1 font-mono pt-1">
                          <span className="text-[9px] font-black text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 select-all">
                            {v.code}
                          </span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(v.code);
                              toast.success("Voucher Code copied!");
                            }}
                            className="w-5 h-5 bg-stone-50 rounded border border-stone-200 flex items-center justify-center cursor-pointer active:scale-95 text-[#1c1917]"
                          >
                            <Copy className="w-3 h-3 text-stone-500" />
                          </button>
                        </div>
                        <p className="text-[7.5px] text-stone-400 font-bold">
                          {v.minSubtotal ? `Min purchase required: ₹${v.minSubtotal}` : 'No minimum order amount'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                          At Checkout
                        </span>
                        <p className="text-[6.5px] text-emerald-600 font-bold mt-1.5 uppercase tracking-tight">Ready to Apply</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
        
        {/* Bottom Info footer */}
        <div className="bg-stone-100 p-3.5 border-t border-stone-200 text-center shrink-0">
          <p className="text-[8.5px] font-bold text-gray-500 leading-relaxed font-sans">
            Apply redeemed vouchers directly in checkout to save instantly. Coupons are non-transferable & strictly checked. 🌿🥞
          </p>
        </div>
      </motion.div>
    </div>
  );
}
