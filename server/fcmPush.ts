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
            .select('token')
            .in('phone', phonesArray);

          if (tokensErr || !tokensData || tokensData.length === 0) {
            console.log('[FCM Listener] No FCM tokens found for target phones.');
            return;
          }

          // 3. Send Push Notifications
          const tokens = tokensData.map((t: any) => t.token);
          
          const message = {
            notification: {
              title: '🚨 New Order Received! 🚨',
              body: `A new order has been placed. Amount: ₹${order.finalAmount || 0}`,
            },
            android: {
              priority: 'high' as const,
              notification: {
                channelId: 'grezto_order_channel_v4',
                sound: 'spaceship_alarm', // plays android/app/src/main/res/raw/spaceship_alarm.mp3
                clickAction: 'FCM_PLUGIN_ACTIVITY',
                visibility: 'public' as const,
                defaultVibrateTimings: false,
                vibrateTimingsMillis: [0, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], // Aggressive vibration pattern
              }
            },
            data: {
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
    .subscribe((status) => {
      console.log(`[FCM Listener] Subscription status: ${status}`);
    });
}
