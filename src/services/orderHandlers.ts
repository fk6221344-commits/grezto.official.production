import React from 'react';
import { supabase } from './supabase';

interface OrderHandlerParams {
  stopAlertAlarmLoop: () => void;
  setIncomingOrderAlert: (order: any) => void;
  setShowOrderModal: (show: boolean) => void;
  user: any;
  userShop: any;
  setShowAdmin: (show: boolean) => void;
  setActiveMerchantShop: (shop: any) => void;
  setShowMerchant: (show: boolean) => void;
  incomingOrderAlert: any;
  dismissedOrderIdsRef?: React.MutableRefObject<Set<string>>;
}

export const createOrderHandlers = ({
  stopAlertAlarmLoop,
  setIncomingOrderAlert,
  setShowOrderModal,
  user,
  userShop,
  setShowAdmin,
  setActiveMerchantShop,
  setShowMerchant,
  incomingOrderAlert,
  dismissedOrderIdsRef
}: OrderHandlerParams) => {
  const handleUpdateOrderStatus = async (orderOrId: any, newStatus: string) => {
    try {
      const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId.id;
      const orderObj = typeof orderOrId === 'object' ? orderOrId : null;

      // Instantly dismiss order ID locally to avoid race condition re-ringing
      if (orderId && dismissedOrderIdsRef?.current) {
        dismissedOrderIdsRef.current.add(orderId);
      }

      // Instantly stop the audio loop, dismiss active order, and close modal
      stopAlertAlarmLoop();
      setIncomingOrderAlert(null);
      setShowOrderModal(false);

      // Perform background update so UI doesn't hang on slow connections
      const updatePromise = supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

      if (newStatus === 'Preparing') {
        const orderItems = orderObj?.items || orderObj?.fullItems || (incomingOrderAlert && incomingOrderAlert.id === orderId ? (incomingOrderAlert.items || incomingOrderAlert.fullItems) : []) || [];
        const merchantItem = orderItems.find((item: any) => {
          const sId = item.shopId || item.productShopId;
          return sId && sId !== 'admin' && sId !== 'direct' && sId !== '';
        });

        if (merchantItem) {
          const targetShopId = merchantItem.shopId || merchantItem.productShopId;
          const targetShopName = merchantItem.shopName || 'Partner Shop';
          setActiveMerchantShop({ id: targetShopId, name: targetShopName });
          setShowMerchant(true);
          setShowAdmin(false);
        } else if (user.isAdmin) {
          setShowAdmin(true);
          setShowMerchant(false);
        } else if (userShop) {
          setActiveMerchantShop(userShop);
          setShowMerchant(true);
          setShowAdmin(false);
        }
      }

      await updatePromise;
    } catch (e) {
      console.error("Failed to update status from root modal:", e);
    }
  };

  const handleAcceptAndRedirect = async (order: any) => {
    if (!order) return;
    try {
      // Instantly dismiss order ID locally to avoid race condition re-ringing
      if (order.id && dismissedOrderIdsRef?.current) {
        dismissedOrderIdsRef.current.add(order.id);
      }

      // Instantly stop the alert ringtone, dismiss active alert, and close modal
      stopAlertAlarmLoop();
      setIncomingOrderAlert(null);
      setShowOrderModal(false);

      // Perform background update without waiting for network latency
      const updatePromise = supabase.from('orders').update({ status: 'Preparing' }).eq('id', order.id);

      const orderItems = order.items || order.fullItems || [];
      const merchantItem = orderItems.find((item: any) => {
        const sId = item.shopId || item.productShopId;
        return sId && sId !== 'admin' && sId !== 'direct' && sId !== '';
      });

      if (merchantItem) {
        const targetShopId = merchantItem.shopId || merchantItem.productShopId;
        const targetShopName = merchantItem.shopName || 'Partner Shop';
        setActiveMerchantShop({ id: targetShopId, name: targetShopName });
        setShowMerchant(true);
        setShowAdmin(false);
      } else if (user.isAdmin) {
        setShowAdmin(true);
        setShowMerchant(false);
      } else if (userShop) {
        setActiveMerchantShop(userShop);
        setShowMerchant(true);
        setShowAdmin(false);
      }

      await updatePromise;
    } catch (err) {
      console.error("Failed to auto-accept and redirect order:", err);
    }
  };

  return {
    handleUpdateOrderStatus,
    handleAcceptAndRedirect
  };
};
