import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { triggerLightHapticVibration } from '../services/nativeService';

interface AppDeepLinkingProps {
  setGrocerySearchQuery: (query: string) => void;
  setShowSearchOverlay: (show: boolean) => void;
}

export function useAppDeepLinking({
  setGrocerySearchQuery,
  setShowSearchOverlay
}: AppDeepLinkingProps) {
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
}
