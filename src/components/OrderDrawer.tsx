import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, CheckCircle, Clock, Truck, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useUser } from '../context/UserContext';

export default function OrderTrackingDrawer({ onClose }: { onClose: () => void }) {
  const { firebaseAuthReady, user } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const userPhone = localStorage.getItem('last_order_phone'); // Simple way to track user's orders

  useEffect(() => {
    if (!firebaseAuthReady || !supabase) return;
    const phoneNum = user.phone || userPhone || '';
    if (!phoneNum) return;

    let sub: any;

    const fetchOrders = async () => {
      try {
        const { data } = await supabase.from('orders').select('*').eq('customerPhone', phoneNum);
        if (data) processOrders(data);

        sub = supabase.channel('order_drawer_tracking')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customerPhone=eq.${phoneNum}` }, async () => {
             const { data: updated } = await supabase.from('orders').select('*').eq('customerPhone', phoneNum);
             if (updated) processOrders(updated);
          }).subscribe();
      } catch (err) {
        console.warn("Supabase OrderDrawer stream error:", err);
      }
    };
    fetchOrders();

    const processOrders = (rawOrders: any[]) => {
      let deduplicated = rawOrders.sort((a: any, b: any) => {
        const getVal = (item: any) => {
          if (typeof item.createdAt === 'string') {
            const parsed = Date.parse(item.createdAt);
            if (!isNaN(parsed)) return parsed / 1000;
          }
          return Date.now() / 1000; // Fallback to current time
        };
        return getVal(b) - getVal(a);
      });
      setOrders(deduplicated);
    };

    return () => {
       if (sub) sub.unsubscribe();
    };
  }, [userPhone, firebaseAuthReady, user.phone]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative bg-white w-full max-w-md rounded-t-[3rem] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">Order Status</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Updates for {userPhone || 'Recent Orders'}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {!userPhone || orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <ShieldAlert className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-loose">No active orders tracked.<br/>Place an order to see updates.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="p-5 bg-[#f8fafc] rounded-3xl border border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <StatusIcon status={order.status} />
                    <span className="text-[11px] font-black uppercase text-gray-700 tracking-wider">
                      {order.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-emerald-50">
                    ₹{order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0))}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500 line-clamp-1 italic">
                    {order.items?.map((i: any) => typeof i === 'string' ? i : i.name).join(', ')}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Ordered recently</p>
                </div>

                <div className="flex items-center bg-white p-3 rounded-2xl border border-gray-50">
                  <div className={`w-1.5 h-1.5 rounded-full mr-2 ${order.status === 'Delivered' ? 'bg-gray-300' : 'bg-emerald-500 animate-pulse'}`} />
                  <p className="text-[10px] font-medium text-gray-600">
                    {(order.status === 'Received' || order.status === 'Preparing' || order.status === 'Receipt Preparing') && 'Kitchen/Store is preparing your items'}
                    {order.status === 'Packed' && 'Your order is packed and ready to move'}
                    {order.status === 'Out for Delivery' && 'Runner is on the way to you'}
                    {order.status === 'Delivered' && 'Order completed. Enjoy!'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch(status) {
    case 'Received':
    case 'Preparing':
    case 'Receipt Preparing': return <Clock className="w-4 h-4 text-blue-500" />;
    case 'Packed': return <Package className="w-4 h-4 text-orange-500" />;
    case 'Out for Delivery': return <Truck className="w-4 h-4 text-purple-500" />;
    case 'Delivered': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    default: return <Clock className="w-4 h-4 text-gray-400" />;
  }
}
