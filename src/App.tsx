import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { UserProvider, useUser } from './context/UserContext';
import { CartProvider, useCart } from './context/CartContext';
import toast, { Toaster } from 'react-hot-toast';
import { X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import SessionExpiredModal from './components/SessionExpiredModal';
import { useStatusBarSync } from './hooks/useStatusBarSync';
import { useNativeLifecycle } from './hooks/useNativeLifecycle';
import { useAutoLocation } from './hooks/useAutoLocation';
import { useAppDeepLinking } from './hooks/useAppDeepLinking';

// Sub components
import Splash from './components/Splash';
import Navbar from './components/Navbar';
import SearchOverlay from './components/SearchOverlay';
import Home from './components/Home';
import Cart from './lib/Cart';
import OrdersView from './components/OrdersView';
import Profile from './components/Profile';
import Checkout from './components/Checkout';
import OrderSuccess from './components/OrderSuccess';
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const MerchantPanel = React.lazy(() => import('./components/MerchantPanel'));
const AdminAnalytics = React.lazy(() => import('./components/AdminAnalytics'));
const MerchantCalculation = React.lazy(() => import('./components/MerchantCalculation'));
const RiderConsole = React.lazy(() => import('./components/RiderConsole'));
const RiderManagement = React.lazy(() => import('./components/RiderManagement'));
import { AdminErrorBoundary } from './components/admin/AdminErrorBoundary';
import BottomNav from './components/BottomNav';
import OrderDetailModal from './components/OrderDetailModal';
import AdminOrderOverlay from './components/admin/AdminOrderOverlay';
import Tracking from './components/Tracking';
import GlobalNotificationsModal from './components/GlobalNotificationsModal';
import ReferralInstaller from './components/ReferralInstaller';
import RiderAssignmentOverlay from './components/RiderAssignmentOverlay';
import GpsPressingActivator from './components/GpsPressingActivator';
import AssamOfflineBanner from './components/AssamOfflineBanner';
import GlobalAppUpdateModal from './components/GlobalAppUpdateModal';

import { DesktopBillboard } from './components/DesktopBillboard';

// Services
import { triggerLightHapticVibration } from './services/nativeService';
import { setupPushNotifications } from './services/NotificationService';
import { unlockNotificationAudio, startAlertAlarmLoop, stopAlertAlarmLoop } from './services/notifications';
import { createOrderHandlers } from './services/orderHandlers';
import { preFetchGPSBackground } from './lib/geocoder';

// Custom Hooks for ultra performance
import { useHardwareBack } from './hooks/useHardwareBack';
import { useRegisterBackHandler } from './hooks/useRegisterBackHandler';
import { useOrderAlerts } from './hooks/useOrderAlerts';
import { useRiderOrders } from './hooks/useRiderOrders';
import { useAppUpdate } from './hooks/useAppUpdate';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY) || '';

