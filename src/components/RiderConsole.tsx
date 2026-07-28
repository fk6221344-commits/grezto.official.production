import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Phone, 
  Navigation, 
  ArrowRight, 
  ArrowLeft,
  Settings, 
  LogOut, 
  Activity, 
  Bike, 
  ToggleLeft, 
  ToggleRight, 
  DollarSign, 
  Wallet, 
  Star, 
  ShieldAlert, 
  ChevronRight, 
  Check, 
  X,
  Layers,
  HelpCircle,
  Compass,
  Zap,
  Info,
  History
} from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { useUser } from '../context/UserContext';
import confetti from 'canvas-confetti';
import RiderCoPilotAssist from './RiderCoPilotAssist';
import { RiderOrderCard } from './rider/RiderOrderCard';
import RiderSlideHistoryModal from './rider/RiderSlideHistoryModal';
import { StatusBadge } from './rider/RiderStatusBadge';
import { SwipeButton } from './rider/RiderSwipeButton';
import { RiderHeader } from './rider/RiderHeader';
import { RiderDetailsModal } from './rider/RiderDetailsModal';
import { RiderConfirmDeliveryModal } from './rider/RiderConfirmDeliveryModal';
import { RiderSuccessCelebrationModal } from './rider/RiderSuccessCelebrationModal';
import { unlockNotificationAudio } from '../services/notifications';
import { groupMultiVendorOrders } from '../utils/orderGrouping';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';

