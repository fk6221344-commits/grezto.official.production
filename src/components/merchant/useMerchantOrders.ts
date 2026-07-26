import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface ShopProps {
  id: string;
}

export function useMerchantOrders(shop: ShopProps, firebaseAuthReady: boolean) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [riders, setRiders] = useState<any[]>([]);
  const [busyRiders, setBusyRiders] = useState<string[]>([]);
  const [mapsAuthError, setMapsAuthError] = useState(Boolean((window as any).grezto_maps_auth_failed));
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleAuthFailed = () => setMapsAuthError(true);
    window.addEventListener('grezto-maps-auth-failed', handleAuthFailed);
    return () => window.removeEventListener('grezto-maps-auth-failed', handleAuthFailed);
  }, []);

  useEffect(() => {
    if (!firebaseAuthReady || !supabase) return;

    let sub: any;
    const fetchRiders = async () => {
       try {
         const { data } = await supabase.from('team').select('*').eq('role', 'Rider');
         if (data) setRiders(data);

         sub = supabase.channel('merchant_riders_stream')
           .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: "role=eq.Rider" }, async () => {
              const { data: updated } = await supabase.from('team').select('*').eq('role', 'Rider');
              if (updated) setRiders(updated);
           }).subscribe();
       } catch(e) {
         console.warn("Supabase team riders stream error:", e);
       }
    };
    fetchRiders();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [firebaseAuthReady]);

  // Global Busy Riders Calculation (derived from orders)
  useEffect(() => {
    if (!orders) return;
    const busyList: string[] = [];
    orders.forEach((o: any) => {
       const orderTime = new Date(o.createdAt || Date.now()).getTime();
       const elapsedMs = Date.now() - orderTime;
       if (elapsedMs > 16 * 60 * 60 * 1000) return;

       if (o.partnerPhone && o.status !== "Delivered" && o.status !== "Cancelled") {
         const clean = o.partnerPhone.replace(/\D/g, "").slice(-10);
         if (clean && !busyList.includes(clean)) busyList.push(clean);
       }
    });
    setBusyRiders(busyList);
  }, [orders]);

  // Listen for ALL orders for this merchant shop
  useEffect(() => {
    if (!firebaseAuthReady || !shop.id || !supabase) return;
    setLoading(true);
    
    let sub: any;

    const fetchOrders = async () => {
      try {
        const { data } = await supabase.from('orders').select('*').contains('shopIds', [shop.id]).order('createdAt', { ascending: false });
        if (data) processOrders(data);

        sub = supabase.channel('merchant_orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
             const { data: updated } = await supabase.from('orders').select('*').contains('shopIds', [shop.id]).order('createdAt', { ascending: false });
             if (updated) processOrders(updated);
          }).subscribe();
      } catch (err) {
        console.warn("Supabase merchant orders error:", err);
      } finally {
        setLoading(false);
      }
    };

    const processOrders = (rawOrders: any[]) => {
      const formatted = rawOrders.map((docs: any) => {
        const createdAtStr = new Date(docs.createdAt || Date.now()).toISOString();
        return { ...docs, parsedCreatedAt: createdAtStr };
      });
      formatted.sort((a, b) => b.parsedCreatedAt.localeCompare(a.parsedCreatedAt));
      setOrders(formatted);
    };

    fetchOrders();

    return () => {
       if (sub) sub.unsubscribe();
    };
  }, [shop.id, firebaseAuthReady]);

  // Handle Order status updates
  const handleUpdateStatus = async (orderId: string, newStatus: string, partnerInfo?: { name: string, phone: string, id?: string }) => {
    try {
      const isOutForDelivery = newStatus === 'Out for Delivery';
      const generatedOtp = isOutForDelivery ? String(100000 + Math.floor(Math.random() * 900000)) : undefined;

      // Optimistically update state
      const lastUnderscoreIndex = orderId.lastIndexOf('_');
      const basePrefix = lastUnderscoreIndex !== -1 ? orderId.substring(0, lastUnderscoreIndex) : null;

      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return { 
            ...o, 
            status: newStatus,
            ...(generatedOtp ? { deliveryOtp: generatedOtp } : {}),
            ...(newStatus === 'Out for Delivery' ? { riderAccepted: false, assignedAt: new Date().toISOString() } : {}),
            ...(partnerInfo ? { partnerName: partnerInfo.name, partnerPhone: partnerInfo.phone, riderAccepted: false, assignedAt: new Date().toISOString() } : {}) 
          };
        }
        if (basePrefix && o.id.startsWith(basePrefix + '_') && (newStatus === 'Out for Delivery' || partnerInfo)) {
          const assignedRiderName = partnerInfo?.name || "Assigned Rider";
          const assignedRiderPhone = partnerInfo?.phone || "";
          return {
            ...o,
            status: 'Out for Delivery',
            partnerName: assignedRiderName,
            partnerPhone: assignedRiderPhone,
            riderAccepted: false,
            assignedAt: new Date().toISOString(),
            deliveryOtp: o.deliveryOtp || String(100000 + Math.floor(Math.random() * 900000))
          };
        }
        return o;
      }));
      toast.success(`Order marked as: ${newStatus} 🎉`);

      // Update Supabase
      const updateData: any = { status: newStatus };
      if (newStatus === 'Out for Delivery') {
        updateData.riderAccepted = false;
        updateData.assignedAt = new Date().toISOString();
        if (generatedOtp) {
          updateData.deliveryOtp = generatedOtp;
        }
      }
      if (partnerInfo) {
        updateData.partnerName = partnerInfo.name;
        updateData.partnerPhone = partnerInfo.phone;
        updateData.riderAccepted = false;
        updateData.assignedAt = new Date().toISOString();
        if (generatedOtp) {
          updateData.deliveryOtp = generatedOtp;
        }
      }
      
      if (newStatus === 'Delivered' || newStatus === 'delivered') {
        updateData.deliveredAt = new Date().toISOString();
        updateData.riderFee = 20; // Updated base rider fee
      }

      if (supabase) {
        await supabase.from('orders').update(updateData).eq('id', orderId);

        // Multi-vendor auto-assignment logic
        const lastUnderscoreIndex = orderId.lastIndexOf('_');
        const basePrefix = lastUnderscoreIndex !== -1 ? orderId.substring(0, lastUnderscoreIndex) : null;
        if (basePrefix && basePrefix.startsWith('c_') && (newStatus === 'Out for Delivery' || partnerInfo)) {
          const { data: sisterOrders } = await supabase
            .from('orders')
            .select('id, status')
            .ilike('id', `${basePrefix}_%`)
            .neq('id', orderId);
          
          const activeSisterOrders = (sisterOrders || []).filter(
            (o: any) => o.status !== 'Delivered' && o.status !== 'delivered' && o.status !== 'Cancelled' && o.status !== 'cancelled'
          );
          
          if (activeSisterOrders.length > 0) {
            const assignedRiderName = partnerInfo?.name || updateData.partnerName || "Assigned Rider";
            const assignedRiderPhone = partnerInfo?.phone || updateData.partnerPhone || "";
            
            for (const sister of activeSisterOrders) {
              const sisterOtp = String(100000 + Math.floor(Math.random() * 900000));
              const sisterUpdate: any = {
                status: 'Out for Delivery',
                partnerName: assignedRiderName,
                partnerPhone: assignedRiderPhone,
                riderAccepted: false,
                assignedAt: new Date().toISOString(),
                deliveryOtp: sisterOtp
              };
              await supabase.from('orders').update(sisterUpdate).eq('id', sister.id);
              
              // Also notify for each sister order
              try {
                let orderForPush = orders.find((o) => o.id === sister.id);
                if (orderForPush) {
                   await fetch('/api/orders/notify', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ 
                       orderId: sister.id, 
                       amount: orderForPush.netTotal || orderForPush.totalAmount || 0,
                       customerName: orderForPush.customerName || 'Customer',
                       userId: orderForPush.userId || orderForPush.customerId,
                       status: 'Out for Delivery'
                     })
                   });
                }
              } catch (pushErr) {}
            }
            toast.success(`Connected order automatically assigned to ${assignedRiderName}! ⚡`);
          }
        }
      }
      
      // Attempt to trigger push notification
      try {
        let orderForPush = orders.find((o) => o.id === orderId);
        if (orderForPush) {
           await fetch('/api/orders/notify', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               orderId: orderId, 
               amount: orderForPush.netTotal || orderForPush.totalAmount || 0,
               customerName: orderForPush.customerName || 'Customer',
               userId: orderForPush.userId || orderForPush.customerId,
               status: newStatus
             })
           });
        }
      } catch (pushErr) {
         console.warn("Could not fire server push notification", pushErr);
      }
      
    } catch (err) {
      console.warn("Firestore order update failed (Offline/Permissions), handled gracefully:", err);
      try {
        const localHistory = JSON.parse(localStorage.getItem('grezto_local_order_history') || '[]');
        const idx = localHistory.findIndex((o: any) => o.id === orderId || o.clientOrderId === orderId);
        if (idx !== -1) {
          localHistory[idx].status = newStatus;
          if (partnerInfo) {
            localHistory[idx].partnerName = partnerInfo.name;
            localHistory[idx].partnerPhone = partnerInfo.phone;
          }
          localStorage.setItem('grezto_local_order_history', JSON.stringify(localHistory));
        }
      } catch (e) {}
    }
  };

  return {
    orders,
    setOrders,
    expandedOrderIds,
    setExpandedOrderIds,
    riders,
    busyRiders,
    mapsAuthError,
    handleUpdateStatus,
    loading
  };
}
