import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { startRiderAlertAlarmLoop, stopRiderAlertAlarmLoop } from '../services/ringtoneService';
import { sendNativePushNotification } from '../services/notifications';
import { groupMultiVendorOrders } from '../utils/orderGrouping';

import { startContinuousCallVibration, stopContinuousCallVibration } from '../services/nativeService';
import toast from 'react-hot-toast';

const knownRiderIds = new Set<string>();

interface UseRiderOrdersProps {
  firebaseAuthReady: boolean;
  user: any;
}

export function useRiderOrders({
  firebaseAuthReady,
  user
}: UseRiderOrdersProps) {
  const [globalRiderProfile, setGlobalRiderProfile] = useState<any | null>(null);
  const [globalIncomingRiderOrders, setGlobalIncomingRiderOrders] = useState<any[]>([]);
  const [recentlyAcceptedIds, setRecentlyAcceptedIds] = useState<string[]>([]);

  // 1. Subscribe to Global Rider Profile (if role === 'Rider')
  useEffect(() => {
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone || !supabase) {
      setGlobalRiderProfile(null);
      setGlobalIncomingRiderOrders([]);
      return;
    }

    const cleanPhone = user.phone.replace(/\D/g, '').slice(-10);
    
    let sub: any;
    const fetchProfile = async () => {
       try {
          const { data } = await supabase.from('team')
             .select('*')
             .eq('phone', cleanPhone)
             .eq('role', 'Rider')
             .limit(1);
          
          if (data && data.length > 0) {
             setGlobalRiderProfile(data[0]);
          } else {
             setGlobalRiderProfile(null);
          }

          sub = supabase.channel('rider_profile')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: `phone=eq.${cleanPhone}` }, async () => {
                const { data: upData } = await supabase.from('team').select('*').eq('phone', cleanPhone).eq('role','Rider').limit(1);
                if (upData && upData.length > 0) setGlobalRiderProfile(upData[0]);
                else setGlobalRiderProfile(null);
             }).subscribe();
       } catch(e) {
          console.warn("Global Rider Profile subscription skipped:", e);
       }
    };
    fetchProfile();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [user.isLoggedIn, user.phone, firebaseAuthReady]);

  // 2. Subscribe to Unaccepted Out for Delivery Orders globally assigned to this active rider
  useEffect(() => {
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone || !globalRiderProfile || globalRiderProfile.status !== 'Online' || !supabase) {
      setGlobalIncomingRiderOrders([]);
      return;
    }

    const cleanRiderPhone = user.phone.replace(/\D/g, '').slice(-10);
    const matchPhones = [...new Set([cleanRiderPhone, user.phone])].filter(Boolean);

    let sub: any;
    const fetchOrders = async () => {
       try {
          const fetchCurrent = async () => {
              const { data } = await supabase.from('orders')
                 .select('*')
                 .eq('status', 'Out for Delivery');
              
              if (data) {
                 const currentOrders = data.filter((order: any) => 
                   !order.riderAccepted && 
                   (matchPhones.includes(order.partnerPhone) || 
                    (order.partnerPhone && matchPhones.some(p => order.partnerPhone.includes(p))))
                 );
                 
                 currentOrders.forEach((order: any) => {
                   if (order && order.id && !knownRiderIds.has(order.id)) {
                     knownRiderIds.add(order.id);
                     
                     // Check if it's a recent assignment
                     let isRecent = false;
                     if (order.assignedAt) {
                       const timeMs = typeof order.assignedAt === 'string' ? Date.parse(order.assignedAt) : order.assignedAt;
                       isRecent = (Date.now() - timeMs) < 90000; // 90 seconds
                     }
                     
                     if (isRecent) {
                       const shortId = String(order.id).slice(-5).toUpperCase();
                       sendNativePushNotification(
                         "🛵 NEW DELIVERY ASSIGNED!",
                         `Order #${shortId} is ready for pickup. Please accept quickly.`
                       );
                     }
                   }
                 });

                 setGlobalIncomingRiderOrders(currentOrders);
              }
          };

          await fetchCurrent();

          sub = supabase.channel('incoming_rider_orders')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
                await fetchCurrent();
             }).subscribe();

       } catch (error) {
          console.warn("Global rider orders query stream error:", error);
       }
    };
    fetchOrders();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [firebaseAuthReady, user.isLoggedIn, user.phone, globalRiderProfile?.status]);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (globalIncomingRiderOrders.length === 0) return;
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [globalIncomingRiderOrders.length]);

  const activeIncomingOrders = globalIncomingRiderOrders.filter((order: any) => {
    // If we recently accepted this order, ignore it completely
    if (recentlyAcceptedIds.includes(order.id)) return false;
    
    // Also, if this is a sister order of a recently accepted order, ignore it!
    const lastUnderscoreIndex = order.id.lastIndexOf('_');
    const basePrefix = lastUnderscoreIndex !== -1 ? order.id.substring(0, lastUnderscoreIndex) : null;
    if (basePrefix && basePrefix.startsWith('c_')) {
      if (recentlyAcceptedIds.some(id => id.startsWith(basePrefix))) return false;
    }

    if (!order.assignedAt) return true;
    let elapsedMs = 0;
    if (typeof order.assignedAt === 'string') {
       elapsedMs = Date.now() - new Date(order.assignedAt).getTime();
    } else {
       elapsedMs = Date.now() - order.assignedAt;
    }
    return elapsedMs < 60000;
  });

  // 3. Global Rider Call Sound Loop & Physical Vibe
  useEffect(() => {
    if (activeIncomingOrders.length === 0 || !globalRiderProfile || globalRiderProfile.status !== 'Online') {
      stopRiderAlertAlarmLoop();
      return;
    }

    startRiderAlertAlarmLoop();

    return () => {
      stopRiderAlertAlarmLoop();
    };
  }, [activeIncomingOrders.length, globalRiderProfile?.status]);

  // 4. Global Rider Acceptance Action handler
  const handleGlobalAcceptOrder = async (orderId: string, onAcceptSuccess?: () => void) => {
    // 🧹 Instantly stop the siren ringtone and clear native OS push notifications
    stopRiderAlertAlarmLoop(true);

    // Save locally instantly to hide from UI
    setRecentlyAcceptedIds(prev => [...prev, orderId]);
    setGlobalIncomingRiderOrders(prev => prev.filter(o => o.id !== orderId));

    try {
      if (!supabase) throw new Error("Supabase is not initialized");

      let basePrefix = null;
      if (orderId.startsWith('c_')) {
        const lastUnderscoreIndex = orderId.lastIndexOf('_');
        basePrefix = lastUnderscoreIndex !== -1 ? orderId.substring(0, lastUnderscoreIndex) : orderId;
      }

      const allIdsToUpdate: string[] = [orderId];

      if (basePrefix) {
        // Also add the prefix-based sister orders to local filters
        setGlobalIncomingRiderOrders(prev => prev.filter(o => !o.id.startsWith(basePrefix)));
        setRecentlyAcceptedIds(prev => [...prev, basePrefix]);

        const { data: sisterOrders } = await supabase
          .from('orders')
          .select('id, status')
          .ilike('id', `${basePrefix}_%`);

        if (sisterOrders && sisterOrders.length > 0) {
          const sisterIds = sisterOrders.map((s: any) => s.id);
          sisterIds.forEach(id => {
            if (!allIdsToUpdate.includes(id)) {
              allIdsToUpdate.push(id);
            }
          });
          setRecentlyAcceptedIds(prev => [...prev, ...sisterIds]);
        }
      }

      // Update ALL connected orders atomically in ONE single database query!
      await supabase.from('orders').update({
        riderAccepted: true,
        acceptedAt: new Date().toISOString()
      }).in('id', allIdsToUpdate);

      toast.success("Assignment Received! 🛵 Please complete the delivery route safely.", { duration: 4000 });
      if (onAcceptSuccess) {
        onAcceptSuccess();
      }
    } catch (err) {
      console.error("Global Accept Order error:", err);
      toast.error("Order acceptance failed. Please check your network connection.");
      
      // Rollback optimistic update on error
      setRecentlyAcceptedIds([]);
      if (user.phone) {
        const cleanRiderPhone = user.phone.replace(/\D/g, '').slice(-10);
        const matchPhones = [...new Set([cleanRiderPhone, user.phone])].filter(Boolean);
        const { data } = await supabase.from('orders').select('*').eq('status', 'Out for Delivery');
        if (data) {
           const currentOrders = data.filter((order: any) => 
             !order.riderAccepted && 
             (matchPhones.includes(order.partnerPhone) || 
              (order.partnerPhone && matchPhones.some(p => order.partnerPhone.includes(p))))
           );
           setGlobalIncomingRiderOrders(currentOrders);
        }
      }
    }
  };

  return {
    globalRiderProfile,
    globalIncomingRiderOrders: groupMultiVendorOrders(activeIncomingOrders),
    handleGlobalAcceptOrder
  };
}
