import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, TrendingUp, CheckCircle, Calculator, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useUser } from '../context/UserContext';

export default function MerchantCalculation({ shop: initialShop, onClose }: { shop: any, onClose: () => void }) {
  const { firebaseAuthReady } = useUser();
  const [shop, setShop] = useState<any>(initialShop);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<'calculation' | 'ledger'>('calculation');

  // Sync with prop changes
  useEffect(() => {
    setShop(initialShop);
  }, [initialShop]);

  useEffect(() => {
    if (!firebaseAuthReady || !shop || !shop.id) return;
    let sub: any;
    let subShopData: any;
    
    const fetchOrders = async () => {
      const { data } = await supabase.from('orders').select('*').contains('shopIds', [shop.id]);
      if (data) {
        const allOrders = [...data];
        allOrders.sort((a: any, b: any) => {
          const timeA = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
          const timeB = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
          return timeB - timeA;
        });
        setOrders(allOrders);
      }
      setLoading(false);
    };
    
    const fetchLiveShopData = async () => {
      const { data } = await supabase.from('shops').select('*').eq('id', shop.id).maybeSingle();
      if (data) setShop(data);
    };

    fetchOrders();

    sub = supabase.channel(`merchant_calc_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shopIds=cs.{${shop.id}}` }, () => {
        fetchOrders();
      }).subscribe();
      
    subShopData = supabase.channel(`merchant_calc_shop_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: `id=eq.${shop.id}` }, () => {
        fetchLiveShopData();
      }).subscribe();
      
    return () => { 
      if (sub) sub.unsubscribe(); 
      if (subShopData) subShopData.unsubscribe();
    };
  }, [shop.id, firebaseAuthReady]);

  if (!shop) return null;

  let totalRevenue = 0;
  let totalItems = 0;
  let productsMap: Record<string, { qty: number, revenue: number }> = {};
  
  orders.forEach(order => {
    if (order.status === 'Cancelled') return;
    
    // Filter out orders created before the shop's ledger reset date
    if (shop.ledgerResetDate) {
      const orderTime = order.createdAt?.seconds 
        ? order.createdAt.seconds * 1000 
        : (order.createdAt ? new Date(order.createdAt).getTime() : 0);
      const resetTime = new Date(shop.ledgerResetDate).getTime();
      if (orderTime < resetTime) return;
    }
    
    const items = order.items || order.fullItems || [];
    items.forEach((item: any) => {
      const iShopName = (item.shopName || '').toLowerCase();
      const tShopName = (shop.name || '').toLowerCase();
      if (item.shopId === shop.id || item.productShopId === shop.id || (iShopName && iShopName === tShopName) || (iShopName && iShopName === shop.id.toLowerCase())) {
        const pName = item.name || 'Unknown Item';
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const rev = qty * price;
        
        totalRevenue += rev;
        totalItems += qty;
        
        if (!productsMap[pName]) {
          productsMap[pName] = { qty: 0, revenue: 0 };
        }
        productsMap[pName].qty += qty;
        productsMap[pName].revenue += rev;
      }
    });
  });

  const platformFee = Math.round(totalRevenue * 0.07);
  const netPayable = totalRevenue - platformFee;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 bg-stone-50 flex flex-col pb-10 sm:pb-0"
    >
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="w-full h-full flex flex-col bg-stone-50 overflow-hidden relative"
      >
        <div className="flex justify-between items-center p-6 border-b border-stone-200 shrink-0 bg-white z-10 sticky top-0 shadow-sm">
          <div>
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-500" /> Business Calculation
            </h2>
            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mt-1.5">Live Ledger for {shop.name || 'Your Shop'}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 min-h-0 rounded-xl flex items-center justify-center text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors border-0 cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 py-3 shrink-0 bg-white border-b border-stone-100">
          <div className="flex bg-stone-105 p-1 rounded-2xl w-full max-w-sm mx-auto border border-stone-200/40">
            <button
              onClick={() => setActiveSegment('calculation')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 border-0 cursor-pointer ${
                activeSegment === 'calculation'
                  ? 'bg-slate-900 text-white shadow-md font-bold'
                  : 'text-stone-500 hover:text-stone-800 bg-transparent'
              }`}
            >
              📊 Calculation
            </button>
            <button
              onClick={() => setActiveSegment('ledger')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 border-0 cursor-pointer ${
                activeSegment === 'ledger'
                  ? 'bg-slate-900 text-white shadow-md font-bold'
                  : 'text-stone-500 hover:text-stone-800 bg-transparent'
              }`}
            >
              📅 Ledger
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24">
          <div className="max-w-md mx-auto w-full space-y-4">
            
            {loading ? (
              <div className="space-y-4">
                <div className="h-16 bg-slate-100 rounded-2xl animate-pulse"></div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-6 animate-pulse">
                   <div className="grid grid-cols-2 gap-3">
                      <div className="h-28 bg-slate-50 rounded-2xl border border-slate-100"></div>
                      <div className="h-28 bg-rose-50 rounded-2xl border border-rose-100"></div>
                   </div>
                   <div className="h-32 bg-slate-900 rounded-3xl"></div>
                   <div className="space-y-3 pt-4 border-t border-slate-50">
                      <div className="h-4 bg-slate-100 rounded w-40"></div>
                      <div className="h-14 bg-slate-50 rounded-xl border border-slate-100"></div>
                      <div className="h-14 bg-slate-50 rounded-xl border border-slate-100"></div>
                   </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-900 rounded-2xl p-4 shadow-md flex items-center justify-between border border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                      <Calculator className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Live Sync</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Real-time update</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black text-slate-200 tracking-wider uppercase">Live</span>
                  </div>
                </div>

                {shop.ledgerResetDate && (
                  <div className="flex items-center gap-2 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-150 p-3 rounded-2xl shadow-sm">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                    <span>
                      Ledger Cycle Started: {new Date(shop.ledgerResetDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}

                {activeSegment === 'calculation' ? (
                  totalItems === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-slate-150 shadow-sm">
                      <TrendingUp className="w-10 h-10 text-slate-200 mb-3" />
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">No sales recorded yet</p>
                      <p className="text-[9px] text-slate-300 font-medium uppercase tracking-widest text-center mt-1">Start selling to see calculation here</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-6">

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-center">
                      <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest mb-1">Gross Sales</p>
                      <h4 className="text-xl font-black text-indigo-900 tracking-tight">₹{totalRevenue}</h4>
                      <p className="text-[8px] font-bold text-indigo-600/70 uppercase tracking-wider mt-1">{totalItems} Items Sold</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex flex-col justify-center">
                      <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-1 flex items-center justify-between">
                        <span>Platform Fee</span>
                        <span className="bg-rose-200/50 text-rose-800 px-1.5 py-0.5 rounded text-[7.5px]">7%</span>
                      </p>
                      <h4 className="text-xl font-black text-rose-900 tracking-tight">-₹{platformFee}</h4>
                      <p className="text-[8px] font-bold text-rose-600/70 uppercase tracking-wider mt-1">App Owner's Cut</p>
                  </div>
                  <div className="col-span-2 bg-[#2a303c] rounded-xl p-5 border border-[#1e232d] shadow-md relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
                      <div className="flex justify-between items-center relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 flex items-center gap-2">
                              <TrendingUp className="w-3.5 h-3.5" /> Net Payable To You
                          </p>
                          <h4 className="text-3xl font-black text-white tracking-tighter">₹{netPayable}</h4>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10 shadow-lg">
                            <CheckCircle className="w-7 h-7 text-emerald-400" />
                        </div>
                      </div>
                      <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mt-4 pt-4 border-t border-white/10 relative z-10 flex justify-between">
                        <span>Total after 7% cut</span>
                        <span className="text-emerald-400">Settled Daily at 9:00 PM</span>
                      </p>
                  </div>
                </div>

                {/* Sold Items Breakdown (No ledger list inside calculation tab) */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Sold Items Breakdown</h4>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {Object.keys(productsMap)
                      .sort((a,b) => productsMap[b].qty - productsMap[a].qty)
                      .map((pName, idx) => (
                        <div key={`${pName}-${idx}`} className="flex justify-between items-center text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="bg-white border border-slate-200 text-indigo-700 font-black px-2 py-1 rounded-lg text-[9px] shadow-sm">{productsMap[pName].qty}x</div>
                            <span className="text-slate-800 font-bold max-w-[150px] truncate leading-tight">{pName}</span>
                          </div>
                          <span className="text-slate-900 font-black tracking-tight bg-white px-2 py-1 rounded-lg border border-slate-150">₹{productsMap[pName].revenue}</span>
                        </div>
                    ))}
                  </div>
                </div>
              </div>
            )) : (
              <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
                <div className="bg-stone-50 border border-stone-200/60 p-4.5 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black text-stone-800 uppercase tracking-widest flex items-center justify-between border-b border-stone-200/80 pb-2">
                    <span>📅 Daily Payout Status (Ledger)</span>
                    {shop.currentLedgerOTP ? (
                      <span className="bg-black text-[#5efc82] px-2.5 py-1 rounded-lg text-[9.5px] font-bold tracking-widest font-mono shadow-md border border-zinc-800 animate-pulse flex items-center gap-1.5 border-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        OTP: {shop.currentLedgerOTP}
                      </span>
                    ) : (
                      <span className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">7 Days</span>
                    )}
                  </h4>

                  {shop.ledgerResetDate && (
                    <div className="text-[8px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-100/40 p-2 rounded-xl flex items-center gap-2 mb-2">
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
                      </span>
                      <span>Current Cycle Started: {new Date(shop.ledgerResetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}



                  <div className="space-y-2">
                    {(() => {
                      const days = [];
                      for (let i = 0; i < 7; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const dateId = `${y}-${m}-${day}`;
                        
                        const weekdayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
                        let label = weekdayName;
                        if (i === 0) {
                          label = `Today (${weekdayName})`;
                        } else if (i === 1) {
                          label = `Yesterday (${weekdayName})`;
                        }
                        days.push({ dateId, label });
                      }

                      return days.map(({ dateId, label }, idx) => {
                        let dayGross = 0;
                        orders.forEach(order => {
                          if (order.status === 'Cancelled') return;
                          
                          // Filter out orders created before the shop's ledger reset date
                          if (shop.ledgerResetDate) {
                            const orderTime = order.createdAt?.seconds 
                              ? order.createdAt.seconds * 1000 
                              : (order.createdAt ? new Date(order.createdAt).getTime() : 0);
                            const resetTime = new Date(shop.ledgerResetDate).getTime();
                            if (orderTime < resetTime) return;
                          }
                          
                          let orderDateId = '';
                          if (order.createdAt) {
                            const dateObj = order.createdAt.seconds 
                              ? new Date(order.createdAt.seconds * 1000) 
                              : new Date(order.createdAt);
                            const oy = dateObj.getFullYear();
                            const om = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const od = String(dateObj.getDate()).padStart(2, '0');
                            orderDateId = `${oy}-${om}-${od}`;
                          }

                          if (orderDateId === dateId) {
                            const items = order.items || order.fullItems || [];
                            items.forEach((item: any) => {
                              const iShopName = (item.shopName || '').toLowerCase();
                              const tShopName = (shop.name || '').toLowerCase();
                              if (item.shopId === shop.id || item.productShopId === shop.id || (iShopName && iShopName === tShopName) || (iShopName && iShopName === shop.id.toLowerCase())) {
                                dayGross += (item.price || 0) * (item.quantity || 1);
                              }
                            });
                          }
                        });

                        const dayPlatformFee = Math.round(dayGross * 0.07);
                        const dayNet = dayGross - dayPlatformFee;

                        const payoutInfo = shop.payouts?.[dateId] || { status: 'pending' };
                        const isSettled = payoutInfo.status === 'settled';

                        return (
                          <div key={`${dateId}-${idx}`} className="flex justify-between items-center bg-white border border-stone-150 p-2.5 rounded-xl text-[10.5px] shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-stone-900 leading-tight">{label}</span>
                              <span className="text-[7.5px] text-stone-400 font-mono mt-0.5">{dateId}</span>
                            </div>

                            <div className="flex items-center space-x-3 text-right">
                              <div className="flex flex-col">
                                <span className={`font-black tracking-tight ${dayGross > 0 ? 'text-stone-800' : 'text-stone-400'}`}>₹{dayNet}</span>
                                <span className="text-[7.5px] text-stone-450 font-bold uppercase leading-none mt-0.5">Net (Gross: ₹{dayGross})</span>
                              </div>

                              <div>
                                {isSettled ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                    <span>Received ✅</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-250 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    <span>Pending ⏳</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
