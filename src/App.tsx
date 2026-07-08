import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { UserProvider, useUser } from './context/UserContext';
import { CartProvider, useCart } from './context/CartContext';
import toast, { Toaster } from 'react-hot-toast';
import { X } from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

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
import AdminPanel from './components/AdminPanel';
import MerchantPanel from './components/MerchantPanel';
import AdminAnalytics from './components/AdminAnalytics';
import MerchantCalculation from './components/MerchantCalculation';
import RiderConsole from './components/RiderConsole';
import RiderManagement from './components/RiderManagement';
import BottomNav from './components/BottomNav';
import OrderDetailModal from './components/OrderDetailModal';
import IncomingOrderAlert from './components/IncomingOrderAlert';
import Tracking from './components/Tracking';
import GlobalNotificationsModal from './components/GlobalNotificationsModal';
import ReferralInstaller from './components/ReferralInstaller';
import RiderAssignmentOverlay from './components/RiderAssignmentOverlay';
import GpsPressingActivator from './components/GpsPressingActivator';
import AssamOfflineBanner from './components/AssamOfflineBanner';

import { DesktopBillboard } from './components/DesktopBillboard';

// Services
import { initializeCrashlytics, triggerLightHapticVibration } from './services/nativeService';
import { setupPushNotifications } from './services/NotificationService';
import { unlockNotificationAudio, startAlertAlarmLoop, stopAlertAlarmLoop } from './services/notifications';
import { createOrderHandlers } from './services/orderHandlers';

// Custom Hooks for ultra performance
import { useHardwareBack } from './hooks/useHardwareBack';
import { useRegisterBackHandler } from './hooks/useRegisterBackHandler';
import { useOrderAlerts } from './hooks/useOrderAlerts';
import { useRiderOrders } from './hooks/useRiderOrders';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY) || '';

