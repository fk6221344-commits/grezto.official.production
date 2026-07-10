import { useState, useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import { supabase } from '../../../services/supabase';
import { auth } from '../../../services/firebase';

export function useProfileStats() {
  const { user, firebaseAuthReady } = useUser();
  const [statsOrdersCount, setStatsOrdersCount] = useState<number>(0);
  const [statsDeliveredCount, setStatsDeliveredCount] = useState<number>(0);
  const [statsTotalSpent, setStatsTotalSpent] = useState<number>(0);

  useEffect(() => {
    if (!firebaseAuthReady) {
      return;
    }
    if (!user.isLoggedIn || !user.phone || !supabase) {
      setStatsOrdersCount(0);
      setStatsDeliveredCount(0);
      setStatsTotalSpent(0);
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

    const fetchOrdersForStats = async () => {
      try {
        let sbQuery = supabase.from('orders').select('*');
        if (currentUid) {
           sbQuery = sbQuery.or(`customerPhone.in.(${phoneList.map(p=>`"${p}"`).join(',')}),userId.eq.${currentUid}`);
        } else {
           sbQuery = sbQuery.in('customerPhone', phoneList);
        }
        
        const { data: dbOrders } = await sbQuery;
        const firestoreOrders = dbOrders || [];

        const uniqueMergedMap = new Map();
        firestoreOrders.forEach((o: any) => {
          uniqueMergedMap.set(o.id, o);
        });
        const finalMergedOrders = Array.from(uniqueMergedMap.values());

        const validOrders = finalMergedOrders.filter((o: any) => o.status !== 'Cancelled');
        const countTotal = validOrders.length;
        const countDelivered = validOrders.filter((o: any) => o.status === 'Delivered').length;
        const computedSpent = validOrders.reduce((sum: number, o: any) => {
          const singleAmt = Number(o.finalAmount) || Number(o.totalAmount) || Number(o.amount) || 0;
          return sum + singleAmt;
        }, 0);

        setStatsOrdersCount(countTotal);
        setStatsDeliveredCount(countDelivered);
        setStatsTotalSpent(computedSpent);
      } catch (err) {
        console.error("Failed to compute real-time profile stats:", err);
      }
    };

    fetchOrdersForStats();
    
    let sub = supabase.channel('profile_orders_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
         fetchOrdersForStats();
      }).subscribe();

    return () => {
       if (sub) sub.unsubscribe();
    };
  }, [user.isLoggedIn, user.phone, firebaseAuthReady]);

  return {
    statsOrdersCount,
    statsDeliveredCount,
    statsTotalSpent
  };
}
