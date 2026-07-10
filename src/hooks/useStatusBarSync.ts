import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface StatusBarSyncProps {
  isSplashed: boolean;
  showAdmin: boolean;
  showAnalyticsModal: boolean;
  showMerchant: boolean;
  showMerchantCalculationModal: boolean;
  showRider: boolean;
  showRiderManagement: boolean;
  showCheckout: boolean;
  showOrderSuccess: boolean;
  trackingOrder: any;
  activeTab: 'home' | 'cart' | 'orders' | 'profile';
}

export function useStatusBarSync({
  isSplashed,
  showAdmin,
  showAnalyticsModal,
  showMerchant,
  showMerchantCalculationModal,
  showRider,
  showRiderManagement,
  showCheckout,
  showOrderSuccess,
  trackingOrder,
  activeTab
}: StatusBarSyncProps) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncStatusBar = async () => {
      try {
        // Step 1. Enable True Transparent Overlay to let webview flow under the physical status bar
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: '#00000000' });

        let style = Style.Light;

        if (!isSplashed) {
          // Splash screen is white/off-white background
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (showAdmin || showAnalyticsModal) {
          // Admin Panel - Dark Slate Blue Theme
          style = Style.Dark; // Suit dark background (light text/icons)
        } else if (showMerchant || showMerchantCalculationModal) {
          // Merchant Panel - Dark Gray Theme
          style = Style.Dark; // Suit dark background (light text/icons)
        } else if (showRider || showRiderManagement) {
          // Rider Console - Slate Theme
          style = Style.Dark; // Suit dark background (light text/icons)
        } else if (showCheckout || showOrderSuccess || trackingOrder) {
          // Light pages: Checkout / Success / Tracking
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (activeTab === 'home') {
          // Home Screen: Deep Emerald Green Theme to match the beautiful top banner!
          style = Style.Dark; // Suit dark background (light text/icons)
        } else {
          // Other tabs (Cart, Orders, Profile) - Crisp Premium Light Theme
          style = Style.Light; // Suit light background (dark text/icons)
        }

        await StatusBar.setStyle({ style });
      } catch (err) {
        console.error('[Status Bar Sync] Failed to synchronize:', err);
      }
    };

    // Execute with a tiny microtask delay to ensure state transitions have rendered
    const timeoutId = setTimeout(syncStatusBar, 16);
    return () => clearTimeout(timeoutId);
  }, [
    isSplashed,
    showAdmin,
    showAnalyticsModal,
    showMerchant,
    showMerchantCalculationModal,
    showRider,
    showRiderManagement,
    showCheckout,
    showOrderSuccess,
    trackingOrder,
    activeTab
  ]);
}
