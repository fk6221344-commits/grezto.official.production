import { supabase, admin } from './clients';

export function startFCMOrderListener() {
  if (!supabase) {
    console.warn('[FCM Listener] Supabase client is not initialized. Cannot start listener.');
    return;
  }

  if (!admin.apps.length) {
    console.warn('[FCM Listener] Firebase Admin SDK is not initialized. Cannot start listener.');
    return;
  }

  console.log('[FCM Listener] Starting Supabase realtime listener for new orders...');

  supabase
    .channel('fcm_orders_channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      async (payload) => {
        try {
          const order = payload.new;
          if (!order) return;
          console.log(`[FCM Listener] New order detected: ${order.id}`);

          // 1. Gather all phones that need to be notified (Admins + Relevant Merchants)
          const targetPhones = new Set<string>();

          // Get Admins
          const { data: admins, error: adminErr } = await supabase
            .from('team')
            .select('phone')
            .in('role', ['admin', 'master']);
            
          if (!adminErr && admins) {
            admins.forEach((a: any) => {
              if (a.phone) targetPhones.add(a.phone);
            });
          }

          // Get Merchants (from shopIds in the order)
          if (order.shopIds && Array.isArray(order.shopIds) && order.shopIds.length > 0) {
            const { data: shops, error: shopErr } = await supabase
              .from('shops')
              .select('ownerPhone')
              .in('id', order.shopIds);
              
            if (!shopErr && shops) {
              shops.forEach((s: any) => {
                if (s.ownerPhone) targetPhones.add(s.ownerPhone);
              });
            }
          }

          const phonesArray = Array.from(targetPhones);
          if (phonesArray.length === 0) {
            console.log('[FCM Listener] No target phones found for order', order.id);
            return;
          }

          // 2. Query FCM Tokens for these phones
          const { data: tokensData, error: tokensErr } = await supabase
            .from('fcm_tokens')
            .select('token, phone, updated_at')
            .in('phone', phonesArray);

          if (tokensErr || !tokensData || tokensData.length === 0) {
            console.log('[FCM Listener] No FCM tokens found for target phones.');
            return;
          }

          // Group by phone and keep only the latest token per phone
          const latestTokensMap = new Map<string, string>();
          tokensData.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          
          tokensData.forEach((t: any) => {
             if (t.phone && t.token && !latestTokensMap.has(t.phone)) {
                 latestTokensMap.set(t.phone, t.token);
             }
          });

          // 3. Send Push Notifications
          const tokens = Array.from(new Set(latestTokensMap.values()));
          
          const message = {
            android: {
              priority: 'high' as const,
            },
            data: {
              title: '🚨 New Order Received! 🚨',
              body: `A new order has been placed. Amount: ₹${order.finalAmount || 0}`,
              orderId: String(order.id),
              type: 'new_order'
            },
            tokens: tokens
          };
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`[FCM Listener] Push sent to ${tokens.length} devices. Success: ${response.successCount}, Failures: ${response.failureCount}`);
          
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.warn(`[FCM Listener] Failed to send to token ${tokens[idx]}:`, resp.error);
              }
            });
          }

        } catch (err) {
          console.error('[FCM Listener] Error processing new order push:', err);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      async (payload) => {
        try {
          const newOrder = payload.new;
          const oldOrder = payload.old;
          
          // Check if rider assignment happened
          if (!newOrder || newOrder.status !== 'Out for Delivery' || !newOrder.partnerPhone) return;
          if (oldOrder && oldOrder.partnerPhone === newOrder.partnerPhone) return;

          console.log(`[FCM Listener] Order ${newOrder.id} assigned to rider phone: ${newOrder.partnerPhone}`);

          // 1. Get Rider's phone number directly from the order
          const riderPhone = newOrder.partnerPhone;

          // 2. Query FCM Token for this rider's phone
          const possiblePhones = [riderPhone, `+91${String(riderPhone).slice(-10)}`, String(riderPhone).slice(-10)];
          const { data: tokensData, error: tokensErr } = await supabase
            .from('fcm_tokens')
            .select('token, phone, updated_at')
            .in('phone', possiblePhones);

          if (tokensErr || !tokensData || tokensData.length === 0) {
            console.log('[FCM Listener] No FCM tokens found for rider phone:', riderPhone);
            return;
          }

          const latestTokensMap = new Map<string, string>();
          tokensData.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          tokensData.forEach((t: any) => {
             if (t.phone && t.token && !latestTokensMap.has(t.phone)) {
                 latestTokensMap.set(t.phone, t.token);
             }
          });

          // 3. Send Push Notification to Rider
          const tokens = Array.from(new Set(latestTokensMap.values()));
          
          const message = {
            android: {
              priority: 'high' as const,
            },
            data: {
              title: '🛵 New Delivery Assigned! 🛵',
              body: `You have been assigned a new order. ID: #${String(newOrder.id).slice(-5).toUpperCase()}`,
              orderId: String(newOrder.id),
              type: 'rider_assigned'
            },
            tokens: tokens
          };

          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`[FCM Listener] Rider Assignment Push sent. Success: ${response.successCount}, Failures: ${response.failureCount}`);
        } catch (err) {
          console.error('[FCM Listener] Error processing rider assignment push:', err);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[FCM Listener] Subscription status: ${status}`);
    });
}