export default function RiderConsole({ onClose, initialProfile }: { onClose?: () => void; initialProfile?: any }) {
  const { user, logout } = useUser();
  const cleanPhone = user.phone.replace(/\D/g, '').slice(-10);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [coPilotOrder, setCoPilotOrder] = useState<any | null>(null);
  const [shopsFeed, setShopsFeed] = useState<any[]>([]);
  const [showRiderInfoMenu, setShowRiderInfoMenu] = useState(false);
  const [showRiderHistoryModal, setShowRiderHistoryModal] = useState(false);
  const [learningState, setLearningState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [learningTimer, setLearningTimer] = useState(3);

  // Subscribe to shops coordinates lookup list
  useEffect(() => {
    if (!supabase) return;
    let sub: any;
    const fetchShops = async () => {
      const { data } = await supabase.from('shops').select('*');
      if (data) setShopsFeed(data);
    };
    fetchShops();
    sub = supabase.channel('console_shops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
        fetchShops();
      }).subscribe();
    return () => { if (sub) sub.unsubscribe(); };
  }, []);

  // Rider Profile from Team Firestore, initialized to pre-loaded shell profile to avoid 0.1s flicker
  const [riderProfile, setRiderProfile] = useState<any | null>(initialProfile || null);
  const [updatingDuty, setUpdatingDuty] = useState(false);

  // Custom Modal State for Confirming Delivery
  const [orderToConfirm, setOrderToConfirm] = useState<any | null>(null);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState(false);

  // Celebration state
  const [celebrationData, setCelebrationData] = useState<{ orderId: string, customerName: string, amount: number } | null>(null);

  // Native back button interceptor for Rider Console subviews
  useRegisterBackHandler(() => {
    if (celebrationData) {
      setCelebrationData(null);
      return true;
    }
    if (orderToConfirm) {
      setOrderToConfirm(null);
      return true;
    }
    if (coPilotOrder) {
      setCoPilotOrder(null);
      return true;
    }
    if (selectedOrder) {
      setSelectedOrder(null);
      return true;
    }
    if (showRiderHistoryModal) {
      setShowRiderHistoryModal(false);
      return true;
    }
    if (showRiderInfoMenu) {
      setShowRiderInfoMenu(false);
      return true;
    }
    return false;
  }, 35, [
    celebrationData,
    orderToConfirm,
    coPilotOrder,
    selectedOrder,
    showRiderHistoryModal,
    showRiderInfoMenu
  ]);

  const pendingTabOrders = [...incomingOrders, ...activeOrders];

  // Audio ringtone + physical vibration are handled globally inside App.tsx to ensure immediate alarms on any page!
  useEffect(() => {
    console.log("RiderConsole loaded. Active assignments alerts are routed globally in App.tsx.");
    
    // Pre-emptive browser/Capacitor webview gesture unlock mechanism to guarantee 100% audio ringtone reliability
    const unlockChime = () => {
      try {
        unlockNotificationAudio();
        console.log("🛵 [Rider Console] User interaction detected, unlocked notification audio contexts!");
      } catch (e) {}
    };
    window.addEventListener('click', unlockChime, { passive: true });
    window.addEventListener('touchstart', unlockChime, { passive: true });
    return () => {
      window.removeEventListener('click', unlockChime);
      window.removeEventListener('touchstart', unlockChime);
    };
  }, []);

  // 1. Subscribe to Rider Profile inside 'team' collection
  useEffect(() => {
    if (!user.phone || !supabase) return;
    
    let sub: any;
    const fetchProfile = async () => {
      const { data } = await supabase.from('team').select('*').eq('phone', cleanPhone).eq('role', 'Rider').maybeSingle();
      if (data) setRiderProfile(data);
      else setRiderProfile(null);
    };
    fetchProfile();
    sub = supabase.channel('console_rider_profile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: `phone=eq.${cleanPhone}` }, () => {
         fetchProfile();
      }).subscribe();
    return () => { if (sub) sub.unsubscribe(); };
  }, [user.phone, cleanPhone])  // 2. Subscribe to assigned Orders
  useEffect(() => {
    if (!user.phone || !supabase) return;

    let sub: any;
    const fetchOrders = async () => {
       const matchPhones = [...new Set([cleanPhone, user.phone])].filter(Boolean);
       const { data } = await supabase.from('orders').select('*').in('partnerPhone', matchPhones);
       if (data) {
          const sortedRaw = [...data].sort((a: any, b: any) => {
             const getTime = (d: any) => d.createdAt ? new Date(d.createdAt).getTime() : 0;
             return getTime(b) - getTime(a);
          });
          
          const rawIncoming = sortedRaw.filter(o => String(o.status || '').toLowerCase().trim() === 'out for delivery' && !o.riderAccepted);
          const rawActive = sortedRaw.filter((o: any) => String(o.status || '').toLowerCase().trim() === 'out for delivery' && o.riderAccepted === true);
          const rawHistory = sortedRaw.filter((o: any) => String(o.status || '').toLowerCase().trim() === 'delivered');

          setIncomingOrders(groupMultiVendorOrders(rawIncoming));
          setActiveOrders(groupMultiVendorOrders(rawActive));
          setHistoryOrders(groupMultiVendorOrders(rawHistory));
       }
       setLoading(false);
    };
    fetchOrders();

    sub = supabase.channel('console_rider_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
         fetchOrders();
      }).subscribe();

    return () => { if (sub) sub.unsubscribe(); };
  }, [user.phone, cleanPhone]);

  // Action: Slide to Accept Order
  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (!supabase) throw new Error("Supabase is not initialized");

      const lastUnderscoreIndex = orderId.lastIndexOf('_');
      const basePrefix = orderId.startsWith('c_') && lastUnderscoreIndex !== -1 
        ? orderId.substring(0, lastUnderscoreIndex) 
        : orderId;

      const idsToUpdate = [orderId];
      if (basePrefix.startsWith('c_')) {
        const { data: sisterOrders } = await supabase
          .from('orders')
          .select('id')
          .ilike('id', `${basePrefix}_%`);
        if (sisterOrders && sisterOrders.length > 0) {
          const sisterIds = sisterOrders.map((s: any) => s.id);
          sisterIds.forEach(id => {
            if (!idsToUpdate.includes(id)) {
              idsToUpdate.push(id);
            }
          });
        }
        if (!idsToUpdate.includes(basePrefix)) {
          idsToUpdate.push(basePrefix);
        }
      }

      await supabase.from('orders').update({
        riderAccepted: true,
        acceptedAt: new Date().toISOString(),
        status: 'Out for Delivery'
      }).in('id', idsToUpdate);

      // Notify customer that it's out for delivery
      let orderForPush = incomingOrders.find((o) => o.id === orderId) || activeOrders.find((o) => o.id === orderId);
      if (orderForPush) {
         try {
           await fetch('/api/orders/notify', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               orderId: orderId, 
               amount: orderForPush.netTotal || orderForPush.totalAmount || 0,
               customerName: orderForPush.customerName || 'Customer',
               userId: orderForPush.userId || orderForPush.customerId,
               status: 'Out for Delivery'
             })
           });
         } catch (e) {
           console.warn("Push trigger failed for accept", e);
         }
      }

      toast.success("Assignment Received! 🛵 Please complete the delivery route safely.", { duration: 4000 });
    } catch (err) {
      console.error("Accept Order error:", err);
      toast.error("Order acceptance failed. Please check your network connection.");
    }
  };

  // Action: Open Co-Pilot Doorstep Assist directly via the Delivered button click
  const openDoorstepAssist = async (order: any, shopDetails: any) => {
    if (!order.deliveryOtp) {
      try {
        if (!supabase) throw new Error("Supabase is not initialized");
        const randomOtp = String(100000 + Math.floor(Math.random() * 900000));
        
        const idsToUpdate = [order.id];
        if (order.id.startsWith('c_') && !order.id.includes('_')) {
          const { data: sisterOrders } = await supabase
            .from('orders')
            .select('id')
            .ilike('id', `${order.id}_%`);
          if (sisterOrders && sisterOrders.length > 0) {
            idsToUpdate.push(...sisterOrders.map((s: any) => s.id));
          }
        }

        await supabase.from('orders').update({
          deliveryOtp: randomOtp
        }).in('id', idsToUpdate);

        order.deliveryOtp = randomOtp;
      } catch (err) {
        console.error("Failed to generate delivery secure OTP for assist:", err);
      }
    }
    setCoPilotOrder({ order, shopDetails });
  };

  // Action: Initiate Delivery confirmation & generate client secure OTP
  const initiateDeliveryConfirmation = async (order: any) => {
    setEnteredOtp('');
    setOtpError(false);
    setOrderToConfirm(order);

    if (!order.deliveryOtp) {
      try {
        if (!supabase) throw new Error("Supabase is not initialized");
        const randomOtp = String(100000 + Math.floor(Math.random() * 900000));
        
        const idsToUpdate = [order.id];
        if (order.id.startsWith('c_') && !order.id.includes('_')) {
          const { data: sisterOrders } = await supabase
            .from('orders')
            .select('id')
            .ilike('id', `${order.id}_%`);
          if (sisterOrders && sisterOrders.length > 0) {
            idsToUpdate.push(...sisterOrders.map((s: any) => s.id));
          }
        }

        await supabase.from('orders').update({
          deliveryOtp: randomOtp
        }).in('id', idsToUpdate);

        // Sync local confirmation details
        setOrderToConfirm({ ...order, deliveryOtp: randomOtp });
      } catch (err) {
        console.error("Failed to generate delivery secure OTP:", err);
      }
    }
  };

  // Payout register digital audio chime
  const playPayoutSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.24); // C6

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      setTimeout(() => {
        try {
          osc.stop();
          audioCtx.close();
        } catch (e) {}
      }, 700);
    } catch (e) {}
  };

  // Multiple salvos patakha confetti animation bursts
  const triggerCelebrateBurst = () => {
    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Left corner blast
      setTimeout(() => {
        confetti({
          particleCount: 70,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.8 }
        });
      }, 250);

      // Right corner blast
      setTimeout(() => {
        confetti({
          particleCount: 70,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.8 }
         });
      }, 450);
    } catch (e) {
      console.warn("Celebration confetti failed or blocked:", e);
    }
  };

  // Start 3-second learning flow
  const handleStartLearning = () => {
    setLearningState('loading');
    setLearningTimer(3);
    
    let currentCount = 3;
    const interval = setInterval(() => {
      currentCount -= 1;
      setLearningTimer(currentCount);
      if (currentCount <= 0) {
        clearInterval(interval);
        setLearningState('success');
      }
    }, 1005);
  };

  // Toggle Duty Online/Offline Status
  const handleToggleDuty = async () => {
    if (!riderProfile) {
      return toast.error("Rider profile match not found! Please check verification in the Admin Panel.");
    }
    
    setUpdatingDuty(true);
    const nextStatus = riderProfile.status === 'Online' ? 'Offline' : 'Online';
    
    try {
      const { callSecureGateway } = await import('../services/supabase');
      await callSecureGateway('update_rider_status', {
        p_rider_phone: riderProfile.phone,
        p_status: nextStatus
      });
      
      toast.success(
        nextStatus === 'Online' 
          ? "You are ONLINE! Ready to receive new orders. 🟢🛵" 
          : "You are now OFFLINE. Sweet dreams! 😴💤"
      );
    } catch (err) {
      console.error(err);
      toast.error("Issue updating status. Please try again.");
    } finally {
      setUpdatingDuty(false);
    }
  };

  // Safe Deliver Update Action
  const handleDeliverOrder = async () => {
    if (!orderToConfirm) return;

    if (enteredOtp !== orderToConfirm.deliveryOtp) {
      setOtpError(true);
      toast.error("Oops! Incorrect OTP entered. Please check with the customer to enter the correct OTP.");
      return;
    }

    setIsSubmittingDelivery(true);

    try {
      if (!supabase) throw new Error("Supabase is not initialized");

      const delCharge = Number(orderToConfirm.deliveryCharge || 0);
      const earnedFee = getRiderPayout(delCharge);
      
      const idsToUpdate = [orderToConfirm.id];
      if (orderToConfirm.id.startsWith('c_') && !orderToConfirm.id.includes('_')) {
        const { data: sisterOrders } = await supabase
          .from('orders')
          .select('id')
          .ilike('id', `${orderToConfirm.id}_%`);
        if (sisterOrders && sisterOrders.length > 0) {
          idsToUpdate.push(...sisterOrders.map((s: any) => s.id));
        }
      }

      await supabase.from('orders').update({
        status: 'Delivered', 
        deliveredAt: new Date().toISOString(),
        riderFee: earnedFee
      }).in('id', idsToUpdate);
      
      // Attempt to trigger push notification for delivery complete
      try {
         await fetch('/api/orders/notify', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             orderId: orderToConfirm.id, 
             amount: orderToConfirm.netTotal || orderToConfirm.totalAmount || 0,
             customerName: orderToConfirm.customerName || 'Customer',
             userId: orderToConfirm.userId || orderToConfirm.customerId,
             status: 'Delivered'
           })
         });
      } catch (pushErr) {
         console.warn("Could not fire server push notification", pushErr);
      }

      setHistoryOrders(prev => [{ ...orderToConfirm, status: 'Delivered', deliveredAt: new Date(), riderFee: earnedFee }, ...prev]);
      
      // Stop delivery confirmation modal and order highlights
      setOrderToConfirm(null);
      if (selectedOrder?.id === orderToConfirm.id) {
        setSelectedOrder(null);
      }

      // Play digital cash payout register chime
      playPayoutSound();

      // Trigger grand patakha confetti explosions
      triggerCelebrateBurst();

      // Show congratulations popup with ₹20 incentive
      setCelebrationData({
        orderId: orderToConfirm.id?.slice(-5).toUpperCase(),
        customerName: orderToConfirm.customerName || 'Loyal Client',
        amount: earnedFee
      });

      toast.success("Order delivered successfully! Congratulations! 🏆🎉");
    } catch (err) {
      console.error(err);
      toast.error("Issue updating status. Please verify again.");
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Helper inside Rider Workdesk
  const formatTime = (createdAt: any) => {
    if (!createdAt) return '--:--';
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (createdAt: any) => {
    if (!createdAt) return 'Today';
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1050) : new Date(createdAt);
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  // Helper to extract YYYY-MM-DD from order timestamp fields for settlement checks
  const getOrderDateKey = (o: any) => {
    const timestampField = o.createdAt || o.updatedAt;
    if (!timestampField) return '';
    let d: Date;
    if (timestampField.seconds) {
      d = new Date(timestampField.seconds * 1000);
    } else if (timestampField.toDate && typeof timestampField.toDate === 'function') {
      try { d = timestampField.toDate(); } catch (e) { d = new Date(timestampField); }
    } else {
      d = new Date(timestampField);
    }
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Earnings calculations - Lifetime Sync with Rider Management
  const calculatedEarnings = historyOrders.reduce((acc, order) => acc + Number(order.riderFee || getRiderPayout(Number(order.deliveryCharge || 0))), 0);
  const totalCompletedJobs = historyOrders.length;
  const totalDeliveryCharges = historyOrders.reduce((acc, order) => acc + Number(order.deliveryCharge || 0), 0);
  const remainingDeliveryCharges = totalDeliveryCharges - calculatedEarnings;
  const rawCodBalance = historyOrders.reduce((acc, order) => {
      const bill = Number(order.finalAmount || order.amount || order.billTotal || order.totalAmount || 0);
      return acc + (order.paymentMethod === 'Cash on Delivery' || order.paymentMethod === 'COD' ? bill : 0);
  }, 0) - Number(riderProfile?.totalCollectedCash || 0);
  const currentCodBalance = Math.max(0, rawCodBalance);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-50/70 flex flex-col font-sans overflow-hidden">
      
      {/* 1. Header & Duty Command Center */}
      <RiderHeader 
        onClose={onClose}
        riderProfile={riderProfile}
        user={user}
        updatingDuty={updatingDuty}
        showRiderInfoMenu={showRiderInfoMenu}
        setShowRiderInfoMenu={setShowRiderInfoMenu}
        setLearningState={setLearningState}
        setShowRiderHistoryModal={setShowRiderHistoryModal}
        handleToggleDuty={handleToggleDuty}
        calculatedEarnings={calculatedEarnings}
        totalCompletedJobs={totalCompletedJobs}
        currentCodBalance={currentCodBalance}
        remainingDeliveryCharges={remainingDeliveryCharges}
        totalDeliveryCharges={totalDeliveryCharges}
      />

      {/* 2. Main Desk List Feed */}
      <main className="flex-1 overflow-y-auto px-5 py-4 pb-28 max-w-xl mx-auto w-full space-y-4 scroll-smooth [webkit-overflow-scrolling:touch]">
        
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((skeleton) => (
               <div key={skeleton} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-50">
                    <div className="space-y-2">
                       <div className="flex items-center space-x-2">
                          <div className="w-10 h-4 bg-slate-100 rounded"></div>
                          <div className="w-16 h-3 bg-slate-100 rounded"></div>
                       </div>
                       <div className="w-32 h-5 bg-slate-200 rounded mt-2"></div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                       <div className="w-16 h-3 bg-slate-100 rounded"></div>
                       <div className="w-12 h-6 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 mb-5 p-3 bg-slate-50 rounded-2xl">
                     <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                     <div className="w-full space-y-2">
                        <div className="h-3.5 bg-slate-200 rounded w-full"></div>
                        <div className="h-3.5 bg-slate-200 rounded w-2/3"></div>
                     </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-2">
                     <div className="w-24 h-4 bg-slate-100 rounded"></div>
                     <div className="w-16 h-4 bg-slate-100 rounded"></div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                     <div className="h-12 bg-slate-100 rounded-xl flex-1"></div>
                     <div className="h-12 bg-slate-800 rounded-xl flex-[1.5]"></div>
                  </div>
               </div>
            ))}
          </div>
        ) : pendingTabOrders.length === 0 ? (
          <div className="py-16 bg-white rounded-[1.5rem] border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center">
             <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                <ShoppingBag size={24} />
             </div>
             <p className="text-[12px] font-black uppercase text-slate-800 tracking-wider">
                No pending assignments!
             </p>
             <p className="text-[10px] font-semibold text-slate-400 max-w-[200px] mt-1.5 leading-relaxed">
                Relax! Keep your duty online, you will be notified as soon as a new delivery assignment arrives.
             </p>
          </div>
        ) : (
          <div className="space-y-4">
             {pendingTabOrders.map((order: any) => (
                <RiderOrderCard
                  key={order.id}
                  order={order}
                  activeTab="pending"
                  shopsFeed={shopsFeed}
                  handleAcceptOrder={handleAcceptOrder}
                  openDoorstepAssist={openDoorstepAssist}
                  setSelectedOrder={setSelectedOrder}
                />
             ))}
          </div>
        )}
      </main>

      {/* 3. Modal: Detailed items list popup */}
      <RiderDetailsModal 
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        shopsFeed={shopsFeed}
      />

      {/* 4. Elegant custom Confirmation Modal (Avoids window.confirm blocked prompts) */}
      <RiderConfirmDeliveryModal 
        orderToConfirm={orderToConfirm}
        setOrderToConfirm={setOrderToConfirm}
        isSubmittingDelivery={isSubmittingDelivery}
        enteredOtp={enteredOtp}
        setEnteredOtp={setEnteredOtp}
        otpError={otpError}
        setOtpError={setOtpError}
        handleDeliverOrder={handleDeliverOrder}
        riderProfile={riderProfile}
      />

      {/* Global Out for Delivery call portals are handled globally inside App.tsx! */}

      {/* 6. High Payout Congratulations Pop-up with wallet vault transfer animation */}
      <RiderSuccessCelebrationModal 
        celebrationData={celebrationData}
        setCelebrationData={setCelebrationData}
      />

      <AnimatePresence>
        {coPilotOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2999]"
          >
            <RiderCoPilotAssist 
              order={coPilotOrder.order}
              shopDetails={coPilotOrder.shopDetails}
              onClose={() => setCoPilotOrder(null)}
              onComplete={async () => {
                setHistoryOrders(prev => [{ ...coPilotOrder.order, status: 'Delivered', deliveredAt: new Date() }, ...prev]);
                // Play payout sound
                playPayoutSound();
                
                // Show celebration popup in parent
                setCelebrationData({
                  orderId: coPilotOrder.order.id?.slice(-5).toUpperCase(),
                  customerName: coPilotOrder.order.customerName || 'Loyal Client',
                  amount: 20
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Modal: Rider History Console with Max 5 History Logs and a 3s Learn button */}
      <RiderSlideHistoryModal
        showRiderHistoryModal={showRiderHistoryModal}
        setShowRiderHistoryModal={setShowRiderHistoryModal}
        setLearningState={setLearningState}
        historyOrders={historyOrders}
        fetchRiderHistory={async () => {}}
        isLoadingHistory={false}
        hasMoreHistory={false}
      />

    </div>
  );
}