function MainAppLayout() {
  const { user, firebaseAuthReady, userShop, logout, updateProfile } = useUser();
  const { clearCart } = useCart();
  const { showUpdateModal, updateInfo, dismissUpdate } = useAppUpdate();

  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);

  const [activeTabRaw, setActiveTabRaw] = useState<'home' | 'cart' | 'orders' | 'profile'>('home');
  const [tabHistory, setTabHistory] = useState<Array<'home' | 'cart' | 'orders' | 'profile'>>(['home']);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const activeTab = activeTabRaw;

  const setActiveTab = (tab: 'home' | 'cart' | 'orders' | 'profile') => {
    const TAB_INDEXES = { home: 0, cart: 1, orders: 2, profile: 3 };
    const currentIndex = TAB_INDEXES[activeTabRaw] ?? 0;
    const nextIndex = TAB_INDEXES[tab] ?? 0;
    if (nextIndex > currentIndex) {
      setSlideDirection('right');
    } else if (nextIndex < currentIndex) {
      setSlideDirection('left');
    }
    setActiveTabRaw(tab);
    setTabHistory(prev => {
      if (prev[prev.length - 1] === tab) return prev;
      return [...prev, tab].slice(-20); // Keep last 20 navigation traces
    });
  };

  const popTabHistory = () => {
    let wasPopped = false;
    setTabHistory(prev => {
      if (prev.length <= 1) return prev; // Cannot pop root
      const newHistory = [...prev];
      newHistory.pop(); // Pop current
      const previousTab = newHistory[newHistory.length - 1]; // Look at previous
      setActiveTabRaw(previousTab);
      wasPopped = true;
      return newHistory;
    });
    return wasPopped;
  };

  const [ordersViewTab, setOrdersViewTab] = useState<'pending' | 'history'>('pending');
  const [gpsUnlocked, setGpsUnlocked] = useState(true);
  const [grocerySearchQuery, setGrocerySearchQuery] = useState('');
  
  const [isSplashed, setIsSplashed] = useState(false);
  const [hotelDetailsOpen, setHotelDetailsOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMerchant, setShowMerchant] = useState(false);
  const [showRider, setShowRider] = useState(false);
  const [showRiderManagement, setShowRiderManagement] = useState(false);
  const [activeMerchantShop, setActiveMerchantShop] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('grezto_active_merchant_shop');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const changeActiveMerchantShop = (shop: any | null) => {
    setActiveMerchantShop(shop);
    if (shop) {
      localStorage.setItem('grezto_active_merchant_shop', JSON.stringify(shop));
    } else {
      localStorage.removeItem('grezto_active_merchant_shop');
    }
  };

  const handleTabChange = (tab: 'home' | 'cart' | 'orders' | 'profile') => {
    setActiveTab(tab);
    setShowAdmin(false);
    setShowMerchant(false);
    setShowRider(false);
    setShowRiderManagement(false);
    setShowAnalyticsModal(false);
    setShowMerchantCalculationModal(false);
    setShowSearchOverlay(false);
    setShowCheckout(false);
    setShowOrderSuccess(false);
    setTrackingOrder(null);
    setShowNotifications(false);
  };

  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showMerchantCalculationModal, setShowMerchantCalculationModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);

  // Load Real-time Order Alerts System
  const {
    incomingOrderAlert,
    setIncomingOrderAlert,
    showOrderModal,
    setShowOrderModal,
    alarmMuted,
    setAlarmMuted,
    dismissedOrderIdsRef
  } = useOrderAlerts({
    firebaseAuthReady,
    user,
    userShop,
    activeMerchantShop,
    showRider,
    showAdmin,
    showMerchant
  });

  // Load Real-time Rider delivery assignment triggers
  const {
    globalRiderProfile,
    globalIncomingRiderOrders,
    handleGlobalAcceptOrder
  } = useRiderOrders({
    firebaseAuthReady,
    user
  });

  // Handle Android Native hardware back gestures cleanly & efficiently
  useHardwareBack({
    showOrderModal,
    setShowOrderModal,
    showCheckout,
    setShowCheckout,
    showOrderSuccess,
    setShowOrderSuccess,
    showAdmin,
    setShowAdmin,
    showMerchant,
    setShowMerchant,
    showRider,
    setShowRider,
    showRiderManagement,
    setShowRiderManagement,
    hotelDetailsOpen,
    setHotelDetailsOpen,
    trackingOrder,
    setTrackingOrder,
    showNotifications,
    setShowNotifications,
    showAnalyticsModal,
    setShowAnalyticsModal,
    showMerchantCalculationModal,
    setShowMerchantCalculationModal,
    grocerySearchQuery,
    setGrocerySearchQuery,
    activeTab,
    setActiveTab: (tab) => handleTabChange(tab),
    popTabHistory
  });

  // Intercept back key to close the Search Overlay first
  useRegisterBackHandler(() => {
    if (showSearchOverlay) {
      setShowSearchOverlay(false);
      return true;
    }
    return false;
  }, 20, [showSearchOverlay]);

  // Pre-fetch GPS aggressively for 0-second checkout load
  useEffect(() => {
    preFetchGPSBackground();
  }, []);

  useEffect(() => {
    if (activeTabRaw === 'cart') {
      preFetchGPSBackground();
    }
  }, [activeTabRaw]);

  // Sync state transitions to persistent Storage
  useEffect(() => {
    // Purge outdated transient states on mount to ensure clean, high-speed start
    const keysToRemove = [
      'grezto_active_tab',
      'grezto_hotel_details_open',
      'grezto_show_checkout',
      'grezto_show_order_success',
      'grezto_show_admin',
      'grezto_show_merchant',
      'grezto_show_rider',
      'grezto_show_rider_management',
      'grezto_show_notifications',
      'grezto_show_analytics_modal',
      'grezto_show_merchant_calc_modal',
      'grezto_tracking_order'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    const handleOpenShop = () => {
      setShowSearchOverlay(false);
    };
    
    // Global subtle button-click tactile haptic feedback
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;
      const interactive = target.closest('button, a, [role="button"], .btn, .button, [onclick]');
      if (interactive) {
        triggerLightHapticVibration();
      }
    };

    window.addEventListener('open-shop-details', handleOpenShop);
    document.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('open-shop-details', handleOpenShop);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Handle post login triggers
  useEffect(() => {
    if (user.isLoggedIn) {
      const pendingCheckout = localStorage.getItem('grezto_pending_checkout');
      if (pendingCheckout === 'true') {
        localStorage.removeItem('grezto_pending_checkout');
        setActiveTab('cart');
        setShowCheckout(true);
        toast.success("Successfully authenticated! Continuing to secure GPS checkout... 🛍️🌿", { id: 'grezto-pending-checkout-success' });
      }
      
      // Initialize Push Notification Service Worker for Order Status alerts
      if (user.phone) {
        setupPushNotifications(user.phone);
        import('./services/nativeService').then(({ initializeFCMNotifications }) => {
          initializeFCMNotifications(user.phone);
        });
      }
    }
  }, [user.isLoggedIn, user.phone]);

  const handleCheckoutTrigger = () => {
    if (!user.isLoggedIn) {
      localStorage.setItem('grezto_pending_checkout', 'true');
      localStorage.setItem('grezto_force_open_signup', 'true');
      window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'signup' } }));
      return;
    }
    setShowCheckout(true);
  };

  useEffect(() => {
    const handleGesture = () => unlockNotificationAudio();
    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  // Dynamic 500% Perfect Status Bar Synchronization for Premium Native Experience
  useStatusBarSync({
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
  });

  // System Initializations & Capacitor Native Lifecycle Integration (Smart Pause & Resume)
  useNativeLifecycle();

  // 100% Native Precise Geolocation Autodetect on Startup
  useAutoLocation({
    firebaseAuthReady,
    user,
    updateProfile
  });

  // -------------------
  // DEEP LINKING SETUP (WhatsApp and Web product redirection to Native Android App)
  // -------------------
  useAppDeepLinking({
    setGrocerySearchQuery,
    setShowSearchOverlay
  });

  // Zero-Crash Session Recovery / 401 & 403 Handler
  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn("[AUTH EXPIRED] Access token validation failed. Triggering recovery alert screen.");
      setShowSessionExpiredModal(true);
    };

    window.addEventListener('grezto-auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('grezto-auth-expired', handleAuthExpired);
    };
  }, []);

  const handleSessionExpiredReset = () => {
    setShowSessionExpiredModal(false);
    // Graceful logout to clear user states
    logout();
    // Redirect to home safely
    handleTabChange('home');
    // Prompt the native-style signup/login form automatically for quick session restore
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'signup' } }));
    }, 400);
  };

  // Set custom navigation event hooks from different tabs/components
  useEffect(() => {
    const handleNavToHome = () => setActiveTab('home');
    const handleOpenMerchant = (e: Event) => {
      const shop = (e as CustomEvent).detail;
      if (shop) {
        changeActiveMerchantShop(shop);
        setShowMerchant(true);
      }
    };
    const handleOpenRider = () => setShowRider(true);
    const handleOpenRiderManagement = () => setShowRiderManagement(true);

    window.addEventListener('nav-to-home', handleNavToHome);
    window.addEventListener('grezto-open-merchant', handleOpenMerchant);
    window.addEventListener('grezto-open-rider', handleOpenRider);
    window.addEventListener('grezto-open-rider-management', handleOpenRiderManagement);

    return () => {
      window.removeEventListener('nav-to-home', handleNavToHome);
      window.removeEventListener('grezto-open-merchant', handleOpenMerchant);
      window.removeEventListener('grezto-open-rider', handleOpenRider);
      window.removeEventListener('grezto-open-rider-management', handleOpenRiderManagement);
    };
  }, []);

  const { handleUpdateOrderStatus, handleAcceptAndRedirect } = createOrderHandlers({
    stopAlertAlarmLoop,
    setIncomingOrderAlert,
    setShowOrderModal,
    user,
    userShop,
    setShowAdmin,
    setActiveMerchantShop: changeActiveMerchantShop,
    setShowMerchant,
    incomingOrderAlert,
    dismissedOrderIdsRef
  });

  const handleRiderAccept = (orderId: string) => {
    handleGlobalAcceptOrder(orderId, () => {
      setShowRider(true);
    });
  };

  return (
    <div className="h-screen w-screen bg-[#fffcf9] flex flex-col overflow-hidden font-sans antialiased selection:bg-red-900/10 selection:text-red-900 relative">
      {/* Dynamic Ambient Background Elements for desktop */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none hidden lg:block" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[130px] pointer-events-none hidden lg:block" />

      <AnimatePresence mode="wait">
        {!isSplashed ? (
          <Splash key="splash-screen" onFinish={() => setIsSplashed(true)} />
        ) : (
          <div className="w-full h-full flex flex-col relative z-10">
            {!gpsUnlocked && (
              <GpsPressingActivator onUnlocked={() => setGpsUnlocked(true)} />
            )}
            
            <motion.div 
              key="main-app-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full bg-[#fffcf9] h-full flex flex-col relative overflow-hidden"
            >
                <AssamOfflineBanner />


                {!showCheckout && !showOrderSuccess && !showAdmin && !showMerchant && activeTab !== 'profile' && !hotelDetailsOpen && (
                  <Navbar 
                    activeTab={activeTab}
                    onOpenNotifications={() => setShowNotifications(true)} 
                    onProfileTap={() => setActiveTab('profile')}
                    onBack={activeTab !== 'home' ? () => setActiveTab('home') : undefined}
                    searchQuery={grocerySearchQuery}
                    onSearchChange={setGrocerySearchQuery}
                    onSearchClick={() => setShowSearchOverlay(true)}
                    viewTab={ordersViewTab}
                    onViewTabChange={setOrdersViewTab}
                  />
                )}

                {/* Main Client Content body */}
                <main className="flex-grow w-full overflow-y-auto bg-transparent pb-20 relative scroll-auto">
                  <AnimatePresence mode="wait">
                    {!showCheckout && !showOrderSuccess && !showAdmin && (
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: slideDirection === 'right' ? 32 : -32 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: slideDirection === 'right' ? -32 : 32 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] }}
                        style={{ willChange: 'transform, opacity' }}
                      >
                        {activeTab === 'home' && (
                          <Home 
                            searchQuery={grocerySearchQuery} 
                            onHotelDetailsToggle={setHotelDetailsOpen} 
                          />
                        )}
                        {activeTab === 'cart' && <Cart onCheckout={handleCheckoutTrigger} />}
                        {activeTab === 'orders' && (
                          <OrdersView 
                            viewTab={ordersViewTab}
                            setViewTab={setOrdersViewTab}
                            onNavigateToHome={() => setActiveTab('home')} 
                            onTrackOrder={(order) => {
                              if (order.phone) {
                                localStorage.setItem('last_order_phone', order.phone);
                              }
                              setTrackingOrder(order);
                            }}
                          />
                        )}
                        {activeTab === 'profile' && (
                          <Profile 
                            onAdminClick={() => setShowAdmin(true)} 
                            onMerchantClick={(sh) => {
                              changeActiveMerchantShop(sh);
                              setShowMerchant(true);
                            }}
                            onBack={() => setActiveTab('home')} 
                            onOpenAnalytics={() => setShowAnalyticsModal(true)}
                            onOpenCalculation={() => setShowMerchantCalculationModal(true)}
                            onRiderClick={() => setShowRider(true)}
                            onRiderManagementClick={() => setShowRiderManagement(true)}
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </main>

                {/* Search Overlay */}
                <AnimatePresence>
                  {showSearchOverlay && (
                    <SearchOverlay
                      initialQuery={grocerySearchQuery}
                      onClose={() => setShowSearchOverlay(false)}
                      onSelect={(query) => {
                        setGrocerySearchQuery(query);
                        setShowSearchOverlay(false);
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Checkout Page Overlay */}
                <AnimatePresence>
                  {showCheckout && (
                    <motion.div 
                      initial={{ opacity: 0, x: "100%" }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: "100%" }}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      className="fixed inset-0 z-[9999] bg-white flex justify-center overflow-y-auto"
                    >
                      <div className="w-full max-w-none lg:max-w-5xl bg-white min-h-screen">
                        <Checkout 
                          onBack={() => setShowCheckout(false)} 
                          onComplete={(details) => {
                            setLastOrderDetails(details);
                            setShowCheckout(false);
                            clearCart();
                            setShowOrderSuccess(true);
                          }} 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Order Success Overlay */}
                <AnimatePresence>
                  {showOrderSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      className="fixed inset-0 z-[9999] bg-white flex justify-center overflow-y-auto"
                    >
                      <div className="w-full max-w-none lg:max-w-5xl bg-white min-h-screen">
                        <OrderSuccess 
                          onBack={() => setShowOrderSuccess(false)}
                          onTrack={() => {
                            setShowOrderSuccess(false);
                            setActiveTab('orders');
                          }}
                          lastOrderDetails={lastOrderDetails}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Admin Dashboard Control Console */}
                <AnimatePresence>
                  {showAdmin && (
                    <motion.div 
                      key="admin-dashboard-console"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="fixed inset-0 z-[9999] bg-[#f8fafc] flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-[#f8fafc] h-full overflow-y-auto flex flex-col relative"
                      >
                        <AdminErrorBoundary onClose={() => setShowAdmin(false)}>
                          <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}>
                            <AdminPanel onClose={() => setShowAdmin(false)} />
                          </React.Suspense>
                        </AdminErrorBoundary>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Merchant Sales Console */}
                <AnimatePresence>
                  {showMerchant && activeMerchantShop && (
                    <motion.div 
                      key="merchant-sales-console"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="fixed inset-0 z-[9999] bg-slate-50 flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full overflow-y-auto flex flex-col relative"
                      >
                        <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}>
                          <MerchantPanel 
                            shop={activeMerchantShop} 
                            onClose={() => {
                              setShowMerchant(false);
                              setActiveMerchantShop(null);
                            }} 
                          />
                        </React.Suspense>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rider delivery dashboard */}
                <AnimatePresence>
                  {showRider && (
                    <motion.div 
                      key="rider-delivery-dashboard"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="fixed inset-0 z-[9999] bg-slate-50 flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full flex flex-col relative overflow-hidden"
                      >
                        <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}><RiderConsole onClose={() => setShowRider(false)} initialProfile={globalRiderProfile} /></React.Suspense>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rider Management Overlay */}
                <AnimatePresence>
                  {showRiderManagement && (
                    <motion.div 
                      key="rider-management-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="fixed inset-0 z-[9999] bg-slate-50 flex justify-center overflow-hidden"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full flex flex-col relative"
                      >
                        <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}><RiderManagement onClose={() => setShowRiderManagement(false)} /></React.Suspense>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tracking order real-time */}
                <AnimatePresence>
                  {trackingOrder && (
                    <motion.div 
                      initial={{ opacity: 0, x: "10%" }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: "10%" }}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      className="fixed inset-0 z-[500] bg-white flex justify-center"
                    >
                      <div className="w-full max-w-none lg:max-w-5xl bg-white min-h-screen">
                        <Tracking 
                          order={trackingOrder}
                          onBack={() => setTrackingOrder(null)} 
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Admin Analytics Modal overlay */}
                <AnimatePresence>
                  {showAnalyticsModal && (
                    <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}><AdminAnalytics onClose={() => setShowAnalyticsModal(false)} /></React.Suspense>
                  )}
                </AnimatePresence>

                {/* Merchant Ledger calculator overlay */}
                <AnimatePresence>
                  {showMerchantCalculationModal && userShop && (
                    <React.Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center z-[999]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>}><MerchantCalculation shop={userShop} onClose={() => setShowMerchantCalculationModal(false)} /></React.Suspense>
                  )}
                </AnimatePresence>

                {/* PWA custom Notification board overlay */}
                <AnimatePresence>
                  {showNotifications && (
                    <GlobalNotificationsModal 
                      onClose={() => setShowNotifications(false)} 
                      onTrackOrder={(order) => {
                        setTrackingOrder(order);
                        setShowNotifications(false);
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* New incoming order push banner modal */}
                {incomingOrderAlert && !showRider && (
                  <AdminOrderOverlay
                    incomingOrderAlert={incomingOrderAlert}
                    onAccept={() => {
                      handleAcceptAndRedirect(incomingOrderAlert);
                    }}
                  />
                )}

                {/* Specific Detailed order dialog */}
                <AnimatePresence>
                  {showOrderModal && incomingOrderAlert && (
                    <OrderDetailModal
                      order={incomingOrderAlert}
                      onClose={() => {
                        if (incomingOrderAlert) {
                          dismissedOrderIdsRef.current.add(incomingOrderAlert.id);
                        }
                        setShowOrderModal(false);
                        setIncomingOrderAlert(null);
                        stopAlertAlarmLoop();
                      }}
                      onUpdateStatus={handleUpdateOrderStatus}
                    />
                  )}
                </AnimatePresence>

                {/* Bottom Navigation board */}
                {!showCheckout && !showOrderSuccess && !showAdmin && !showMerchant && !showRider && !showRiderManagement && (
                  <BottomNav activeTab={activeTab} onTabChange={(tab) => handleTabChange(tab as any)} />
                )}

                <ReferralInstaller />
                <GlobalAppUpdateModal show={showUpdateModal} updateInfo={updateInfo} onDismiss={dismissUpdate} />

                {!user.isLoggedIn && activeTab !== 'profile' && (
                  <Profile 
                    onlyModals={true}
                    onAdminClick={() => {}}
                    onMerchantClick={() => {}}
                  />
                )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RiderAssignmentOverlay 
        globalIncomingRiderOrders={globalIncomingRiderOrders}
        globalRiderProfile={globalRiderProfile}
        onAccept={handleRiderAccept}
      />

      {/* Session Expired Fail-Safe Modal (Zero-Crash Shield) */}
      <SessionExpiredModal 
        showSessionExpiredModal={showSessionExpiredModal}
        handleSessionExpiredReset={handleSessionExpiredReset}
      />

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <CartProvider>
          <Toaster 
            position="top-center"
            containerStyle={{
              top: 'max(env(safe-area-inset-top), 24px)'
            }}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '12px 20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(12px)',
                letterSpacing: '0.01em',
                maxWidth: '90vw'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
              },
            }} 
          />
          <MainAppLayout />
        </CartProvider>
      </UserProvider>
    </LanguageProvider>
  );
}
