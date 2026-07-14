import React, { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import BottomNav from '../BottomNav';

interface BottomNavigationProps {
  activeTab: 'home' | 'cart' | 'orders' | 'profile';
  onTabChange: (tab: 'home' | 'cart' | 'orders' | 'profile') => void;
  showCheckout: boolean;
  showOrderSuccess: boolean;
  showAdmin: boolean;
  showMerchant: boolean;
  showRider: boolean;
  showRiderManagement: boolean;
  isSplashed: boolean;
  showAnalyticsModal: boolean;
  showMerchantCalculationModal: boolean;
  trackingOrder: any;
  activeMerchantShop: any;
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
  showCheckout,
  showOrderSuccess,
  showAdmin,
  showMerchant,
  showRider,
  showRiderManagement,
  isSplashed,
  showAnalyticsModal,
  showMerchantCalculationModal,
  trackingOrder,
  activeMerchantShop
}: BottomNavigationProps) {

  // Dynamic 500% Perfect Status Bar Synchronization for Premium Native Experience
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncStatusBar = async () => {
      try {
        // Enable True Transparent Overlay to let webview flow under the physical status bar
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: '#00000000' });

        let style = Style.Light;

        if (!isSplashed) {
          // Splash screen is white/off-white background
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (showAdmin || showAnalyticsModal) {
          // Admin Panel - White Theme Header
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (showMerchant || showMerchantCalculationModal) {
          // Merchant Panel - White Theme Header
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (showRider || showRiderManagement) {
          // Rider Console - White Theme Header
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (showCheckout || showOrderSuccess || trackingOrder) {
          // Light pages: Checkout / Success / Tracking
          style = Style.Light; // Suit light background (dark text/icons)
        } else if (activeTab === 'home' || activeTab === 'cart' || activeTab === 'orders') {
          // Home, Cart, Orders: Dark Gradient Headers
          style = Style.Dark; // Suit dark background (light text/icons)
        } else {
          // Other tabs (Profile) - Crisp Premium Light Theme
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

  if (showCheckout || showOrderSuccess || showAdmin || showMerchant || showRider || showRiderManagement) {
    return null;
  }

  return (
    <BottomNav activeTab={activeTab} onTabChange={(tab) => onTabChange(tab as any)} />
  );
}
