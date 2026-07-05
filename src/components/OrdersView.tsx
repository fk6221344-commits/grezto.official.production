import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Package, Clock, CheckCircle2, Navigation, ShoppingBag, MapPin, Check, Phone, Download, MoreVertical, History, ListFilter, ArrowLeft } from 'lucide-react';
import { auth } from '../services/firebase';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import OrderedProductsModal from './OrderedProductsModal';

// --- SWR (Stale-While-Revalidate) Client-Side Global Caching Layer ---
// This holds active/completed/history orders in memory so that when toggling tabs or
// navigating between Home and Orders, the UI loads INSTANTLY (0 seconds delay!)
// and fetches updates silently in the background, offering an elite user experience.
let globalActiveOrdersCache: any[] | null = null;
let globalHistoryOrdersCache: any[] | null = null;
let globalHistoryPageCache = 0;
let globalHasMoreHistoryCache = true;
let globalCachedPhone: string | null = null;
let globalCachedUid: string | null = null;

export default function OrdersView({ 
  onNavigateToHome, 
  onTrackOrder,
  viewTab: propViewTab,
  setViewTab: propSetViewTab
}: { 
  onNavigateToHome?: () => void; 
  onTrackOrder?: (order: any) => void;
  viewTab?: 'pending' | 'history';
  setViewTab?: (tab: 'pending' | 'history') => void;
}) {
  const { user, firebaseAuthReady } = useUser();
  const { t } = useLanguage();

  const currentUid = auth.currentUser?.uid;
  const currentPhone = user.phone;

  // Cache Invalidation Check: If user switches account or logouts/logins, reset the global cache
  if (
    (currentUid && globalCachedUid !== currentUid) ||
    (currentPhone && globalCachedPhone !== currentPhone)
  ) {
    globalActiveOrdersCache = null;
    globalHistoryOrdersCache = null;
    globalHistoryPageCache = 0;
    globalHasMoreHistoryCache = true;
    globalCachedUid = currentUid || null;
    globalCachedPhone = currentPhone || null;
  }

  const [localViewTab, setLocalViewTab] = useState<'pending' | 'history'>('pending');
  const viewTab = propViewTab !== undefined ? propViewTab : localViewTab;
  const setViewTab = propSetViewTab !== undefined ? propSetViewTab : setLocalViewTab;
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [dbHistoryOrders, setDbHistoryOrders] = useState<any[]>(() => globalHistoryOrdersCache || []);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(() => globalHistoryPageCache);
  const [hasMoreHistoryFromServer, setHasMoreHistoryFromServer] = useState(() => globalHasMoreHistoryCache);
  const HISTORY_PAGE_SIZE = 7;

  // Reset limit to 5 whenever tab changes to keep interface fast and lightweight
  useEffect(() => {
    if (viewTab === 'pending') {
       // Reset states for active orders (if any)
    } else if (viewTab === 'history') {
       if (dbHistoryOrders.length === 0 && !historyLoading && hasMoreHistoryFromServer) {
          fetchHistoryFromServer();
       }
    }
  }, [viewTab]);

  const fetchHistoryFromServer = async () => {
    if (!user.isLoggedIn || historyLoading || !hasMoreHistoryFromServer) return;
    setIsLoadingMore(true);
    setHistoryLoading(true);
    try {
       const { supabase } = await import('../services/supabase');
       if (!supabase) return;

       const orQuery = [];
       const currentUid = auth.currentUser?.uid;

       const phoneList = [user.phone];
       const stripped = user.phone.replace(/\D/g, '').slice(-10);
       if (stripped && !phoneList.includes(stripped)) phoneList.push(stripped);
       if (stripped && !phoneList.includes('+91' + stripped)) phoneList.push('+91' + stripped);

       if (currentUid) orQuery.push(`userId.eq.${currentUid}`);
       if (phoneList.length > 0) {
          orQuery.push(`customerPhone.in.(${phoneList.map(p=>`"${p}"`).join(',')})`);
       }
       if (orQuery.length === 0) return;

       const { data } = await supabase.from('orders')
          .select('*')
          .or(orQuery.join(','))
          .in('status', ['Delivered', 'delivered', 'Cancelled', 'cancelled', 'Rejected', 'rejected'])
          .order('createdAt', { ascending: false })
          .range(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE - 1);

       if (data && data.length > 0) {
          setDbHistoryOrders(prev => {
             const newOrders = [...prev];
             data.forEach(d => { if (!newOrders.find(o => o.id === d.id)) newOrders.push(d); });
             globalHistoryOrdersCache = newOrders;
             return newOrders;
          });
          const nextPage = historyPage + 1;
          setHistoryPage(nextPage);
          globalHistoryPageCache = nextPage;
          if (data.length < HISTORY_PAGE_SIZE) {
              setHasMoreHistoryFromServer(false);
              globalHasMoreHistoryCache = false;
          }
       } else {
          setHasMoreHistoryFromServer(false);
          globalHasMoreHistoryCache = false;
       }
    } catch (e) {
       console.error("Failed to fetch history", e);
    } finally {
       setIsLoadingMore(false);
       setHistoryLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (viewTab === 'history') {
      fetchHistoryFromServer();
    }
  };
  const [orders, setOrders] = useState<any[]>(() => globalActiveOrdersCache || []);
  const [loading, setLoading] = useState(() => !globalActiveOrdersCache);
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone) {
        setLoading(false);
        return;
    }

    const currentUid = auth.currentUser?.uid;
    const phoneList = [user.phone];
    const stripped = user.phone.replace(/\D/g, '').slice(-10);
    if (stripped && !phoneList.includes(stripped)) {
      phoneList.push(stripped);
    }
    if (stripped && !phoneList.includes('+91' + stripped)) {
      phoneList.push('+91' + stripped);
    }

    const handleUpdate = (supaOrders: any[]) => {
        try {
          const mergedOrders = [...supaOrders];

          // Sort descending by createdAt date in memory
          mergedOrders.sort((a, b) => {
            const getVal = (item: any) => {
              if (item.createdAt?.seconds) return item.createdAt.seconds;
              if (item.createdAt?.toDate && typeof item.createdAt.toDate === 'function') {
                try { return item.createdAt.toDate().getTime() / 1000; } catch (e) {}
              }
              if (item.createdAt instanceof Date) return item.createdAt.getTime() / 1000;
              if (typeof item.createdAt === 'string') {
                const parsed = Date.parse(item.createdAt);
                if (!isNaN(parsed)) return parsed / 1000;
              }
              return Date.now() / 1000; 
            };
            return getVal(b) - getVal(a);
          });

          const uniqueMergedMap = new Map();
          mergedOrders.forEach((o: any) => uniqueMergedMap.set(o.id, o));
          const finalMergedOrders = Array.from(uniqueMergedMap.values());

          finalMergedOrders.forEach(o => {
            const lastStatus = prevStatusesRef.current[o.id];
            if (lastStatus && lastStatus !== o.status) {
              toast.success(`Hooray! Order status updated to "${o.status}"`, {
                icon: '🔔',
                duration: 6000
              });
            }
            prevStatusesRef.current[o.id] = o.status;
          });

          if (Object.keys(prevStatusesRef.current).length === 0) {
            finalMergedOrders.forEach(o => {
              prevStatusesRef.current[o.id] = o.status;
            });
          }

          globalActiveOrdersCache = finalMergedOrders; // Cache update!
          setOrders(finalMergedOrders);
          setLoading(false);
        } catch (err) {
          console.error("Error sorting and merging orders in memory:", err);
          setLoading(false);
        }
    };

    let isMounted = true;
    let sub: any;
    const fetchOrders = async () => {
       try {
          const { supabase } = await import('../services/supabase');
          if (!supabase || !isMounted) { if(isMounted) { setOrders([]); setLoading(false); } return; }

          const phoneList = [user.phone];
          const stripped = user.phone.replace(/\D/g, '').slice(-10);
          if (stripped && !phoneList.includes(stripped)) phoneList.push(stripped);
          if (stripped && !phoneList.includes('+91' + stripped)) phoneList.push('+91' + stripped);

          const orQuery = [];
          if (currentUid) orQuery.push(`userId.eq.${currentUid}`);
          if (phoneList.length > 0) {
             orQuery.push(`customerPhone.in.(${phoneList.map(p=>`"${p}"`).join(',')})`);
          }

          if (orQuery.length > 0) {
              const { data } = await supabase.from('orders')
                .select('*')
                .or(orQuery.join(','))
                .not('status', 'eq', 'Delivered')
                .not('status', 'eq', 'delivered')
                .not('status', 'eq', 'Cancelled')
                .not('status', 'eq', 'cancelled')
                .not('status', 'eq', 'Rejected')
                .not('status', 'eq', 'rejected');
              if (data && isMounted) handleUpdate(data);

              if (isMounted) {
                  sub = supabase.channel(`user_orders_${Math.random()}`)
                     .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
                         if (!isMounted) return;
                         
                         // Fetch latest active orders (excluding delivered/cancelled)
                         const { data: updated } = await supabase.from('orders')
                           .select('*')
                           .or(orQuery.join(','))
                           .not('status', 'eq', 'Delivered')
                           .not('status', 'eq', 'delivered')
                           .not('status', 'eq', 'Cancelled')
                           .not('status', 'eq', 'cancelled')
                           .not('status', 'eq', 'Rejected')
                           .not('status', 'eq', 'rejected');
                         if (updated && isMounted) handleUpdate(updated);

                         // If an active order transitioned to a final status (Delivered/Cancelled/Rejected),
                         // we handle the toast and immediately add/update it in the local history cache so it shows up in History!
                         if (payload.new && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                            const o = payload.new;
                            const isHistorical = ['Delivered', 'delivered', 'Cancelled', 'cancelled', 'Rejected', 'rejected'].includes(o.status);
                            
                            if (isHistorical) {
                               // Show status change toast if we tracked its previous state
                               const lastStatus = prevStatusesRef.current[o.id];
                               if (lastStatus && lastStatus !== o.status) {
                                  toast.success(`Hooray! Order status updated to "${o.status}"`, {
                                    icon: '🔔',
                                    duration: 6000
                                  });
                               }
                               prevStatusesRef.current[o.id] = o.status;

                               // Prepend directly to history list and state/cache
                               setDbHistoryOrders(prev => {
                                  const exists = prev.some(item => item.id === o.id);
                                  if (!exists) {
                                     const updatedHistory = [o, ...prev];
                                     globalHistoryOrdersCache = updatedHistory;
                                     return updatedHistory;
                                  } else {
                                     const updatedHistory = prev.map(item => item.id === o.id ? o : item);
                                     globalHistoryOrdersCache = updatedHistory;
                                     return updatedHistory;
                                  }
                               });
                            }
                         }
                     }).subscribe();
              }
          }
       } catch(e) {
          console.error("Supabase load failed", e);
          if (isMounted) setLoading(false);
       }
    };
    fetchOrders();

    return () => {
      isMounted = false;
      if (sub) {
        import('../services/supabase').then(({ supabase }) => {
          if (supabase) supabase.removeChannel(sub);
        });
      }
    };
  }, [user.isLoggedIn, user.phone, firebaseAuthReady]);

  if (!user.isLoggedIn) {
     return (
        <div className="flex flex-col items-center justify-center h-[70vh] px-10 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-[2.5rem] flex items-center justify-center mb-8 border border-gray-200">
                <ShoppingBag className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-base font-black text-gray-900 tracking-wider uppercase">My Orders</h3>
            <p className="text-[8.5px] text-gray-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">Please login to view your order history.</p>
        </div>
     );
  }

  if (loading && orders.length === 0) {
    return (
        <div className="pb-32 px-1 pt-10">
          <div className="mb-8 px-2 flex justify-between items-center relative z-40">
            <div>
              <h2 className="text-base font-black text-gray-900 tracking-wider uppercase">My Orders</h2>
              <p className="text-[8.5px] text-gray-400 font-extrabold uppercase tracking-widest mt-1 leading-none">
                Fetching Data...
              </p>
            </div>
          </div>
          
          <div className="space-y-4 max-w-lg mx-auto w-full px-2">
            {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm animate-pulse relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-2xl"></div>
                            <div className="space-y-2">
                                <div className="h-3.5 bg-gray-200 rounded w-24"></div>
                                <div className="h-2.5 bg-gray-100 rounded w-16"></div>
                            </div>
                        </div>
                        <div className="w-20 h-7 bg-amber-50 rounded-xl"></div>
                    </div>
                    
                    <div className="my-6 px-1">
                        <div className="relative flex justify-between items-center w-full">
                            <div className="absolute left-3 right-3 top-4 h-[3px] bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
                            {[1, 2, 3, 4, 5].map((step) => (
                                <div key={step} className="flex flex-col items-center flex-1 relative z-10">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center">
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded w-10 mt-2"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gray-200 rounded-full shrink-0"></div>
                            <div className="h-2.5 bg-gray-200 rounded w-full"></div>
                        </div>
                        <div className="h-9 bg-gray-200 rounded-xl w-full mt-3"></div>
                        <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
                            <div className="space-y-1.5">
                                <div className="h-2.5 bg-gray-200 rounded w-20"></div>
                                <div className="h-4 bg-emerald-100 rounded w-16"></div>
                            </div>
                            <div className="h-8 bg-emerald-50 rounded-xl w-24"></div>
                        </div>
                    </div>
                </div>
            ))}
          </div>
        </div>
    );
  }

  const groupClientOrders = (rawOrders: any[]): any[] => {
    const groupedMap: { [baseId: string]: any } = {};

    rawOrders.forEach(order => {
      if (!order || !order.id) return;
      const orderIdStr = String(order.id);
      const parts = orderIdStr.split('_');
      
      // Format: c_timestamp_random_index
      const isSplit = parts.length >= 4 && parts[0] === 'c';
      const baseId = isSplit ? parts.slice(0, 3).join('_') : orderIdStr;

      if (!groupedMap[baseId]) {
        groupedMap[baseId] = {
          ...order,
          id: baseId,
          subOrders: [order]
        };
      } else {
        groupedMap[baseId].subOrders.push(order);
      }
    });

    return Object.values(groupedMap).map(group => {
      if (group.subOrders.length === 1) {
        return group.subOrders[0];
      }

      const subOrders = group.subOrders;

      // Status precedence: Received/Pending/Receipt (0) < Preparing (1) < Packed (2) < Out for Delivery (3) < Delivered (4)
      const getStatusRank = (statusStr: string) => {
        const norm = String(statusStr || '').trim().toLowerCase();
        if (norm === 'delivered') return 4;
        if (norm === 'out for delivery') return 3;
        if (norm === 'packed') return 2;
        if (norm === 'preparing') return 1;
        return 0;
      };

      // Lowest status of sub-orders determines the combined status
      let overallStatus = subOrders[0].status;
      let minRank = getStatusRank(overallStatus);
      
      subOrders.forEach((so: any) => {
        const r = getStatusRank(so.status);
        if (r < minRank) {
          minRank = r;
          overallStatus = so.status;
        }
      });

      // Combine unique products safely
      const mergedItems: any[] = [];
      subOrders.forEach((so: any) => {
        const itemsList = Array.isArray(so.items) ? so.items : [];
        itemsList.forEach((item: any) => {
          if (!item) return;
          const existing = mergedItems.find(mi => mi.id === item.id || mi.name === item.name);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
          } else {
            mergedItems.push({ ...item });
          }
        });
      });

      // Sum all numeric/amount values
      const totalAmount = subOrders.reduce((sum: number, so: any) => sum + Number(so.totalAmount || 0), 0);
      const deliveryCharge = subOrders.reduce((sum: number, so: any) => sum + Number(so.deliveryCharge || 0), 0);
      const platformFee = subOrders.reduce((sum: number, so: any) => sum + Number(so.platformFee || 0), 0);
      const finalAmount = subOrders.reduce((sum: number, so: any) => sum + Number(so.finalAmount || 0), 0);

      // Extract delivery OTP
      const firstOtp = subOrders.find((so: any) => so.deliveryOtp)?.deliveryOtp || null;

      // Extract driver details
      const partnerWithPhone = subOrders.find((so: any) => so.partnerPhone);
      const partnerName = partnerWithPhone?.partnerName || null;
      const partnerPhone = partnerWithPhone?.partnerPhone || null;

      return {
        ...subOrders[0],
        id: group.id,
        status: overallStatus,
        items: mergedItems,
        totalAmount,
        deliveryCharge,
        platformFee,
        finalAmount,
        deliveryOtp: firstOtp,
        partnerName,
        partnerPhone,
        isCombined: true,
        subOrders
      };
    }).sort((a, b) => {
      const getVal = (item: any) => {
        if (item.createdAt?.seconds) return item.createdAt.seconds;
        if (item.createdAt?.toDate && typeof item.createdAt.toDate === 'function') {
          try { return item.createdAt.toDate().getTime() / 1000; } catch (e) {}
        }
        if (item.createdAt instanceof Date) return item.createdAt.getTime() / 1000;
        if (typeof item.createdAt === 'string') {
          const parsed = Date.parse(item.createdAt);
          if (!isNaN(parsed)) return parsed / 1000;
        }
        return Date.now() / 1000; 
      };
      return getVal(b) - getVal(a);
    });
  };

  const downloadOrderHistory = () => {
    const groupedOrders = groupClientOrders(orders);
    if (groupedOrders.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Order History Summary", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Customer: ${user.name || 'Valued Customer'}`, 14, 30);
    doc.text(`Phone: ${user.phone}`, 14, 36);
    doc.text(`Exported On: ${new Date().toLocaleDateString()}`, 14, 42);

    const tableColumn = ["Date", "Order ID", "Items", "Status", "Amount"];
    const tableRows: any[] = [];

    groupedOrders.forEach(order => {
        let dateObj = null;
        if (order.createdAt?.seconds) {
            dateObj = new Date(order.createdAt.seconds * 1000);
        } else if (order.createdAt instanceof Date) {
            dateObj = order.createdAt;
        } else if (typeof order.createdAt === 'string') {
            dateObj = new Date(order.createdAt);
        }
        
        const orderDate = dateObj ? dateObj.toLocaleDateString() : 'N/A';
        const orderId = order.id.slice(-8).toUpperCase();
        const itemCount = order.items?.length || 0;
        const amountValue = order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0));
        const amount = `Rs. ${amountValue || 0}`;
        const status = order.status;

        tableRows.push([orderDate, orderId, itemCount, status, amount]);
    });

    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [4, 51, 21] },
      styles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [240, 245, 240] }
    });

    doc.save(`grezto_orders_${user.phone || 'history'}.pdf`);
  };

  const pendingOrders = groupClientOrders(orders.filter(
    o => o.status !== 'Delivered' && o.status !== 'delivered' && o.status !== 'Cancelled' && o.status !== 'cancelled' && o.status !== 'Rejected' && o.status !== 'rejected'
  ));

  const historyOrders = groupClientOrders(dbHistoryOrders);

  const displayedOrders = viewTab === 'pending' ? pendingOrders : historyOrders;
  const paginatedOrders = viewTab === 'history' ? displayedOrders : displayedOrders;
  const hasMoreHistory = viewTab === 'history' ? hasMoreHistoryFromServer : false;

  return (
    <div className="pb-32 px-1 pt-10">
      <div className="mb-8 px-2 flex justify-between items-center relative z-40">
        <div className="flex items-center gap-3">
          {viewTab === 'history' && (
            <button 
              id="history-back-arrow-btn"
              onClick={() => setViewTab('pending')}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full cursor-pointer active:scale-95 transition-all flex items-center justify-center border border-slate-200/50 shadow-sm"
              title="Go Back"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
            </button>
          )}
          <div>
            <h2 className="text-base font-black text-gray-900 tracking-wider uppercase">My Orders</h2>
            <p className="text-[8.5px] text-gray-400 font-extrabold uppercase tracking-widest mt-1 leading-none">
              {viewTab === 'pending' ? 'Active Status' : 'Order History'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative">
          {orders.length > 0 && (
            <button 
              onClick={downloadOrderHistory}
              className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/60 rounded-xl px-3 py-2 cursor-pointer shadow-sm active:scale-95 transition-all text-left"
            >
              <Download size={15} className="stroke-[2.5]" />
              <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Summary PDF</span>
              <span className="text-[9px] font-black uppercase tracking-widest sm:hidden">PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Indicator of tab state is now a clean back-arrow in the header */}

      <div className="space-y-4">
        {paginatedOrders.length === 0 ? (
           <motion.div 
             initial={{ y: 15, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="bg-white p-8 rounded-[2.5rem] border border-gray-100 flex flex-col items-center text-center shadow-lg shadow-gray-100/40 relative overflow-hidden"
           >
                {/* Decorative absolute background shape */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-full opacity-50 pointer-events-none" />
                
                <div className="w-20 h-20 bg-emerald-50/70 rounded-[1.8rem] flex items-center justify-center mb-6 shadow-inner border border-emerald-100">
                    <ShoppingBag className="w-8 h-8 text-emerald-600 animate-bounce duration-[2000ms]" />
                </div>
                
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">
                  {viewTab === 'pending' ? 'No Active Orders!' : 'No History Yet!'}
                </h3>
                <p className="text-[10px] text-gray-400 font-extrabold uppercase mt-1 tracking-widest">
                  {viewTab === 'pending' ? 'You have no pending or live orders' : 'You have not completed any orders yet'}
                </p>
                
                <p className="text-xs text-gray-500 font-medium max-w-xs mt-4 leading-relaxed">
                  {viewTab === 'pending' 
                    ? 'Our kitchen/store is ready to accept warm organic food orders! Start checking out items in your cart.' 
                    : 'Once you place orders and they are successfully delivered by our riders, they will automatically instantly appear here.'}
                </p>

                {onNavigateToHome && (
                  <button
                    onClick={onNavigateToHome}
                    className="mt-6 w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-[11px] uppercase tracking-wider py-4 px-6 rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Start Shopping</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                )}
           </motion.div>
        ) : (
            <>
              {paginatedOrders.map(order => (
                  <OrderCard key={order.id} order={order} onTrackOrder={onTrackOrder} />
              ))}
              
              {hasMoreHistory && (
                <div 
                  ref={(node) => {
                    if (!node) return;
                    const observer = new IntersectionObserver((entries) => {
                      if (entries[0].isIntersecting && !isLoadingMore) {
                        handleLoadMore();
                      }
                    }, { threshold: 0.1 });
                    observer.observe(node);
                    return () => observer.disconnect();
                  }}
                  className="h-10 w-full flex items-center justify-center pt-2 pb-6"
                >
                    {isLoadingMore && (
                        <div className="flex items-center space-x-1.5 text-emerald-600 bg-emerald-50/40 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider">
                            <span className="w-2.5 h-2.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                            <span className="text-[8px]">Loading More...</span>
                        </div>
                    )}
                </div>
              )}
            </>
        )}
      </div>
    </div>
  );
}

const OrderCard = React.memo(({ order, onTrackOrder }: { order: any; onTrackOrder?: (order: any) => void; key?: any }) => {
    const isDelivered = order.status === 'Delivered';
    const [isExpanded, setIsExpanded] = useState(!isDelivered);
    const [showItemsList, setShowItemsList] = useState(false);

    // Watch the live order status and auto-collapse the order height ONLY after status becomes Delivered
    useEffect(() => {
        if (order.status === 'Delivered') {
            setIsExpanded(false);
        }
    }, [order.status]);

    const statusColors: any = {
        'Received': 'bg-blue-50 text-blue-500 border-blue-100',
        'Preparing': 'bg-amber-50 text-amber-500 border-amber-100',
        'Receipt Preparing': 'bg-blue-50 text-blue-500 border-blue-100',
        'Packed': 'bg-amber-50 text-amber-500 border-amber-100',
        'Out for Delivery': 'bg-purple-50 text-purple-500 border-purple-100',
        'Delivered': 'bg-emerald-50 text-emerald-500 border-emerald-100'
    };

    const statusIcons: any = {
        'Received': <Clock size={16} />,
        'Preparing': <Package size={16} />,
        'Receipt Preparing': <Clock size={16} />,
        'Packed': <Package size={16} />,
        'Out for Delivery': <Navigation size={16} className="animate-pulse" />,
        'Delivered': <CheckCircle2 size={16} />
    };

    const steps = ['Receipt', 'Preparing', 'Packed', 'Out for Delivery', 'Delivered'];
    
    const getStatusIndex = (currentStatus: string) => {
        switch (currentStatus) {
            case 'Received':
            case 'Pending':
            case 'Receipt':
            case 'Receipt Preparing': return 0;
            case 'Preparing': return 1;
            case 'Packed': return 2; 
            case 'Out for Delivery': return 3;
            case 'Delivered': return 4;
            default: return 0;
        }
    };

    const currentIndex = getStatusIndex(order.status);

    if (isDelivered && !isExpanded) {
        return (
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                layout
                onClick={() => setIsExpanded(true)}
                className="bg-white p-4.5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer flex justify-between items-center"
            >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100 flex-shrink-0">
                        <CheckCircle2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">Order #{order.id.slice(-6).toUpperCase()}</span>
                            <span className="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">Delivered 🎉</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider truncate">
                            ₹{order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0))} • {order.items?.length || 0} items • {typeof order.address === 'object' ? (order.address?.address || JSON.stringify(order.address)) : order.address}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Details</span>
                    <ChevronRight size={13} className="text-gray-400" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            layout
            className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
        >
            <div 
                onClick={() => { if (isDelivered) setIsExpanded(false); }}
                className={`flex justify-between items-start mb-4 ${isDelivered ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                title={isDelivered ? "Click to Collapse Details" : undefined}
            >
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100">
                        <ShoppingBag size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">Order #{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{order.createdAt?.toDate?.() ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {order.status !== 'Delivered' && order.deliveryOtp && (
                        <div className="bg-amber-50 border border-amber-200/80 text-black px-3 py-1.5 rounded-xl flex items-center space-x-1.5 shadow-xs">
                            <span className="text-[11px] leading-none text-black">🔑</span>
                            <span className="text-[8px] font-black uppercase text-black tracking-wider font-sans">OTP:</span>
                            <span className="font-mono font-black text-[10px] tracking-widest text-black">{order.deliveryOtp}</span>
                        </div>
                    )}
                    <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${statusColors[order.status] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                        {statusIcons[order.status] || <Clock size={14} />}
                        <span className="font-black text-[9px] uppercase tracking-wider">{order.status}</span>
                    </div>
                    {isDelivered && (
                        <div className="p-1.5 bg-gray-55 text-gray-400 rounded-lg hover:bg-gray-100 text-[8px] font-black uppercase tracking-wider flex items-center space-x-1">
                            <span>▲ Hide</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Gorgeous Status Stepper with real-time green line transition */}
            <div className="my-6 px-1">
                <div className="relative flex justify-between items-center w-full">
                    {/* Background grey line */}
                    <div className="absolute left-3 right-3 top-4 h-[3px] bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
                    
                    {/* Active green progress line */}
                    <div 
                        className="absolute left-3 top-4 h-[3px] bg-emerald-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-in-out" 
                        style={{ width: `${(currentIndex / (steps.length - 1)) * 92}%` }}
                    />

                    {/* Step items */}
                    {steps.map((step, idx) => {
                        const isCompleted = idx <= currentIndex;
                        const isActive = idx === currentIndex;
                        return (
                            <div key={step} className="flex flex-col items-center flex-1 relative z-10">
                                <div 
                                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                        isCompleted 
                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200' 
                                            : 'bg-white border-gray-200 text-gray-450'
                                    } ${isActive ? 'ring-4 ring-emerald-100 scale-105' : ''}`}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4 h-4 stroke-[3]" />
                                    ) : (
                                        <span className="text-[10px] font-bold">{idx + 1}</span>
                                    )}
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-wider mt-2 transition-colors ${
                                    isActive ? 'text-emerald-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                                }`}>
                                    {step === 'Out for Delivery' ? 'Out for Delivery' : step}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3 bg-gray-55/50 p-4 rounded-2xl border border-gray-100/50">
                <div className="flex items-center space-x-2">
                    <MapPin size={12} className="text-emerald-500 shrink-0" />
                    <p className="text-[9px] text-gray-500 font-bold uppercase truncate">{typeof order.address === 'object' ? (order.address?.address || JSON.stringify(order.address)) : order.address}</p>
                </div>
                <div className="mt-3 mb-2 flex justify-end">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowItemsList(true); }}
                        className="bg-black text-white hover:bg-zinc-900 border border-black px-3 py-1.5 rounded-xl active:scale-95 transition-all w-fit text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                        <ShoppingBag size={10} className="text-emerald-400" />
                        View Ordered Products
                    </button>
                </div>
                <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Total Amount</p>
                        <p className="text-sm font-black text-emerald-600">₹{order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0))}</p>
                    </div>
                    {order.status !== 'Delivered' ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onTrackOrder?.(order); }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[9px] uppercase tracking-widest py-2.5 px-4 rounded-xl border border-emerald-100/30 transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                        >
                            <span>Track Order ⚡</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-500 font-extrabold text-[9px] uppercase tracking-wider py-2.5 px-3.5 rounded-xl border border-gray-100 transition-colors cursor-pointer active:scale-95 border-0 focus:outline-none"
                        >
                            Collapse Details 🔼
                        </button>
                    )}
                </div>
            </div>

            <OrderedProductsModal 
                isOpen={showItemsList} 
                onClose={() => setShowItemsList(false)}
                items={order.items || []}
                totalAmount={order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0))}
            />

            {/* Grezto style Delivery partner information & dialing */}
            {order.partnerPhone && (
              <div className="mt-4 bg-emerald-500/[0.04] border border-emerald-500/10 p-4 rounded-[1.8rem] flex items-center justify-between shadow-xs animate-fade-in">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <span className="text-2xl shrink-0">🛵</span>
                  <div className="min-w-0">
                    <p className="text-[7px] text-gray-450 font-black uppercase tracking-widest leading-none">Assigned Delivery Partner</p>
                    <p className="text-[11.5px] font-black text-gray-800 tracking-tight mt-1">{order.partnerName || "Grezto Fleet Rider"}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    window.location.href = `tel:${order.partnerPhone}`;
                    toast.success(`Dialing Delivery Executive ${order.partnerName || ''}... 📞`);
                  }}
                  className="bg-white hover:bg-emerald-600/10 text-emerald-600 border border-emerald-200/50 px-3.5 py-2.5 rounded-xl text-[8.5px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 border-0 cursor-pointer"
                >
                  <Phone size={10} className="stroke-[2.5]" />
                  <span>Call Partner</span>
                </button>
              </div>
            )}

             {/* Delivery status indicator remains on progress stepper */}
        </motion.div>
    );
});
