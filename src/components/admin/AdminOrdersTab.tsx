import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { OrderAdminCard } from '../AdminOrderCard';

interface AdminOrdersTabProps {
  orders: any[];
  adminActiveOrders: any[];
  riders: any[];
  busyRiders: string[];
  updateOrderStatus: (id: string, status: string, handoffDetail?: any) => void;
  isHistory?: boolean;
  isLoadingActive?: boolean;
}

export default function AdminOrdersTab({
  orders,
  adminActiveOrders,
  riders,
  busyRiders,
  updateOrderStatus,
  isHistory = false,
  isLoadingActive = false,
}: AdminOrdersTabProps) {
  
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistoryData, setHasMoreHistoryData] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    // Only fetch if history is empty and we are switching to history tab
    if (isHistory && historyOrders.length === 0 && hasMoreHistoryData) {
      setPage(0);
      fetchHistory(true, 0);
    }
  }, [isHistory]);

  const fetchHistory = async (isInitial = false, pageIndex = 0) => {
    try {
      setIsLoadingMore(true);
      if (!supabase) throw new Error("Supabase is not initialized");
      
      const PAGE_SIZE = 15;
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['Delivered', 'delivered', 'Cancelled'])
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (!data || data.length < PAGE_SIZE) {
        setHasMoreHistoryData(false);
      }

      setHistoryOrders((prev) => {
        if (isInitial) return data || [];
        const existingIds = new Set(prev.map(i => i.id));
        const newOrders = (data || []).filter(h => !existingIds.has(h.id));
        return [...prev, ...newOrders];
      });
      setPage(pageIndex + 1);
    } catch (e) {
      console.warn("Error fetching history", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (isHistory && hasMoreHistoryData) {
      fetchHistory(false, page);
    }
  };

  const filteredOrdersList = useMemo(() => {
    const getOrderTime = (o: any) => {
      if (o.createdAt?.seconds) { return o.createdAt.seconds * 1000; }
      if (o.createdAt) { try { return new Date(o.createdAt).getTime(); } catch (e) {} }
      return 0; 
    };

    if (isHistory) {
      return [...historyOrders].sort((a, b) => getOrderTime(b) - getOrderTime(a));
    }

    return [...adminActiveOrders].sort((a, b) => getOrderTime(b) - getOrderTime(a));
  }, [adminActiveOrders, isHistory, historyOrders]);

  const displayedOrders = useMemo(() => {
    return filteredOrdersList;
  }, [filteredOrdersList]);

  const hasMoreHistory = isHistory && hasMoreHistoryData;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-450 animate-pulse"></span>
          Order Monitor
        </h3>
        <div className="flex items-center space-x-2">
          {!isHistory && (
            <div className="flex items-center space-x-2 bg-emerald-950/20 border border-emerald-500/25 px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></div>
              <span className="text-[8px] font-black text-emerald-400 tracking-wider uppercase">Live Stream</span>
            </div>
          )}
          {isHistory && (
            <div className="flex items-center space-x-2 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
              <span className="text-[8px] font-black text-gray-500 tracking-wider uppercase">Archive Connected</span>
            </div>
          )}
        </div>
      </div>
      
      {(!isHistory && isLoadingActive && displayedOrders.length === 0) || (isHistory && isLoadingMore && displayedOrders.length === 0) ? (
        <div className="space-y-4 px-1">
          {[1, 2, 3].map((i) => (
             <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                   <div className="space-y-2">
                     <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse"></div>
                     <div className="h-3 w-24 bg-slate-100 rounded-md animate-pulse"></div>
                   </div>
                   <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-12 w-full bg-slate-50 rounded-xl animate-pulse mt-1"></div>
             </div>
          ))}
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="text-center py-20 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
           {isHistory ? "No history found" : "No orders yet"}
        </div>
      ) : (
        displayedOrders.map((order) => (
          <OrderAdminCard 
            key={order.id}
            id={order.id}
            name={order.customerName} 
            amount={order.totalAmount || order.amount} 
            status={order.status} 
            items={order.items && typeof order.items[0] === 'object' ? order.items.map((i: any) => `${i.quantity || 1}x ${i.name} [${i.shopName || 'Grezto Shop'}]`) : (order.fullItems ? order.fullItems.map((i: any) => `${i.quantity || 1}x ${i.name} [${i.shopName || 'Grezto Shop'}]`) : (order.items?.map((i: any) => typeof i === 'string' ? i : i.name) || []))} 
            phone={order.phone}
            address={order.address}
            partnerPhone={order.partnerPhone}
            partnerName={order.partnerName}
            riders={riders}
            busyRiders={busyRiders}
            onUpdateStatus={(status: string, riderDetail?: any) => updateOrderStatus(order.id, status, riderDetail)}
            rawOrder={order}
          />
        ))
      )}

      {hasMoreHistory && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-2 pb-6 flex justify-end pr-2"
        >
          <button
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            className="px-3 py-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-100/60 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                <span className="text-[8px]">Loading...</span>
              </>
            ) : (
              <>
                <span>Load More</span>
                <ChevronRight size={11} className="stroke-[3]" />
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}
