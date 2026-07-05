import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { 
  startAlertAlarmLoop, 
  stopAlertAlarmLoop, 
  sendNativePushNotification 
} from '../services/notifications';
import { triggerNativeImpactVibration } from '../services/nativeService';
import toast from 'react-hot-toast';

interface UseOrderAlertsProps {
  firebaseAuthReady: boolean;
  user: any;
  userShop: any;
  activeMerchantShop: any;
  showRider: boolean;
  showAdmin: boolean;
  showMerchant: boolean;
}

export function useOrderAlerts({
  firebaseAuthReady,
  user,
  userShop,
  activeMerchantShop,
  showRider,
  showAdmin,
  showMerchant
}: UseOrderAlertsProps) {
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [alarmMuted, setAlarmMuted] = useState(() => {
    return localStorage.getItem('grezto_alarm_muted') === 'true';
  });
  const [activeRingCount, setActiveRingCount] = useState(0);

  const dismissedOrderIdsRef = useRef<Set<string>>(new Set());
  const activeUnacceptedCountRef = useRef<number>(0);

  useEffect(() => {
    localStorage.setItem('grezto_alarm_muted', String(alarmMuted));
  }, [alarmMuted]);

  // Keep all state references entirely active to clear closure issues
  const userRef = useRef(user);
  const userShopRef = useRef(userShop);
  const activeMerchantShopRef = useRef(activeMerchantShop);
  const alarmMutedRef = useRef(alarmMuted);
  const showRiderRef = useRef(showRider);
  const showAdminRef = useRef(showAdmin);
  const showMerchantRef = useRef(showMerchant);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { userShopRef.current = userShop; }, [userShop]);
  useEffect(() => { activeMerchantShopRef.current = activeMerchantShop; }, [activeMerchantShop]);
  useEffect(() => { alarmMutedRef.current = alarmMuted; }, [alarmMuted]);
  useEffect(() => { showRiderRef.current = showRider; }, [showRider]);
  useEffect(() => { showAdminRef.current = showAdmin; }, [showAdmin]);
  useEffect(() => { showMerchantRef.current = showMerchant; }, [showMerchant]);

  const getListenerShopId = () => {
    if (userShop?.id) return userShop.id;
    if (activeMerchantShop?.id) return activeMerchantShop.id;
    try {
      const saved = localStorage.getItem('grezto_active_merchant_shop');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.id;
      }
    } catch (e) {}
    return null;
  };

  const isStoreUser = user?.isAdmin || !!getListenerShopId();
  const shouldAlarmRing = !alarmMuted && activeRingCount > 0 && isStoreUser && !showRider;

  // Sound toggle reaction effect
  useEffect(() => {
    if (shouldAlarmRing) {
      startAlertAlarmLoop();
      requestWakeLock();
    } else {
      stopAlertAlarmLoop();
      releaseWakeLock();
    }

    return () => {
      stopAlertAlarmLoop();
      releaseWakeLock();
    };
  }, [shouldAlarmRing]);

  // Wake Lock Setup to keep app running without sleep/CPU dimming on native
  const wakeLockRef = useRef<any>(null);
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log("🔒 Screen Wake Lock acquired and active.");
      }
    } catch (err) {
      console.warn("Could not acquire Screen Wake Lock:", err);
    }
  };
  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log("🔓 Screen Wake Lock released.");
      }
    } catch (err) {
      console.warn("Could not release Screen Wake Lock:", err);
    }
  };

  // 2. Main Real-time Order Listener
  useEffect(() => {
    if (!firebaseAuthReady || !supabase) return;

    const targetShopId = getListenerShopId();
    if (!user.isAdmin && !targetShopId) {
      return; 
    }

    const allowedStatuses = ['Received', 'Pending', 'Accepted', 'Out for Delivery', 'Receipt Preparing'];
    
    let knownIds = new Set<string>();
    let initialLoaded = false;
    let sub: any;

    const processOrders = (rawCurrentOrders: any[], hasNew: boolean = false) => {
      const currentOrders = rawCurrentOrders.map(data => {
        const createdAtStr = new Date(data.createdAt || Date.now()).toISOString();
        return { ...data, parsedCreatedAt: createdAtStr } as any;
      });

      const isOrderMatchingActiveUserContext = (orderObj: any) => {
        const orderItems = orderObj?.items || orderObj?.fullItems || [];
        if (orderItems.length === 0) return false;

        const isMerchantItem = (item: any) => {
          const sId = item.shopId || item.productShopId;
          return sId && sId !== 'admin' && sId !== 'direct' && sId !== '';
        };

        const hasAdminItems = orderItems.some((item: any) => !isMerchantItem(item));

        // If this order contains admin items, and the logged in user is an Admin, they get the ringtone.
        if (hasAdminItems) {
          return !!userRef.current?.isAdmin;
        }

        // If it's a pure merchant order...
        const activeShopId = activeMerchantShopRef.current?.id || getListenerShopId();
        
        // If the user has a specific shop context open/active (either Admin viewing X, or Merchant X logged in)
        if (activeShopId) {
          return orderItems.some((item: any) => {
            const sId = item.shopId || item.productShopId;
            return sId === activeShopId;
          });
        }
        
        return false;
      };

      const filteredOrders = currentOrders.filter(order => {
        const orderStatus = order.status || 'Received';
        if (!allowedStatuses.includes(orderStatus)) return false;
        if (user.isAdmin) return true;

        const targetId = getListenerShopId();
        if (targetId) {
          if (!order.items || !Array.isArray(order.items)) return false;
          return order.items.some((item: any) => 
            item.shopId === targetId || item.productShopId === targetId
          );
        }
        return false;
      });

      filteredOrders.sort((a, b) => b.parsedCreatedAt.localeCompare(a.parsedCreatedAt));

      const unacceptedOrders = filteredOrders.filter(o => {
        const orderStatus = o.status || 'Received';
        return (orderStatus === 'Received' || orderStatus === 'Pending' || orderStatus === 'Receipt Preparing');
      });

      const activeUnaccepted = unacceptedOrders.filter(o => {
        const isNotDismissed = !dismissedOrderIdsRef.current.has(o.id);
        const matchesContext = isOrderMatchingActiveUserContext(o);
        return isNotDismissed && matchesContext;
      });

      setActiveRingCount(activeUnaccepted.length);
      activeUnacceptedCountRef.current = activeUnaccepted.length;

      if (incomingOrderAlert) {
        const matchingUpdated = currentOrders.find(o => o.id === incomingOrderAlert.id);
        if (matchingUpdated) {
          const status = matchingUpdated.status || 'Received';
          const isStillUnaccepted = (status === 'Received' || status === 'Pending' || status === 'Receipt Preparing');
          if (!isStillUnaccepted) {
            setIncomingOrderAlert(null);
            setShowOrderModal(false);
          }
        }
      }

      let freshOrdersToAlert: any[] = [];
      
      if (!initialLoaded) {
        filteredOrders.forEach(o => knownIds.add(o.id));
        initialLoaded = true;
      } else if (hasNew) {
         currentOrders.forEach(docData => {
            if (!knownIds.has(docData.id)) {
               const isOrderExtremelyRecent = (createdVal: any) => {
                 if (!createdVal) return true;
                 const orderTimeMs = Date.parse(createdVal);
                 if (isNaN(orderTimeMs)) return true;
                 const elapsedSeconds = (Date.now() - orderTimeMs) / 1000;
                 return elapsedSeconds >= -900 && elapsedSeconds <= 900;
               };

               const matchesOwner = isOrderMatchingActiveUserContext(docData);
               if (matchesOwner) {
                 const orderStatus = docData.status || 'Received';
                 if ((orderStatus === 'Received' || orderStatus === 'Pending' || orderStatus === 'Receipt Preparing') && isOrderExtremelyRecent(docData.createdAt)) {
                   freshOrdersToAlert.push(docData);
                 }
               }
            }
         });
      }

      if (hasNew && freshOrdersToAlert.length > 0) {
        const topNewOrder = freshOrdersToAlert[0];
        setIncomingOrderAlert(topNewOrder);
        knownIds.add(topNewOrder.id);

        sendNativePushNotification(
          "🚨 NEW ORDER FOR GREZTO!",
          `Received new order for ₹${topNewOrder.amount || topNewOrder.totalAmount} from ${topNewOrder.customerName}`,
          () => {
            setIncomingOrderAlert(topNewOrder);
          }
        );

        triggerNativeImpactVibration();
      } else if (activeUnaccepted.length > 0 && !incomingOrderAlert) {
        setIncomingOrderAlert(activeUnaccepted[0]);
      }

      if (activeUnaccepted.length === 0) {
        setIncomingOrderAlert(null);
        setShowOrderModal(false);
      }
      
      currentOrders.forEach(o => knownIds.add(o.id));
    };

    const fetchInitial = async () => {
      try {
        let q = supabase.from('orders').select('*');
        if (!user.isAdmin && targetShopId) {
           q = q.contains('shopIds', [targetShopId]);
        }
        const { data } = await q;
        if (data) processOrders(data, false);
      } catch (e) {
        console.warn("Error fetching initial orders:", e);
      }
    };

    fetchInitial();

    sub = supabase.channel('order_alerts_channel')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
          let q = supabase.from('orders').select('*');
          if (!user.isAdmin && targetShopId) {
             q = q.contains('shopIds', [targetShopId]);
          }
          const { data } = await q;
          if (data) processOrders(data, true);
       }).subscribe();

    return () => {
      if (sub) sub.unsubscribe();
      stopAlertAlarmLoop();
    };
  }, [firebaseAuthReady, user.isAdmin, userShop?.id, activeMerchantShop?.id, showAdmin, showMerchant]);

  return {
    incomingOrderAlert,
    setIncomingOrderAlert,
    showOrderModal,
    setShowOrderModal,
    alarmMuted,
    setAlarmMuted,
    dismissedOrderIdsRef
  };
}
