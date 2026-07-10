import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  Info, 
  ShieldCheck, 
  Package, 
  Clock, 
  CheckCircle2, 
  Navigation, 
  Trash2, 
  ArrowRight, 
  Flame, 
  Sparkles, 
  XCircle, 
  ChevronRight, 
  RefreshCw, 
  ShoppingBag 
} from 'lucide-react';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';
import { useUser } from '../context/UserContext';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface GlobalNotificationsModalProps {
  onClose: () => void;
  onTrackOrder?: (order: any) => void;
}

interface NotificationItem {
  id: string;
  type: 'order_status' | 'promo';
  title: string;
  message: string;
  time: string;
  timestamp: number;
  tag: string;
  tagBg: string;
  tagText: string;
  icon: React.ReactNode;
  iconBg: string;
  iconText: string;
  orderObj?: any;
}

export default function GlobalNotificationsModal({ onClose, onTrackOrder }: GlobalNotificationsModalProps) {
  const { user, firebaseAuthReady } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('grezto_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Catch native back button to close the notifications drawer cleanly
  useRegisterBackHandler(() => {
    onClose();
    return true;
  }, 45, []);

  // Fetch customer orders in real-time or on mount to generate live order statuses
  const fetchCustomerOrders = async () => {
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone) return;
    setLoading(true);
    try {
      const phoneList = [user.phone];
      const stripped = user.phone.replace(/\D/g, '').slice(-10);
      if (stripped && !phoneList.includes(stripped)) phoneList.push(stripped);
      if (stripped && !phoneList.includes('+91' + stripped)) phoneList.push('+91' + stripped);

      const orQuery = [];
      phoneList.forEach(p => {
        orQuery.push(`customerPhone.eq."${p}"`);
      });

      if (orQuery.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(orQuery.join(','))
        .order('createdAt', { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching orders for notifications:", error);
      } else if (data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Error query:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerOrders();

    // Subscribe to order status updates for real-time notifications inside the board
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone) return;
    let sub: any;

    const setupSubscription = async () => {
      const phoneList = [user.phone];
      const stripped = user.phone.replace(/\D/g, '').slice(-10);
      if (stripped && !phoneList.includes(stripped)) phoneList.push(stripped);

      sub = supabase.channel('notification_customer_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchCustomerOrders();
        })
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [firebaseAuthReady, user.isLoggedIn, user.phone]);

  // Helper to calculate time ago
  const getElapsedTime = (dateString: string) => {
    if (!dateString) return 'Just now';
    try {
      const parsedDate = new Date(dateString);
      const diffMs = Date.now() - parsedDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'Recently';
    }
  };

  // Process and generate the notification list dynamically
  const generateNotifications = (): NotificationItem[] => {
    const list: NotificationItem[] = [];

    // 1. Static/Promotional announcements
    const staticPromos: NotificationItem[] = [
      {
        id: 'promo_avocado',
        type: 'promo',
        title: 'Hass Avocados Fresh Stock Arrived! 🌿',
        message: 'Premium organic avocados seedless and raw sourced directly from lush organic farms of Assam is now live in store. Buy before stocks end!',
        time: 'Today',
        timestamp: Date.now() - 3600000, // 1h ago
        tag: 'SPECIAL ACCENT',
        tagBg: 'bg-amber-50 text-amber-700 border border-amber-100',
        tagText: 'text-amber-800',
        icon: <Sparkles className="w-4 h-4 text-amber-600" />,
        iconBg: 'bg-amber-100/80',
        iconText: 'text-amber-600'
      },
      {
        id: 'promo_express_30',
        type: 'promo',
        title: '30 Minutes Instant Dispatch Active! ⚡',
        message: 'Grezto guarantees fast hygienically packed local delivery to your doorstep in under half an hour across Kawarhagi region.',
        time: 'Yesterday',
        timestamp: Date.now() - 86400000, // 1d ago
        tag: 'EXPRESS ASSURANCE',
        tagBg: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
        tagText: 'text-emerald-800',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
        iconBg: 'bg-emerald-100/80',
        iconText: 'text-emerald-600'
      },
      {
        id: 'promo_welcome',
        type: 'promo',
        title: 'Welcome to Grezto Native Family! 🎉',
        message: 'Aapka custom organic daily grocery shopping engine is fully optimized. Explore and track your active fresh organic items smoothly.',
        time: '2 days ago',
        timestamp: Date.now() - 172800000,
        tag: 'SYSTEM WELCOME',
        tagBg: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
        tagText: 'text-indigo-800',
        icon: <Bell className="w-4 h-4 text-indigo-600" />,
        iconBg: 'bg-indigo-100/80',
        iconText: 'text-indigo-600'
      }
    ];

    staticPromos.forEach(promo => {
      if (!dismissedIds.includes(promo.id)) {
        list.push(promo);
      }
    });

    // 2. Generate dynamic order status notifications based on real order statuses
    orders.forEach(order => {
      const orderId = order.id;
      const status = order.status || 'Received';
      const orderNum = orderId.toString().slice(-6).toUpperCase();
      const timeAgo = getElapsedTime(order.createdAt);
      const timestamp = new Date(order.createdAt || Date.now()).getTime();

      let title = '';
      let message = '';
      let tag = '';
      let tagBg = '';
      let tagText = '';
      let icon = <Package className="w-4 h-4 text-blue-600" />;
      let iconBg = 'bg-blue-50';
      let iconText = 'text-blue-600';

      const showTrack = ['Received', 'Pending', 'Receipt Preparing', 'Accepted', 'Preparing', 'Out for Delivery'].includes(status);

      if (status === 'Received' || status === 'Pending' || status === 'Receipt Preparing') {
        title = `Order Received & Processing! 📦`;
        message = `Aapka order #${orderNum} successfully register ho gaya hai. Dukandaar jald hi ise accept karke packing shuru karega. Dhanyawad!`;
        tag = `ORDER CONFIRMED`;
        tagBg = 'bg-blue-50 text-blue-800 border border-blue-100';
        icon = <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
        iconBg = 'bg-blue-100/60';
      } else if (status === 'Accepted' || status === 'Preparing') {
        title = `Aapka Product Prepare Ho Raha Hai! 🍳`;
        message = `Aapka order #${orderNum} kitchen/store mein fully fresh pack kiya ja raha hai. Chef/Store manager is active. Live updates ready!`;
        tag = `KITCHEN ACTIVE`;
        tagBg = 'bg-amber-50 text-amber-800 border border-amber-100';
        icon = <Flame className="w-4 h-4 text-amber-600 animate-pulse" />;
        iconBg = 'bg-amber-100/60';
      } else if (status === 'Out for Delivery') {
        title = `Order Out For Delivery! 🚀`;
        message = `Super news! Aapka fresh organic order #${orderNum} delivery partner ke sath nikal chuka hai. Rider jald hi aapke doorstep par hoga.`;
        tag = `RIDER ON THE WAY`;
        tagBg = 'bg-emerald-50 text-emerald-800 border border-emerald-100 animate-pulse';
        icon = <Navigation className="w-4 h-4 text-emerald-600" />;
        iconBg = 'bg-emerald-100/60';
      } else if (status === 'Delivered' || status === 'delivered') {
        title = `Order Delivered Successfully! 🎉`;
        message = `Congratulations! Aapka fresh order #${orderNum} deliver ho gaya hai. organic ingredients ka aanand lein aur feedback share karein.`;
        tag = `SUCCESS DELIVERED`;
        tagBg = 'bg-slate-50 text-slate-800 border border-slate-200';
        icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
        iconBg = 'bg-emerald-100/50';
      } else if (status === 'Cancelled' || status === 'cancelled' || status === 'Rejected' || status === 'rejected') {
        title = `Order Cancelled or Returned ❌`;
        message = `Hamein khed hai ki order #${orderNum} cancel ho gaya hai. Kisi bhi prashn ya refund ke liye chat support par sampark karein.`;
        tag = `CANCELLED`;
        tagBg = 'bg-rose-50 text-rose-800 border border-rose-150';
        icon = <XCircle className="w-4 h-4 text-rose-600" />;
        iconBg = 'bg-rose-100/50';
      }

      const notifId = `order_${orderId}_${status}`;
      if (!dismissedIds.includes(notifId)) {
        list.push({
          id: notifId,
          type: 'order_status',
          title,
          message,
          time: timeAgo,
          timestamp,
          tag,
          tagBg,
          tagText,
          icon,
          iconBg,
          iconText,
          orderObj: order
        });
      }
    });

    // Sort notifications chronologically: most recent timestamp first
    return list.sort((a, b) => b.timestamp - a.timestamp);
  };

  const activeNotifications = generateNotifications();

  // Dismiss a single notification
  const handleDismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem('grezto_dismissed_notifications', JSON.stringify(updated));
    toast.success("Notification dismissed!", { icon: '🧹', duration: 2000 });
  };

  // Clear all notifications
  const handleClearAll = () => {
    if (activeNotifications.length === 0) return;
    const allIds = activeNotifications.map(n => n.id);
    const updated = [...dismissedIds, ...allIds];
    setDismissedIds(updated);
    localStorage.setItem('grezto_dismissed_notifications', JSON.stringify(updated));
    toast.success("All notifications cleared! 🍃", { duration: 2500 });
  };

  return (
    <motion.div 
      id="notification-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-end justify-center p-0 sm:p-4"
    >
      {/* Backdrop tap to close */}
      <div className="absolute inset-0 z-0" onClick={onClose} />

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-stone-50 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 pb-8 shadow-2xl relative z-10 flex flex-col max-h-[85vh] overflow-hidden border-t border-stone-100"
      >
        {/* Android Native Pill Indicator for drag down */}
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mb-4 flex-shrink-0 cursor-pointer" onClick={onClose} />

        {/* Header Block */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-stone-900 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-stone-950/10">
              <Bell className="w-5.5 h-5.5 animate-bounce stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-tight">Notification Center</h3>
              <p className="text-[9px] text-stone-400 font-extrabold uppercase tracking-widest mt-0.5">Live Updates & Special Stock</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {activeNotifications.length > 0 && (
              <button 
                type="button"
                onClick={handleClearAll}
                className="p-2 hover:bg-stone-100 text-stone-400 hover:text-red-600 rounded-xl transition-all cursor-pointer flex items-center justify-center border-0 bg-transparent text-[10px] font-black uppercase tracking-widest gap-1"
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose}
              className="w-10 h-10 bg-white hover:bg-stone-100 border border-stone-150 rounded-full flex items-center justify-center transition-transform active:scale-95 text-stone-500 cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Sync/Reload Banner */}
        {loading && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl p-3 text-center text-[10px] font-bold uppercase tracking-wider mb-4 animate-pulse flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Synchronizing live updates with cloud...
          </div>
        )}

        {/* Main scrollable body */}
        <div className="overflow-y-auto space-y-4 pr-1 pb-16 flex-grow scrollbar-none touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence initial={false}>
            {activeNotifications.length > 0 ? (
              activeNotifications.map((notif, idx) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 15, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30, delay: idx * 0.04 }}
                  onClick={() => {
                    // If it has orderObj and order status is active, allow tracking
                    if (notif.orderObj && onTrackOrder && ['Received', 'Pending', 'Receipt Preparing', 'Accepted', 'Preparing', 'Out for Delivery'].includes(notif.orderObj.status)) {
                      onTrackOrder(notif.orderObj);
                    }
                  }}
                  className={`p-4.5 rounded-[2rem] border relative overflow-hidden transition-all bg-white hover:shadow-md active:scale-99 cursor-pointer flex items-start gap-3.5 ${
                    notif.type === 'order_status' 
                      ? 'border-stone-200/60 shadow-sm shadow-stone-100/50' 
                      : 'border-amber-100/40 bg-gradient-to-br from-white to-amber-50/15 shadow-sm shadow-amber-100/10'
                  }`}
                >
                  {/* Left Icon with color accent */}
                  <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner ${notif.iconBg}`}>
                    {notif.icon}
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[8.5px] font-black tracking-widest uppercase rounded-lg px-2 py-0.5 border ${notif.tagBg}`}>
                        {notif.tag}
                      </span>
                      <span className="text-[9px] text-stone-400 font-extrabold tracking-wider">{notif.time}</span>
                    </div>

                    <h4 className="text-[12.5px] font-extrabold text-stone-900 mt-2 leading-snug tracking-tight">
                      {notif.title}
                    </h4>

                    <p className="text-[11.5px] text-stone-500 font-medium leading-relaxed mt-1.5 break-words">
                      {notif.message}
                    </p>

                    {/* Order Action block if active tracking is allowed */}
                    {notif.type === 'order_status' && onTrackOrder && ['Received', 'Pending', 'Receipt Preparing', 'Accepted', 'Preparing', 'Out for Delivery'].includes(notif.orderObj?.status) && (
                      <div className="mt-3.5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-700 font-black tracking-widest uppercase flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Live Tracking Active
                        </span>
                        <div className="text-[10.5px] font-black uppercase text-stone-900 tracking-wider flex items-center gap-1 hover:text-emerald-600 transition-colors">
                          <span>Track Order</span>
                          <ChevronRight className="w-3.5 h-3.5 text-inherit stroke-[2.5]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dismiss individual button on far top right */}
                  <button
                    type="button"
                    onClick={(e) => handleDismissNotification(notif.id, e)}
                    className="absolute top-4 right-4 w-6 h-6 rounded-full hover:bg-stone-50 text-stone-300 hover:text-stone-600 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-12 px-6"
              >
                <div className="w-20 h-20 bg-stone-100 text-stone-350 rounded-[2.2rem] flex items-center justify-center mb-5 border border-stone-200/50 shadow-inner">
                  <Bell className="w-10 h-10 stroke-[1.5]" />
                </div>
                <h4 className="text-sm font-black text-stone-900 uppercase tracking-tight">All Caught Up! 🍃</h4>
                <p className="text-[11px] font-bold text-stone-400 max-w-xs leading-relaxed mt-2 uppercase tracking-wide">
                  {user.isLoggedIn 
                    ? "Koi naya notification nahi hai. Jab aap order karenge, toh live updates yahan dikhenge!" 
                    : "Kripya profile me jakar login karein taaki aap apne active order updates yahan dekh sakein!"
                  }
                </p>
                {!user.isLoggedIn && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 bg-stone-900 hover:bg-stone-850 text-white text-[9px] font-black uppercase tracking-widest px-6 py-3.5 rounded-2xl active:scale-95 transition-all shadow-md shadow-stone-900/10 border-0 cursor-pointer"
                  >
                    Close & Explore
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
