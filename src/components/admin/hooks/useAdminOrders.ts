import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../../services/supabase";
import toast from "react-hot-toast";

export function useAdminOrders(isAuthenticated: boolean, firebaseAuthReady: boolean, adminSelectedCityFilter: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [busyRiders, setBusyRiders] = useState<string[]>([]);
  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(true);

  const [isLoadingActive, setIsLoadingActive] = useState(true);

  // Configuration listener
  useEffect(() => {
    if (!supabase) return;
    
    let sub: any;
    const fetchConfig = async () => {
      try {
        const { data } = await supabase.from('system_config').select('isSystemOnline').eq('id', 'config').single();
        if (data) {
          setIsSystemOnline(data.isSystemOnline !== false);
        }
      } catch (e) {}
    };

    fetchConfig();
    sub = supabase.channel('admin_system_config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config', filter: "id=eq.config" }, (payload) => {
        const data = payload.new as any;
        if (data) setIsSystemOnline(data.isSystemOnline !== false);
      }).subscribe();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  // Fetch all orders
  useEffect(() => {
    if (!isAuthenticated || !firebaseAuthReady || !supabase) return;
    
    let sub: any;
    
    const fetchOrders = async () => {
      try {
        setIsLoadingActive(true);
        const { data } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
        if (data) processOrders(data);

        sub = supabase.channel(`admin_all_orders_${Math.random()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
             const { data: updated } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
             if (updated) processOrders(updated);
          }).subscribe();
      } catch (err) {
        console.warn("Supabase admin orders error:", err);
      } finally {
        setIsLoadingActive(false);
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
  }, [isAuthenticated, firebaseAuthReady]);

  // Fetch all riders
  useEffect(() => {
    if (!isAuthenticated || !firebaseAuthReady || !supabase) return;

    let sub: any;
    const fetchRiders = async () => {
       try {
         const { data } = await supabase.from('team').select('*').eq('role', 'Rider');
         if (data) setRiders(data);

         sub = supabase.channel(`admin_riders_stream_${Math.random()}`)
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
  }, [isAuthenticated, firebaseAuthReady]);

  // Global Busy Riders Calculation (derived from orders)
  useEffect(() => {
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

  const adminActiveOrders = useMemo(() => {
    return orders.filter((o: any) => {
      let orderItems = o.items || o.fullItems || [];
      if (typeof orderItems === "string") {
        try {
          orderItems = JSON.parse(orderItems);
        } catch (e) {
          orderItems = [];
        }
      }
      if (!Array.isArray(orderItems)) orderItems = [];
      if (orderItems.length === 0) return true;
      const hasAdminItems = orderItems.some((item: any) => {
        const sId = item.shopId || item.productShopId;
        return !sId || sId === "admin" || sId === "direct" || sId === "";
      });
      return hasAdminItems;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (adminSelectedCityFilter === "All") return orders;
    return orders.filter((o: any) => {
      if (o.city) return o.city.toLowerCase() === adminSelectedCityFilter.toLowerCase();
      const addressStr = typeof o.address === 'object' ? (o.address?.address || "") : (o.address || "");
      const addressLower = String(addressStr).toLowerCase();
      return addressLower.includes(adminSelectedCityFilter.toLowerCase());
    });
  }, [orders, adminSelectedCityFilter]);

  const filteredAdminActiveOrders = useMemo(() => {
    if (adminSelectedCityFilter === "All") return adminActiveOrders;
    return adminActiveOrders.filter((o: any) => {
      if (o.city) return o.city.toLowerCase() === adminSelectedCityFilter.toLowerCase();
      const addressStr = typeof o.address === 'object' ? (o.address?.address || "") : (o.address || "");
      const addressLower = String(addressStr).toLowerCase();
      return addressLower.includes(adminSelectedCityFilter.toLowerCase());
    });
  }, [adminActiveOrders, adminSelectedCityFilter]);

  const filteredAdminActiveOrdersActive = useMemo(() => {
    return filteredAdminActiveOrders.filter((o: any) => o.status !== "Delivered" && o.status !== "delivered");
  }, [filteredAdminActiveOrders]);

  const filteredAdminActiveOrdersHistory = useMemo(() => {
    return filteredAdminActiveOrders.filter((o: any) => o.status === "Delivered" || o.status === "delivered");
  }, [filteredAdminActiveOrders]);

  const filteredOrdersActive = useMemo(() => {
    return filteredOrders.filter((o: any) => o.status !== "Delivered" && o.status !== "delivered");
  }, [filteredOrders]);

  const filteredOrdersHistory = useMemo(() => {
    return filteredOrders.filter((o: any) => o.status === "Delivered" || o.status === "delivered");
  }, [filteredOrders]);

  const adminActiveCount = adminActiveOrders.length;

  const filteredRiders = useMemo(() => {
    if (adminSelectedCityFilter === "All") return riders;
    return riders.filter((r: any) => r.city?.toLowerCase() === adminSelectedCityFilter.toLowerCase());
  }, [riders, adminSelectedCityFilter]);

  const updateOrderStatus = async (orderId: string, newStatus: string, rider?: { name: string; phone: string; id?: string }) => {
    const updateData: any = { status: newStatus };
    if (newStatus === "Out for Delivery") {
      updateData.partnerPhone = rider?.phone || "";
      updateData.partnerName = rider?.name || "";
      updateData.riderAccepted = false;
      updateData.assignedAt = new Date().toISOString();
      updateData.deliveryOtp = String(100000 + Math.floor(Math.random() * 900000));
    }
    if (newStatus === "Delivered" || newStatus === "delivered") {
       updateData.deliveredAt = new Date().toISOString();
       updateData.riderFee = 25;
    }

    const lastUnderscoreIndex = orderId.lastIndexOf('_');
    const basePrefix = lastUnderscoreIndex !== -1 ? orderId.substring(0, lastUnderscoreIndex) : null;

    setOrders((prev) => prev.map((o) => {
      if (o.id === orderId) {
        return { ...o, ...updateData };
      }
      if (basePrefix && o.id.startsWith(basePrefix + '_') && newStatus === 'Out for Delivery') {
        return {
          ...o,
          status: 'Out for Delivery',
          partnerName: updateData.partnerName,
          partnerPhone: updateData.partnerPhone,
          riderAccepted: false,
          assignedAt: updateData.assignedAt,
          deliveryOtp: o.deliveryOtp || String(100000 + Math.floor(Math.random() * 900000))
        };
      }
      return o;
    }));
    toast.success(`Order marked as: ${newStatus} 🎉`);
    try {
      if (!supabase) throw new Error("Supabase is not initialized");
      await supabase.from('orders').update(updateData).eq('id', orderId);

      if (basePrefix && basePrefix.startsWith('c_') && newStatus === 'Out for Delivery') {
        const { data: sisterOrders } = await supabase
          .from('orders')
          .select('id, status')
          .ilike('id', `${basePrefix}_%`)
          .neq('id', orderId);
        
        const activeSisterOrders = (sisterOrders || []).filter(
          (o: any) => o.status !== 'Delivered' && o.status !== 'delivered' && o.status !== 'Cancelled' && o.status !== 'cancelled'
        );
        
        if (activeSisterOrders.length > 0) {
          const assignedRiderName = updateData.partnerName || "Assigned Rider";
          const assignedRiderPhone = updateData.partnerPhone || "";
          
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
          }
          toast.success(`Connected order automatically assigned to ${assignedRiderName}! ⚡`);
        }
      }
    } catch (e: any) {
      console.warn("Failed to update status in cloud:", e);
      toast.error("Cloud update failed, check network.");
    }
  };

  const clearRiderAssignment = async (orderId: string) => {
    const updateData: any = { 
      status: "Packed",
      partnerPhone: null,
      partnerName: null,
      riderAccepted: false,
      assignedAt: null,
      deliveryOtp: null
    };

    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updateData } : o)));

    try {
      if (!supabase) throw new Error("Supabase is not initialized");
      await supabase.from('orders').update(updateData).eq('id', orderId);
    } catch (e: any) {
      console.warn("Failed to clear assignment in cloud:", e);
    }
  };

  return {
    orders,
    setOrders,
    riders,
    busyRiders,
    adminActiveOrders,
    filteredOrders,
    filteredAdminActiveOrders,
    filteredAdminActiveOrdersActive,
    filteredAdminActiveOrdersHistory,
    filteredOrdersActive,
    filteredOrdersHistory,
    adminActiveCount,
    filteredRiders,
    updateOrderStatus,
    clearRiderAssignment,
    isSystemOnline,
    isLoadingActive
  };
}
