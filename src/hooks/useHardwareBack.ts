import { useEffect, useRef } from 'react';

/**
 * Highly optimized React Hook for handling native custom back navigation.
 * Uses persistent refs to prevent continuous event listener tearing and platform thread lag on Android.
 */
export function useHardwareBack(states: {
  showOrderModal: boolean;
  setShowOrderModal: (x: boolean) => void;
  showCheckout: boolean;
  setShowCheckout: (x: boolean) => void;
  showOrderSuccess: boolean;
  setShowOrderSuccess: (x: boolean) => void;
  showAdmin: boolean;
  setShowAdmin: (x: boolean) => void;
  showMerchant: boolean;
  setShowMerchant: (x: boolean) => void;
  showRider: boolean;
  setShowRider: (x: boolean) => void;
  showRiderManagement: boolean;
  setShowRiderManagement: (x: boolean) => void;
  hotelDetailsOpen: boolean;
  setHotelDetailsOpen: (x: boolean) => void;
  trackingOrder: any;
  setTrackingOrder: (x: any) => void;
  showNotifications: boolean;
  setShowNotifications: (x: boolean) => void;
  showAnalyticsModal: boolean;
  setShowAnalyticsModal: (x: boolean) => void;
  showMerchantCalculationModal: boolean;
  setShowMerchantCalculationModal: (x: boolean) => void;
  grocerySearchQuery: string;
  setGrocerySearchQuery: (x: string) => void;
  activeTab: 'home' | 'cart' | 'orders' | 'profile';
  setActiveTab: (x: any) => void;
  popTabHistory?: () => boolean;
}) {
  const statesRef = useRef(states);
  const prevStatesRef = useRef(states);
  const stackRef = useRef<string[]>([]);
  const isPopStateRef = useRef(false);
  
  // Keep the ref strictly synchronized with the latest state values
  useEffect(() => {
    const prev = prevStatesRef.current;
    const current = states;
    
    // Check for newly opened modals/states and push to stack & history
    if (!isPopStateRef.current) {
      let pushed = false;
      const keysToCheck = [
        'showOrderModal', 'showCheckout', 'showOrderSuccess', 'showAdmin',
        'showMerchant', 'showRider', 'showRiderManagement', 'hotelDetailsOpen',
        'showNotifications', 'showAnalyticsModal', 'showMerchantCalculationModal'
      ] as const;

      for (const key of keysToCheck) {
        if (!prev[key as keyof typeof prev] && current[key as keyof typeof current]) {
          stackRef.current.push(key);
          pushed = true;
        }
      }

      if (!prev.trackingOrder && current.trackingOrder) {
        stackRef.current.push('trackingOrder');
        pushed = true;
      }
      
      if (!prev.grocerySearchQuery && current.grocerySearchQuery) {
        stackRef.current.push('grocerySearchQuery');
        pushed = true;
      }

      // If we pushed something to our local stack, push to browser history
      if (pushed) {
        window.history.pushState({ modalStack: true }, '');
      }
    }
    
    // Reset popstate flag
    isPopStateRef.current = false;
    
    statesRef.current = states;
    prevStatesRef.current = states;
  }, [states]);

  useEffect(() => {
    let watchBack: any = null;

    const performBack = (): boolean => {
      const current = statesRef.current;
      isPopStateRef.current = true;
      
      // 1. Try popping from our LIFO stack first
      while (stackRef.current.length > 0) {
        const top = stackRef.current.pop();
        if (top) {
          if (top === 'grocerySearchQuery' && current.grocerySearchQuery) {
            current.setGrocerySearchQuery('');
            return true;
          }
          if (top === 'trackingOrder' && current.trackingOrder) {
            current.setTrackingOrder(null);
            return true;
          }
          
          const setterName = 'set' + top.charAt(0).toUpperCase() + top.slice(1);
          const setter = (current as any)[setterName];
          const value = (current as any)[top];
          
          if (setter && value) {
            setter(false);
            return true;
          }
        }
      }

      // 2. Fallback priority check (if stack is empty or got out of sync)
      if (current.showOrderModal) { current.setShowOrderModal(false); return true; }
      if (current.showCheckout) { current.setShowCheckout(false); return true; }
      if (current.showOrderSuccess) { current.setShowOrderSuccess(false); return true; }
      if (current.showAdmin) { current.setShowAdmin(false); return true; }
      if (current.showMerchant) { current.setShowMerchant(false); return true; }
      if (current.showRider) { current.setShowRider(false); return true; }
      if (current.showRiderManagement) { current.setShowRiderManagement(false); return true; }
      if (current.hotelDetailsOpen) { current.setHotelDetailsOpen(false); return true; }
      if (current.trackingOrder) { current.setTrackingOrder(null); return true; }
      if (current.showNotifications) { current.setShowNotifications(false); return true; }
      if (current.showAnalyticsModal) { current.setShowAnalyticsModal(false); return true; }
      if (current.showMerchantCalculationModal) { current.setShowMerchantCalculationModal(false); return true; }
      if (current.grocerySearchQuery) { current.setGrocerySearchQuery(''); return true; }
      
      // 3. Tab history fallback
      if (current.popTabHistory && current.popTabHistory()) {
        return true;
      }
      
      if (current.activeTab !== 'home') {
        current.setActiveTab('home');
        return true;
      }
      
      return false;
    };

    async function registerHardwareBack() {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        watchBack = await CapApp.addListener('backButton', (data) => {
          console.log("[Native Back Hook] Hardware back button triggered", data);
          
          const handled = performBack();
          
          if (handled) {
            // Keep web history in sync if we handled it via native back button
            window.history.back();
          } else {
            console.log("[Native Back Hook] Root reached. Minimizing app.");
            CapApp.minimizeApp().catch((e) => {
              console.error("Error minimizing native app from backbutton hook:", e);
              CapApp.exitApp();
            });
          }
        });
      } catch (err) {
        // Safe check for browser runtime
      }
    }

    registerHardwareBack();

    // Web History API Support (for PWA / Web Browsers)
    const handlePopState = (e: PopStateEvent) => {
      performBack();
    };
    
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (watchBack) {
        watchBack.remove().catch((e: any) => console.log("Backbutton unregister fail:", e));
      }
    };
  }, []);
}