function MainAppLayout() {
  const { user, firebaseAuthReady, userShop, logout, updateProfile } = useUser();
  const { clearCart } = useCart();

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
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const syncStatusBar = async () => {
      try {
        // Step 1. Ensure WebView does not overlap the Status Bar (ensures it is pushed down)
        await StatusBar.setOverlaysWebView({ overlay: false });

        let color = '#fffdfa';
        let style = Style.Dark;

        if (!isSplashed) {
          // Splash screen is white/off-white background
          color = '#fffdfa';
          style = Style.Dark;
        } else if (showAdmin || showAnalyticsModal) {
          // Admin Panel - Dark Slate Blue Theme
          color = '#0f172a';
          style = Style.Light;
        } else if (showMerchant || showMerchantCalculationModal) {
          // Merchant Panel - Dark Gray Theme
          color = '#111827';
          style = Style.Light;
        } else if (showRider || showRiderManagement) {
          // Rider Console - Slate Theme
          color = '#0f172a';
          style = Style.Light;
        } else if (showCheckout || showOrderSuccess || trackingOrder) {
          // Light pages: Checkout / Success / Tracking
          color = '#fffdfa';
          style = Style.Dark;
        } else if (activeTab === 'home') {
          // Home Screen: Deep Emerald Green Theme to match the beautiful top banner!
          color = '#022c22';
          style = Style.Light;
        } else {
          // Other tabs (Cart, Orders, Profile) - Crisp Premium Light Theme
          color = '#fffdfa';
          style = Style.Dark;
        }

        await StatusBar.setBackgroundColor({ color });
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

  // System Initializations & Capacitor Native Lifecycle Integration (Smart Pause & Resume)
  useEffect(() => {
    initializeCrashlytics();

    let stateChangeListener: any = null;

    async function registerLifecycleListener() {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        stateChangeListener = await CapApp.addListener('appStateChange', (state) => {
          console.log('[Native Lifecycle] App state changed:', state);
          if (!state.isActive) {
            // App went to background (Pause)
            console.log('[Native Lifecycle] App in background. Pausing alarms and heavy processes...');
            stopAlertAlarmLoop();
          } else {
            // App returned to foreground (Resume)
            console.log('[Native Lifecycle] App in foreground. Resuming sync channels...');
            window.dispatchEvent(new CustomEvent('grezto-app-resumed'));
          }
        });
      } catch (err) {
        console.log('[Native Lifecycle] Bypassed register (non-native platform).');
      }
    }

    registerLifecycleListener();

    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove().catch((e: any) => console.log('Lifecycle listener unregister fail:', e));
      }
    };
  }, []);

  // 100% Native Precise Geolocation Autodetect on Startup
  useEffect(() => {
    if (!firebaseAuthReady) return;

    async function autoFetchLocation() {
      // If user has manually entered/saved a genuine non-fallback address, do not overwrite it automatically
      if (user.address && !user.address.includes("Mitreno Tech") && user.address !== "Kawarhagi, Assam") {
        console.log("[Auto GPS] Real user address already present, skipping auto-fetch on startup.");
        return;
      }

      try {
        console.log("[Auto GPS] Checking permissions on startup...");
        const { Geolocation } = await import('@capacitor/geolocation');
        
        let permResult = await Geolocation.checkPermissions();
        let status = permResult.location;

        // If permission is not granted yet, ask for precise & high accuracy permission immediately
        if (status !== 'granted') {
          console.log("[Auto GPS] Location permission not granted. Requesting native permissions...");
          const reqResult = await Geolocation.requestPermissions();
          status = reqResult.location;
        }

        if (status === 'granted') {
          console.log("[Auto GPS] Native GPS permission granted. Querying coordinates with high accuracy...");
          let pos;
          try {
            pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 7000
            });
          } catch (highErr) {
            console.warn("[Auto GPS] High accuracy getCurrentPosition failed, falling back to lower precision:", highErr);
            pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 10000
            });
          }

          console.log("[Auto GPS] Coordinates retrieved successfully:", pos.coords.latitude, pos.coords.longitude);
          const { reverseGeocodeCoords } = await import('./lib/geocoder');
          const result = await reverseGeocodeCoords(pos.coords.latitude, pos.coords.longitude);
          
          const compiledAddress = `${result.street || "Unknown Street"}, ${result.city || "Kawarhagi"}, ${result.state || "Assam"} (Pin - ${result.pincode || "782121"})`;
          
          updateProfile({
            address: compiledAddress,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            activeCity: result.city || "Kawarhagi"
          });
          
          console.log("[Auto GPS] Location auto-locked & profile address set successfully:", compiledAddress);
        } else {
          console.log("[Auto GPS] User denied native location permissions.");
        }
      } catch (err) {
        console.warn("[Auto GPS] Startup auto-location fetch failed:", err);
      }
    }

    // Delay by 2.5 seconds to wait for Splash screen fadeout and rendering stabilization
    const delayTimer = setTimeout(() => {
      autoFetchLocation();
    }, 2500);

    return () => clearTimeout(delayTimer);
  }, [firebaseAuthReady]);

  // -------------------
  // DEEP LINKING SETUP (WhatsApp and Web product redirection to Native Android App)
  // -------------------
  useEffect(() => {
    let urlOpenListener: any = null;

    async function registerUrlOpenListener() {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        
        // Listen to deep linking events when the app is already open or resumed from a background state
        urlOpenListener = await CapApp.addListener('appUrlOpen', (event) => {
          console.log('[Deep Linking] App launched or resumed with URL:', event.url);
          try {
            const urlString = event.url;
            if (!urlString) return;

            // Handle standard schemes and custom app schemes
            const parsedUrl = new URL(urlString);
            
            // 1. Referral Link Detection (e.g. ?ref=RIDE100)
            const refCode = parsedUrl.searchParams.get('ref') || parsedUrl.searchParams.get('referrer');
            if (refCode) {
              console.log('[Deep Linking] referral code auto-detected:', refCode);
              localStorage.setItem('grezto_referral_code', refCode);
              toast.success(`Referral code "${refCode}" auto-applied! 🎉`, { id: 'grezto-ref-toast', duration: 4000 });
              triggerLightHapticVibration();
            }

            // 2. Search Parameter Detection (e.g. ?search=Veggies or ?q=Milk)
            const searchVal = parsedUrl.searchParams.get('search') || parsedUrl.searchParams.get('q');
            if (searchVal) {
              const decodedSearch = decodeURIComponent(searchVal);
              console.log('[Deep Linking] Initiating search overlay with query:', decodedSearch);
              setGrocerySearchQuery(decodedSearch);
              setShowSearchOverlay(true);
              triggerLightHapticVibration();
              return;
            }

            // 3. Search Path Detection (e.g. /search?q=Fruit)
            if (parsedUrl.pathname.startsWith('/search')) {
              const q = parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('search');
              if (q) {
                const decodedQuery = decodeURIComponent(q);
                setGrocerySearchQuery(decodedQuery);
                setShowSearchOverlay(true);
                triggerLightHapticVibration();
                return;
              }
            }

            // 4. Direct Product Slug Redirection (e.g. /product/fresh_coriander or /item/organic_milk)
            if (parsedUrl.pathname.startsWith('/product/') || parsedUrl.pathname.startsWith('/item/')) {
              const pathParts = parsedUrl.pathname.split('/');
              const productSlug = pathParts[pathParts.length - 1];
              if (productSlug) {
                const decodedSlug = decodeURIComponent(productSlug).replace(/_/g, ' ').replace(/-/g, ' ');
                console.log('[Deep Linking] Found product slug from URL:', decodedSlug);
                setGrocerySearchQuery(decodedSlug);
                setShowSearchOverlay(true);
                triggerLightHapticVibration();
                toast.success(`Opening "${decodedSlug}" ... 🛍️`, { id: 'grezto-deeplink-product', duration: 3000 });
                return;
              }
            }
          } catch (urlErr) {
            console.error('[Deep Linking] Error parsing deep link URL:', urlErr);
          }
        });

        // Parse launch URL if the app was completely closed and started via deep link
        const launchUrl = await CapApp.getLaunchUrl();
        if (launchUrl && launchUrl.url) {
          console.log('[Deep Linking] App cold started with launch URL:', launchUrl.url);
          // Manually fire the handler with launchUrl details
          const dummyEvent = { url: launchUrl.url };
          setTimeout(() => {
            // Trigger with slight delay so context and components have loaded completely
            window.dispatchEvent(new CustomEvent('grezto-handle-deeplink', { detail: dummyEvent }));
          }, 1500);
        }
      } catch (err) {
        console.log('[Deep Linking] Bypassed register (non-native platform).');
      }
    }

    registerUrlOpenListener();

    // Register a custom window listener for cold starts
    const handleColdDeeplink = (e: Event) => {
      const eventDetail = (e as CustomEvent).detail;
      if (eventDetail && eventDetail.url) {
        console.log('[Deep Linking] Handling cold started URL:', eventDetail.url);
        try {
          const parsedUrl = new URL(eventDetail.url);
          const refCode = parsedUrl.searchParams.get('ref') || parsedUrl.searchParams.get('referrer');
          if (refCode) {
            localStorage.setItem('grezto_referral_code', refCode);
            toast.success(`Referral code "${refCode}" auto-applied! 🎉`, { id: 'grezto-ref-toast', duration: 4000 });
            triggerLightHapticVibration();
          }

          const searchVal = parsedUrl.searchParams.get('search') || parsedUrl.searchParams.get('q');
          if (searchVal) {
            const decodedSearch = decodeURIComponent(searchVal);
            setGrocerySearchQuery(decodedSearch);
            setShowSearchOverlay(true);
            triggerLightHapticVibration();
            return;
          }

          if (parsedUrl.pathname.startsWith('/product/') || parsedUrl.pathname.startsWith('/item/')) {
            const pathParts = parsedUrl.pathname.split('/');
            const productSlug = pathParts[pathParts.length - 1];
            if (productSlug) {
              const decodedSlug = decodeURIComponent(productSlug).replace(/_/g, ' ').replace(/-/g, ' ');
              setGrocerySearchQuery(decodedSlug);
              setShowSearchOverlay(true);
              triggerLightHapticVibration();
              toast.success(`Opening "${decodedSlug}" ... 🛍️`, { id: 'grezto-deeplink-product', duration: 3000 });
            }
          }
        } catch (err) {
          console.error('[Deep Linking] Error in cold start handler:', err);
        }
      }
    };

    window.addEventListener('grezto-handle-deeplink', handleColdDeeplink);

    return () => {
      if (urlOpenListener) {
        urlOpenListener.remove().catch((e: any) => console.log('Url listener unregister fail:', e));
      }
      window.removeEventListener('grezto-handle-deeplink', handleColdDeeplink);
    };
  }, []);

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
                      className="fixed inset-0 z-50 bg-white flex justify-center overflow-y-auto"
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
                      className="fixed inset-0 z-50 bg-white flex justify-center overflow-y-auto"
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
                      className="fixed inset-0 z-50 bg-[#f8fafc] flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-[#f8fafc] h-full overflow-y-auto flex flex-col relative"
                      >
                        <AdminPanel onClose={() => setShowAdmin(false)} />
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
                      className="fixed inset-0 z-50 bg-slate-50 flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full overflow-y-auto flex flex-col relative"
                      >
                        <MerchantPanel 
                          shop={activeMerchantShop} 
                          onClose={() => {
                            setShowMerchant(false);
                            setActiveMerchantShop(null);
                          }} 
                        />
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
                      className="fixed inset-0 z-50 bg-slate-50 flex justify-center"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full flex flex-col relative overflow-hidden"
                      >
                        <RiderConsole onClose={() => setShowRider(false)} initialProfile={globalRiderProfile} />
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
                      className="fixed inset-0 z-50 bg-slate-50 flex justify-center overflow-hidden"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: "spring", stiffness: 350, damping: 32 }}
                        className="w-full max-w-none lg:max-w-5xl bg-slate-50 h-full flex flex-col relative"
                      >
                        <RiderManagement onClose={() => setShowRiderManagement(false)} />
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
                    <AdminAnalytics onClose={() => setShowAnalyticsModal(false)} />
                  )}
                </AnimatePresence>

                {/* Merchant Ledger calculator overlay */}
                <AnimatePresence>
                  {showMerchantCalculationModal && userShop && (
                    <MerchantCalculation shop={userShop} onClose={() => setShowMerchantCalculationModal(false)} />
                  )}
                </AnimatePresence>

                {/* PWA custom Notification board overlay */}
                <AnimatePresence>
                  {showNotifications && (
                    <GlobalNotificationsModal onClose={() => setShowNotifications(false)} />
                  )}
                </AnimatePresence>

                {/* New incoming order push banner modal */}
                <IncomingOrderAlert
                  incomingOrderAlert={incomingOrderAlert}
                  setIncomingOrderAlert={setIncomingOrderAlert}
                  dismissedOrderIdsRef={dismissedOrderIdsRef}
                  stopAlertAlarmLoop={stopAlertAlarmLoop}
                  startAlertAlarmLoop={startAlertAlarmLoop}
                  alarmMuted={alarmMuted}
                  setAlarmMuted={setAlarmMuted}
                  onAccept={handleAcceptAndRedirect}
                />

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
      <AnimatePresence>
        {showSessionExpiredModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col items-center text-center"
            >
              {/* Alert Icon */}
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 animate-bounce">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                Session Expired! 🛑
              </h3>
              
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Bhai, security aur privacy reasons ki wajah se aapka login session expire ho gaya hai. Kripya fir se login karein taki aap smoothly orders aur menus manage kar sakein.
              </p>

              <button
                onClick={handleSessionExpiredReset}
                className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold rounded-2xl shadow-lg shadow-red-500/20 transition-all duration-200"
              >
                Login Fir Se Karein 🔐
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
