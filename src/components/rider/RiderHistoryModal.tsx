import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
}

interface RiderHistoryModalProps {
  selectedRiderForOrders: Rider | null;
  setSelectedRiderForOrders: (rider: Rider | null) => void;
  expandedOrders: Record<string, boolean>;
  setExpandedOrders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMounted: boolean;
}

export default function RiderHistoryModal({
  selectedRiderForOrders,
  setSelectedRiderForOrders,
  expandedOrders,
  setExpandedOrders,
  isMounted,
}: RiderHistoryModalProps) {
  const [riderDeliveries, setRiderDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<any>(null);

  useEffect(() => {
    if (selectedRiderForOrders && isMounted) {
      setRiderDeliveries([]);
      lastDocRef.current = null;
      setHasMore(true);
      fetchDeliveries(true);
    }
  }, [selectedRiderForOrders, isMounted]);

  const fetchDeliveries = async (isInitial = false) => {
    if (!selectedRiderForOrders) return;
    if (!isInitial && (!hasMore || isLoading)) return;

    try {
      setIsLoading(true);
      
      let q = supabase.from('orders')
          .select('*')
          .eq('partnerPhone', selectedRiderForOrders.phone)
          .eq('status', 'Delivered')
          .order('updatedAt', { ascending: false })
          .limit(10);
          
      if (!isInitial && lastDocRef.current) {
         // Naive pagination using ID since we don't track offset perfectly
         toast.error("Further pagination not yet implemented fully on Supabase");
         return;
      }

      const { data, error } = await q;
      if (error) throw error;
      const docs = data || [];

      if (docs.length < 10) {
        setHasMore(false);
      }
      
      setRiderDeliveries(prev => isInitial ? docs : [...prev, ...docs]);
    } catch (err) {
      console.error("Fetch deliveries failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted || !selectedRiderForOrders) return null;

  const formatDeliveryDate = (order: any) => {
    const ts = order.deliveredAt || order.updatedAt;
    if (!ts) return 'Today';

    let date: Date;
    if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else if (typeof ts.toMillis === 'function') {
      date = new Date(ts.toMillis());
    } else {
      date = new Date(ts);
    }

    if (isNaN(date.getTime())) return 'Today';

    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const dateStr = isToday ? 'Today' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${dateStr}, ${timeStr}`;
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-800">
        {/* Floating Back Button */}
        <button
          type="button"
          onClick={() => setSelectedRiderForOrders(null)}
          className="fixed top-5 left-5 sm:left-8 z-[170] w-11 h-11 bg-white/90 backdrop-blur-md text-slate-800 hover:text-slate-950 hover:bg-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl border border-slate-200 transition-all active:scale-[0.93] duration-150 cursor-pointer"
          title="Go Back"
        >
          <ArrowLeft size={18} className="stroke-[2.5]" />
        </button>

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className="w-full h-full flex flex-col text-left overflow-hidden"
        >
          {/* Scrolling Area */}
          <div className="flex-1 overflow-y-auto bg-slate-50 px-0.5 pt-20 pb-12">
            <div className="max-w-xl mx-auto w-full space-y-5">
              <div className="flex items-center justify-between shrink-0 mb-2 px-1">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">Completed Deliveries</p>
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                    🏍️ {selectedRiderForOrders.name} • Report Log
                  </h4>
                </div>
                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  {riderDeliveries.length} Delivered
                </span>
              </div>

              {riderDeliveries.length === 0 ? (
                <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs mx-1">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl border border-dashed border-slate-200">
                    📦
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No Deliveries Completed</p>
                  <p className="text-[10px] mt-1 max-w-xs mx-auto font-medium text-slate-400">
                    This rider has not completed any delivery cycles today yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {riderDeliveries.map((order, idx) => {
                    const orderAmt = Number(order.finalAmount || (Number(order.totalAmount || order.amount || 0) + Number(order.deliveryCharge || 0)));
                    const finalCustomerName = order.customerName || order.userName || order.name || 'Grezto Customer';
                    const historyCustomerPhone = order.phone || order.customerPhone || order.userPhone || '';

                    const cleanCustomerName = finalCustomerName
                      .trim()
                      .split(/\s+/)
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                      .join(' ');

                    const orderItems = order.items || order.fullItems || [];
                    const uniqueOrderShops = orderItems.length > 0
                      ? Array.from(new Set(orderItems.map((item: any) => item.shopName).filter(Boolean)))
                      : [];

                    const shopLabel =
                      uniqueOrderShops.length > 0
                        ? `${uniqueOrderShops
                            .map((s: any) =>
                              s
                                .trim()
                                .split(/\s+/)
                                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                .join(' ')
                            )
                            .join(' & ')} Customer`
                        : 'Grezto Customer';

                    const itemsCount =
                      orderItems.length > 0
                        ? orderItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 1), 0)
                        : 1;

                    const itemsTotalPrice =
                      orderItems.length > 0
                        ? orderItems.reduce(
                            (acc: number, item: any) => acc + Number(item.price) * (Number(item.quantity) || 1),
                            0
                          )
                        : orderAmt;

                    const isExpanded = !!expandedOrders[order.id];

                    return (
                      <div
                        key={order.id || idx}
                        className="bg-white p-3 py-3.5 rounded-[1.25rem] border-[2.5px] border-slate-900 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden text-left flex flex-col justify-between"
                      >
                        <div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-2">
                                <span className="text-slate-400 text-sm shrink-0 mt-0.5">👤</span>
                                <div>
                                  <p className="font-bold text-slate-800 tracking-tight leading-none text-[12.5px]">
                                    {cleanCustomerName}
                                  </p>
                                  {historyCustomerPhone && (
                                    <a
                                      href={`tel:${historyCustomerPhone}`}
                                      className="text-[9.5px] text-indigo-600 font-bold hover:underline mt-0.5 block"
                                    >
                                      +91 {historyCustomerPhone}
                                    </a>
                                  )}
                                  <span className="inline-flex items-center gap-1 text-[9px] text-slate-400 font-medium tracking-tight mt-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                                    🕒 {formatDeliveryDate(order)}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold border ${
                                    uniqueOrderShops.length > 0
                                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                  }`}
                                >
                                  <span>{uniqueOrderShops.length > 0 ? '🏪' : '📦'}</span>
                                  <span>{shopLabel}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 pt-1 border-t border-slate-100/50">
                              <span className="text-slate-400 text-xs shrink-0 mt-0.5">📍</span>
                              <p className="text-slate-500 font-semibold leading-normal text-[10px]">
                                {typeof order.address === 'object'
                                  ? (order.address?.address || 'Kawarhagi Delivery Area')
                                  : (order.address || 'Kawarhagi Delivery Area')}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100/70 space-y-1">
                            <p className="text-[8.5px] font-bold uppercase text-slate-400 tracking-wider">
                              Delivered Items
                            </p>

                            <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-3xs transition-all duration-200">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedOrders((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                                }
                                className="w-full flex items-center justify-between p-2 px-3 bg-slate-50/50 hover:bg-slate-100/40 text-left border-0 cursor-pointer transition-all duration-200 active:scale-[0.99]"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">🛍️</span>
                                  <div>
                                    <span className="text-[10.5px] font-bold text-slate-700 block">
                                      {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'} Completed
                                    </span>
                                    <span className="text-[8px] font-medium text-slate-400 block mt-0.5">
                                      Tap to view item details
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <span className="font-sans text-[11.5px] font-bold text-slate-700">
                                    ₹{itemsTotalPrice}
                                  </span>
                                  <div className="w-5 h-5 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-transform shrink-0">
                                    {isExpanded ? (
                                      <ArrowLeft size={10} className="stroke-[2.5] rotate-90" />
                                    ) : (
                                      <ArrowLeft size={10} className="stroke-[2.5] -rotate-90" />
                                    )}
                                  </div>
                                </div>
                              </button>

                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="overflow-hidden border-t border-slate-100"
                                  >
                                    <div className="p-3 bg-white space-y-1.5 max-h-[160px] overflow-y-auto">
                                      {(() => {
                                        const orderItemsList = order.items || order.fullItems || [];
                                        return orderItemsList.length > 0 ? (
                                        orderItemsList.map((item: any, itemIdx: number) => (
                                          <div
                                            key={itemIdx}
                                            className="flex justify-between items-center text-[11px] bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 font-medium text-slate-650 transition-all hover:bg-slate-100/50"
                                          >
                                            <div className="flex flex-col text-left">
                                              <span className="text-slate-950 font-black text-[11px] leading-tight">
                                                {item.name}
                                              </span>
                                              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                                  Qty: {item.quantity}
                                                </span>
                                                <span className="text-[8.5px] text-rose-600 font-extrabold tracking-wide uppercase">
                                                  Store: {item.shopName || 'Grezto Shop'}
                                                </span>
                                              </div>
                                            </div>
                                            <span className="font-sans text-slate-950 font-black text-[11px] shrink-0">
                                              ₹{item.price * (item.quantity || 1)}
                                            </span>
                                          </div>
                                        ))
                                        ) : (
                                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-650 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-sm">🍲</span>
                                            <span className="line-clamp-2">
                                              {(() => {
                                                let parsedItems = order.items;
                                                if (typeof parsedItems === 'string') {
                                                  try { parsedItems = JSON.parse(parsedItems); } catch(e) { parsedItems = []; }
                                                }
                                                if (!Array.isArray(parsedItems)) parsedItems = [];
                                                return parsedItems.map((i: any) => typeof i === 'string' ? i : i.name).join(', ') || 'Standard Package';
                                              })()}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 py-1 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between shrink-0">
                          <div className="text-left space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                              Cash to Deposit
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-bold text-emerald-650">₹{Math.max(0, orderAmt - 25)}</span>
                              <span className="text-[9.5px] text-slate-450 font-medium block">
                                (₹{orderAmt} - ₹25 commission)
                              </span>
                            </div>
                          </div>

                          <div className="text-right space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                              Order Total
                            </span>
                            <span className="text-sm font-bold text-emerald-650 block">₹{orderAmt}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {hasMore && (
                    <div className="pt-2 pb-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => fetchDeliveries()}
                        disabled={isLoading}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold py-2.5 px-6 rounded-full shadow-sm disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isLoading ? '⏳ Loading...' : 'Load More Deliveries'}
                      </button>
                    </div>
                  )}
                  {!hasMore && riderDeliveries.length > 0 && (
                    <div className="py-6 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No more history</p>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
