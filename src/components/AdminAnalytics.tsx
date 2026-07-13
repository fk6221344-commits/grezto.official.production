import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, BarChart, Package, Calendar, TrendingUp, DollarSign, Wallet, Check, CheckCircle2, Clock, AlertCircle, RotateCcw, Compass } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useUser } from '../context/UserContext';
import toast from 'react-hot-toast';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import confetti from 'canvas-confetti';

interface AdminAnalyticsProps {
  onClose: () => void;
}

interface SelectedPayout {
  shopId: string;
  shopName: string;
  dateId: string;
  dateLabel: string;
  dayGross: number;
  dayNet: number;
  currentStatus: 'pending' | 'settled';
}

export default function AdminAnalytics({ onClose }: AdminAnalyticsProps) {
  const { firebaseAuthReady } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<'performance' | 'ledger'>('performance');
  const [expandedLedgerShopId, setExpandedLedgerShopId] = useState<string | null>(null);
  const [payoutToEdit, setPayoutToEdit] = useState<SelectedPayout | null>(null);
  const [confirmResetShopId, setConfirmResetShopId] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'none' | 'otp' | 'double_confirm'>('none');
  const [enteredOTP, setEnteredOTP] = useState('');

  // Patakha / Cracker animation
  const triggerPatakhaExplosion = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
    
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 }
      });
    }, 200);

    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 }
      });
    }, 400);

    setTimeout(() => {
      const end = Date.now() + (1.5 * 1000);
      const interval = setInterval(() => {
        if (Date.now() > end) {
          return clearInterval(interval);
        }
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random(), y: Math.random() - 0.2 }
        });
      }, 150);
    }, 600);
  };

  // Check if any day has active sales and is NOT settled yet
  const getActiveUnpaidDays = (targetShop: any) => {
    const daysList = getLast7Days();
    const unpaidList: any[] = [];
    
    daysList.forEach(({ dateId, label }) => {
      let dayGross = 0;
      orders.forEach(order => {
        if (order.status === 'Cancelled') return;
        
        if (targetShop.ledgerResetDate) {
          const orderTime = order.createdAt?.seconds 
            ? order.createdAt.seconds * 1000 
            : (order.createdAt ? new Date(order.createdAt).getTime() : 0);
          const resetTime = new Date(targetShop.ledgerResetDate).getTime();
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
            const tShopName = (targetShop.name || '').toLowerCase();
            if (item.shopId === targetShop.id || item.productShopId === targetShop.id || (iShopName && iShopName === tShopName) || (iShopName && iShopName === targetShop.id.toLowerCase())) {
              dayGross += (item.price || 0) * (item.quantity || 1);
            }
          });
        }
      });

      const payoutInfo = targetShop.payouts?.[dateId] || { status: 'pending' };
      const isSettled = payoutInfo.status === 'settled';

      if (dayGross > 0 && !isSettled) {
        unpaidList.push({ dateId, label, amount: dayGross });
      }
    });
    
    return unpaidList;
  };

  // Direct ledger reset prompt for starting fresh cycle (No OTP required for Admin/Owner)
  const handleInitiateLedgerReset = async (targetShop: any) => {
    const unpaid = getActiveUnpaidDays(targetShop);
    if (unpaid.length > 0) {
      toast.error(`Error: Cannot finish cycle! There are ${unpaid.length} unpaid settlement days in this cycle. Please mark them as PAID first!`, { duration: 5000 });
      return;
    }

    setConfirmResetShopId(targetShop.id);
    setResetStep('double_confirm');
  };

  // Handler to reset historical ledger/starting fresh for a shop
  const handleResetLedger = async (shopId: string, shopName: string) => {
    const loadToast = toast.loading(`Resetting ledger cycle for ${shopName}...`);
    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId,
          updateData: {
            ledgerResetDate: new Date().toISOString(),
            currentLedgerOTP: null,
            ledgerOTPGeneratedAt: null
          }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      toast.success(`Ledger cycle reset successfully for ${shopName}! Starting fresh starting.`, { id: loadToast });
      
      // Fire Patakha explosion
      triggerPatakhaExplosion();

      // Reset states
      setConfirmResetShopId(null);
      setResetStep('none');
      setEnteredOTP('');
    } catch (err: any) {
      console.error(err);
      toast.error(`Reset failed: ${err.message || 'Error occurred'}`, { id: loadToast });
    }
  };

  useEffect(() => {
    if (!firebaseAuthReady) return;

    let subOrders: any;
    const fetchOrders = async () => {
      const { data } = await supabase.from('orders').select('*').order('createdAt', { ascending: false }).limit(3000);
      if (data) setOrders(data);
    };
    fetchOrders();

    subOrders = supabase.channel('analytics_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      }).subscribe();


    let subShops: any;
    const fetchShops = async () => {
      const { data } = await supabase.from('shops').select('*');
      if (data) {
        setShops(data);
      }
      setLoading(false);
    };
    fetchShops();

    subShops = supabase.channel('analytics_shops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
        fetchShops();
      }).subscribe();

    return () => {
      if (subOrders) subOrders.unsubscribe();
      if (subShops) subShops.unsubscribe();
    };
  }, [firebaseAuthReady]);

  // Helper to generate last 7 days list
  const getLast7Days = () => {
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
    return days;
  };

  // Handler to update the payout status in Firestore
  const handleUpdatePayoutStatus = async (status: 'pending' | 'settled') => {
    if (!payoutToEdit) return;
    const { shopId, dateId, dateLabel } = payoutToEdit;
    
    const loadToast = toast.loading(`Updating ledger for ${dateLabel}...`);
    try {
      const shopToUpdate = shops.find(s => s.id === shopId);
      if (!shopToUpdate) throw new Error("Shop not found");
      const currentPayouts = shopToUpdate.payouts || {};

      const newPayoutInfo = {
        status: status,
        updatedAt: new Date().toISOString()
      } as any;
      
      if (status === 'settled') {
        newPayoutInfo.settledAt = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      }

      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId,
          updateData: {
            payouts: {
              ...currentPayouts,
              [dateId]: newPayoutInfo
            }
          }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      
      toast.success(`${dateLabel} marked as ${status === 'settled' ? 'Paid ✅' : 'Unpaid ⏳'}`, { id: loadToast });
      setPayoutToEdit(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Update failed: ${err.message || 'Error occurred'}`, { id: loadToast });
    }
  };

  const runMigrationScript = async () => {
    toast.error("Migration feature removed cleanly.");
  };

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
        {/* Header */}
        <div className="flex flex-col justify-center px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6 border-b border-stone-200 shrink-0 bg-white z-10 sticky top-0 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                <BarChart className="w-5 h-5 text-emerald-500" /> Live Analytics
              </h2>
              <p className="text-[9px] text-stone-500 font-bold uppercase tracking-wider mt-1">Real-time total shop performance</p>
            </div>
            <button onClick={onClose} className="p-2.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 transition-colors border-0 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          
          {/* Admin Override Action */}
          <button 
             onClick={runMigrationScript}
             className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-md border-0 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            Migrate Initial Historical Stats
          </button>
        </div>

        {/* Tab / Segment selector */}
        <div className="px-6 py-3 shrink-0 bg-white border-b border-stone-100">
          <div className="flex bg-stone-100 p-1 rounded-2xl w-full max-w-sm mx-auto">
            <button
              onClick={() => setActiveSegment('performance')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 border-0 cursor-pointer ${
                activeSegment === 'performance'
                  ? 'bg-slate-900 text-white shadow-md font-bold'
                  : 'text-stone-500 hover:text-stone-800 bg-transparent'
              }`}
            >
              📈 Live Performance
            </button>
            <button
              onClick={() => setActiveSegment('ledger')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 border-0 cursor-pointer ${
                activeSegment === 'ledger'
                  ? 'bg-slate-900 text-white shadow-md font-bold'
                  : 'text-stone-500 hover:text-stone-800 bg-transparent'
              }`}
            >
              📅 Payout Ledger
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="p-6 overflow-y-auto bg-stone-50/50 flex-1 relative">
          {loading ? (
            <div className="space-y-4 max-w-lg mx-auto w-full">
              {[1, 2].map((skeleton) => (
                <div key={skeleton} className="mb-5 bg-white border border-stone-200 shadow-sm rounded-[1.5rem] p-5 animate-pulse">
                  <div className="flex justify-between items-start border-b border-stone-150 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-200/60 rounded-xl"></div>
                      <div className="space-y-2.5">
                        <div className="h-4 bg-stone-200/80 rounded w-32"></div>
                        <div className="h-2.5 bg-stone-200/60 rounded w-20"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1.5 w-[75px]">
                      <div className="h-8 bg-emerald-50 rounded-lg w-full"></div>
                      <div className="h-[26px] bg-rose-50 rounded-lg w-full"></div>
                      <div className="h-10 bg-slate-100 rounded-lg w-full mt-1"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="h-2.5 bg-stone-200/60 rounded w-40 mb-3 mt-1 ml-1"></div>
                    <div className="grid grid-cols-1 gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-between items-center bg-stone-50/80 p-3 rounded-xl border border-stone-100">
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-[26px] h-5 bg-emerald-50 rounded"></div>
                            <div className="h-3.5 bg-stone-200/70 rounded w-[60%]"></div>
                          </div>
                          <div className="h-4 bg-stone-200/80 rounded w-12"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeSegment === 'performance' ? (
            /* Live Performance Tab */
            <div className="space-y-4 max-w-lg mx-auto">
              {(() => {
                const shopSales: Record<string, { totalRevenue: number, totalItems: number, products: Record<string, { qty: number, revenue: number }> }> = {};
                
                orders.forEach(order => {
                  if (order.status === 'Cancelled') return;
                  const items = order.items || order.fullItems || [];
                  items.forEach((item: any) => {
                    const sId = item.shopId || item.productShopId;
                    const matchedShop = shops.find(sh => sh.id === sId);
                    if (matchedShop && matchedShop.ledgerResetDate) {
                      const orderTime = order.createdAt?.seconds 
                        ? order.createdAt.seconds * 1000 
                        : (order.createdAt ? new Date(order.createdAt).getTime() : 0);
                      const resetTime = new Date(matchedShop.ledgerResetDate).getTime();
                      if (orderTime < resetTime) return;
                    }

                    const sName = item.shopName || 'Grezto Retail Shop';
                    const pName = item.name || 'Unknown Item';
                    const qty = item.quantity || 1;
                    const price = item.price || 0;
                    const rev = qty * price;
                    
                    if (!shopSales[sName]) {
                      shopSales[sName] = { totalRevenue: 0, totalItems: 0, products: {} };
                    }
                    
                    shopSales[sName].totalRevenue += rev;
                    shopSales[sName].totalItems += qty;
                    
                    if (!shopSales[sName].products[pName]) {
                      shopSales[sName].products[pName] = { qty: 0, revenue: 0 };
                    }
                    shopSales[sName].products[pName].qty += qty;
                    shopSales[sName].products[pName].revenue += rev;
                  });
                });

                const shopsData = Object.keys(shopSales);
                
                if (shopsData.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 bg-white rounded-3xl border border-stone-150">
                      <Package className="w-10 h-10 text-stone-200 mb-3" />
                      <p className="text-[13px] text-stone-400 font-bold uppercase tracking-widest text-center">No sales data recorded yet.</p>
                      <p className="text-[9px] text-stone-300 font-medium uppercase tracking-widest text-center mt-1">Accept custom orders or check checkout</p>
                    </div>
                  );
                }

                return shopsData.map(shopName => {
                  const grossRevenue = shopSales[shopName].totalRevenue;
                  const platformFee = Math.round(grossRevenue * 0.07);
                  const netPayable = grossRevenue - platformFee;
                  
                  return (
                    <div key={shopName} className="mb-5 bg-white border border-stone-200 shadow-sm rounded-[1.5rem] p-5">
                      <div className="flex justify-between items-start border-b border-stone-150 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                            <Activity className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h5 className="text-[13px] font-black text-stone-800 uppercase tracking-tight max-w-[130px] truncate">{shopName}</h5>
                            <p className="text-[9px] text-stone-500 font-black uppercase tracking-widest mt-0.5">{shopSales[shopName].totalItems} Items Sold</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <div className="text-right bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 w-full">
                            <p className="text-xs font-black text-emerald-700 tracking-tight">₹{grossRevenue}</p>
                            <p className="text-[7px] text-emerald-600 font-black uppercase tracking-widest">Gross</p>
                          </div>
                          <div className="text-right bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 w-full">
                            <p className="text-[10px] font-black text-rose-600 tracking-tight">-₹{platformFee}</p>
                            <p className="text-[6.5px] text-rose-500 font-black uppercase tracking-widest">7% Fee</p>
                          </div>
                          <div className="text-right bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 w-full shadow-md text-white">
                            <p className="text-[13px] font-black text-white tracking-tight">₹{netPayable}</p>
                            <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">Net Payable</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[8.5px] font-black text-stone-400 uppercase tracking-widest mb-2.5 mt-1 ml-1">Purchased Items Breakdown</p>
                        <div className="grid grid-cols-1 gap-2">
                          {Object.keys(shopSales[shopName].products)
                            .sort((a,b) => shopSales[shopName].products[b].qty - shopSales[shopName].products[a].qty)
                            .map((pName, idx) => (
                              <div key={`${pName}-${idx}`} className="flex justify-between items-center text-[11px] bg-stone-50 p-3 rounded-xl border border-stone-150">
                                <div className="flex items-center gap-2.5">
                                  <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded text-[10px]">{shopSales[shopName].products[pName].qty}x</span>
                                  <span className="text-stone-700 font-bold max-w-[180px] truncate leading-tight">{pName}</span>
                                </div>
                                <span className="text-stone-900 font-black tracking-tight drop-shadow-sm">₹{shopSales[shopName].products[pName].revenue}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* Payout Ledger Tab (The requested Weekly Hisab / Settlement System) */
            <div className="space-y-4 max-w-lg mx-auto">
              {(() => {
                const ledgerShopsMap = new Map();
                
                // 1. Add all registered shops
                shops.forEach(shop => {
                  if (shop && shop.id) {
                    ledgerShopsMap.set(shop.id, { ...shop, isVirtual: false });
                  }
                });

                // 2. Scan orders to find any missing (custom/unregistered) shops
                orders.forEach(order => {
                  if (order.status === 'Cancelled') return;
                  const items = order.items || order.fullItems || [];
                  items.forEach((item: any) => {
                     const sName = item.shopName || 'Grezto Retail Shop';
                     const sId = item.shopId || item.productShopId || sName;

                     // check if exists by id
                     let existing = ledgerShopsMap.get(sId);
                     if (!existing) {
                        // check if exists by name
                        existing = Array.from(ledgerShopsMap.values()).find(s => (s.name || '').toLowerCase() === sName.toLowerCase());
                     }

                     if (!existing) {
                       ledgerShopsMap.set(sId, {
                         id: sId,
                         name: sName,
                         isVirtual: true,
                         payouts: {},
                         ledgerResetDate: null
                       });
                     }
                  });
                });

                const unifiedShops = Array.from(ledgerShopsMap.values());

                if (unifiedShops.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 bg-white rounded-3xl border border-stone-150">
                      <Package className="w-10 h-10 text-stone-200 mb-3" />
                      <p className="text-[11.5px] text-stone-400 font-bold uppercase tracking-widest text-center">No shops or orders found.</p>
                    </div>
                  );
                }

                return unifiedShops.map((shop) => {
                  const daysList = getLast7Days();

                  return (
                    <div key={shop.id} className="bg-white border border-stone-200 shadow-sm rounded-[1.5rem] p-5 mb-5">
                      {/* Shop header (Collapsible) */}
                      <button
                        type="button"
                        onClick={() => setExpandedLedgerShopId(expandedLedgerShopId === shop.id ? null : shop.id)}
                        className={`w-full flex items-center justify-between text-left transition-colors active:scale-[0.99] cursor-pointer border-0 bg-transparent ${expandedLedgerShopId === shop.id ? 'border-b border-stone-150 pb-3 mb-4' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${shop.isVirtual ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
                            <Activity className={`w-4 h-4 ${shop.isVirtual ? 'text-amber-600' : 'text-indigo-600'}`} />
                          </div>
                          <div>
                            <h5 className="text-[13px] font-black text-stone-800 uppercase tracking-tight truncate max-w-[220px]">{shop.name || 'Unnamed Shop'}</h5>
                            <p className={`text-[8px] font-black uppercase tracking-widest ${shop.isVirtual ? 'text-amber-700' : 'text-indigo-700'}`}>
                              {shop.isVirtual ? 'Virtual Shop (Ledger Read-Only)' : 'Live 7 Days Ledger'}
                            </p>
                          </div>
                        </div>
                        <div>
                           {expandedLedgerShopId === shop.id ? (
                             <div className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center">
                               <svg className="w-3.5 h-3.5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                             </div>
                           ) : (
                             <div className="w-7 h-7 bg-stone-100 rounded-lg flex items-center justify-center">
                               <svg className="w-3.5 h-3.5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                             </div>
                           )}
                        </div>
                      </button>

                      {/* Expanded Content: Days Settlement List & Cycle Resetter */}
                      {expandedLedgerShopId === shop.id && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            {daysList.map(({ dateId, label }, idx) => {
                          let dayGross = 0;
                          orders.forEach(order => {
                            if (order.status === 'Cancelled') return;
                            
                            // EXCLUDE ORDERS BEFORE LEDGER RESET DATE
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
                            <button
                              key={`${dateId}-${idx}`}
                              type="button"
                              onClick={() => {
                                if (shop.isVirtual) {
                                  toast.error("This is an unregistered custom shop. You can't update its payout status manually.", { icon: '⚠️' });
                                  return;
                                }
                                setPayoutToEdit({
                                  shopId: shop.id,
                                  shopName: shop.name || 'Unnamed Shop',
                                  dateId,
                                  dateLabel: label,
                                  dayGross,
                                  dayNet,
                                  currentStatus: isSettled ? 'settled' : 'pending'
                                });
                              }}
                              className="w-full flex justify-between items-center bg-stone-50 hover:bg-stone-100/70 border border-stone-150 p-3 rounded-xl text-left transition active:scale-[0.99] cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="text-[11px] font-extrabold text-stone-900 leading-tight">{label}</span>
                                <span className="text-[7.5px] text-stone-400 font-mono mt-0.5">{dateId}</span>
                              </div>

                              <div className="flex items-center space-x-3 text-right">
                                <div className="flex flex-col">
                                  <span className={`text-[11px] font-black tracking-tight ${dayGross > 0 ? 'text-indigo-700' : 'text-stone-400'}`}>₹{dayNet}</span>
                                  <span className="text-[7.5px] text-stone-400 font-bold uppercase leading-none mt-0.5">Net (Gross: ₹{dayGross})</span>
                                </div>

                                <div className="font-sans">
                                  {isSettled ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                      <span>PAID ✅</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-250 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse">
                                      <span>Pending ⏳</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Cycle Resetter / Reset Button */}
                      {!shop.isVirtual && (
                        <div className="mt-4 pt-4 border-t border-stone-150 flex flex-col space-y-2">
                          {shop.ledgerResetDate && (
                          <div className="flex items-center gap-1.5 text-[8.5px] font-black text-indigo-700 bg-indigo-50/70 p-2 rounded-xl mb-1 border border-indigo-100/60 leading-normal">
                            <Clock className="w-3 h-3 text-indigo-600 animate-pulse shrink-0" />
                            <span>
                              Current cycle started: {new Date(shop.ledgerResetDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}

                        {(() => {
                          const unpaidDaysForShop = getActiveUnpaidDays(shop);
                          
                          if (confirmResetShopId === shop.id) {
                            if (resetStep === 'double_confirm') {
                              return (
                                <div className="bg-rose-950 border border-rose-800 text-white p-4 rounded-2.5xl space-y-3 shadow-2xl">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-450 animate-pulse shrink-0" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#fca5a5]">⚠️ Confirm Starting Fresh</p>
                                  </div>
                                  <p className="text-[8.5px] text-rose-200 font-extrabold leading-relaxed uppercase">
                                    Confirm starting fresh? All sales records in this cycle will be finalized. The ledger will reset to ₹0 instantly. This action is irreversible.
                                  </p>
                                  
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleResetLedger(shop.id, shop.name)}
                                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider py-2.5 px-4 rounded-xl border-0 shadow-md cursor-pointer active:scale-95 transition"
                                    >
                                      CONFIRM & FINISH CYCLE 🚀
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmResetShopId(null);
                                        setResetStep('none');
                                        setEnteredOTP('');
                                      }}
                                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-black text-[9px] uppercase tracking-wider py-2.5 px-4 rounded-xl border-0 cursor-pointer active:scale-95 transition"
                                    >
                                      Abort
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                          }

                          return (
                            <div className="space-y-2">
                              {unpaidDaysForShop.length > 0 && (
                                <div className="flex items-start gap-2 text-[8px] font-black text-amber-800 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 leading-normal mb-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>
                                    ⚠️ CANNOT FINISH CYCLE: Please settle {unpaidDaysForShop.length} Unpaid Daily Payouts above first. All active sales days must be fully paid.
                                  </span>
                                </div>
                              )}
                              
                              <button
                                type="button"
                                disabled={unpaidDaysForShop.length > 0}
                                onClick={() => handleInitiateLedgerReset(shop)}
                                className={`w-full flex items-center justify-center gap-2 font-black text-[9.5px] uppercase tracking-widest py-3 px-4 rounded-xl border-0 shadow-sm transition-all cursor-pointer font-sans ${
                                  unpaidDaysForShop.length > 0
                                    ? 'bg-stone-150 text-stone-400 cursor-not-allowed border border-stone-200'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.98]'
                                }`}
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-[#5efc82]" />
                                Finish Cycle & Start Fresh
                              </button>
                            </div>
                          );
                          })()}
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Settlement overlay modal popup */}
      <AnimatePresence>
        {payoutToEdit && (
          <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl border border-stone-150 relative overflow-hidden font-sans"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[8.5px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                    🧾 Update Payout Ledger
                  </span>
                  <h4 className="text-sm font-black text-stone-900 mt-2.5 uppercase tracking-tight">{payoutToEdit.shopName}</h4>
                </div>
                <button 
                  onClick={() => setPayoutToEdit(null)}
                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full border-0 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/60 space-y-3.5 mb-5 text-[11px]">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <span className="text-stone-500 font-bold uppercase tracking-wider">📅 Settlement Date</span>
                  <span className="font-extrabold text-stone-800 font-mono">{payoutToEdit.dateLabel} ({payoutToEdit.dateId})</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <span className="text-stone-500 font-bold uppercase tracking-wider">💰 Daily Gross Sales</span>
                  <span className="font-extrabold text-stone-800">₹{payoutToEdit.dayGross}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <span className="text-indigo-600 font-black uppercase tracking-wider">🚀 Net Payable (7% cut)</span>
                  <span className="font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-lg">₹{payoutToEdit.dayNet}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 font-black uppercase tracking-wider">⚡ Current Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                    payoutToEdit.currentStatus === 'settled' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-250' 
                      : 'bg-amber-50 text-amber-800 border border-amber-250'
                  }`}>
                    {payoutToEdit.currentStatus === 'settled' ? 'PAID ✅' : 'Pending ⏳'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleUpdatePayoutStatus('settled')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest py-3.5 px-4 rounded-xl border-0 shadow-lg shadow-emerald-500/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Mark as PAID ✅
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdatePayoutStatus('pending')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest py-3.5 px-4 rounded-xl border-0 shadow-lg shadow-amber-400/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Mark as UNPAID (Pending ⏳)
                </button>
                <div className="border-t border-stone-100 my-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayoutToEdit(null)}
                    className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl border-0 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
