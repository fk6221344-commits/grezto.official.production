import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { staticCategories as categories } from '../data/categories';

import HomeBanners from './home/HomeBanners';
import CategoryList from './home/CategoryList';
import HotelDetailsDrawer from './home/HotelDetailsDrawer';
import ShopLocatorModal from './home/ShopLocatorModal';
import SystemOfflineOverlay from './home/SystemOfflineOverlay';
import HotelListTab from './home/HotelListTab';

// Refactored helpers & components
import { calculateGeodistance } from '../utils/geo';
import { useSystemCountdown } from '../hooks/useSystemCountdown';
import { useHomeDataFetching, globalShopsCache } from '../hooks/useHomeDataFetching';
import GroceryProductGrid from './home/GroceryProductGrid';

export default function Home({ 
  searchQuery = '', 
  onHotelDetailsToggle 
}: { 
  searchQuery?: string; 
  onHotelDetailsToggle?: (isOpen: boolean) => void;
}) {
  const { t } = useLanguage();
  const { user } = useUser();

  // Mode tab selector: 'grocery' (standard search/farm supply) or 'hotel' (Zomato-style food list)
  const [activeMode, setActiveMode] = useState<'grocery' | 'hotel'>('grocery');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Auto-switch to grocery mode and All category if user starts typing a global search query
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== '') {
      if (activeMode !== 'grocery') {
        setActiveMode('grocery');
      }
      if (activeCategory !== 'All') {
        setActiveCategory('All');
      }
    }
  }, [searchQuery, activeMode, activeCategory]);

  // Use the extracted modular custom hook to fetching and caching home states
  const {
    isHomeLoading,
    dbProducts,
    localTick,
    dbShops,
    dbCategories,
    isProductsLoading,
    isSystemOnline,
    systemReopenTime,
    handleRatingUpdated
  } = useHomeDataFetching(user.activeCity || "Kawarhagi", activeCategory);

  const shops = useMemo(() => {
    let finalShops = [...dbShops];

    // Filter out blocked shops
    finalShops = finalShops.filter((s: any) => s.status !== 'blocked');

    // City Hub Filtering
    const currentCity = (user.activeCity || "Kawarhagi").toLowerCase();
    finalShops = finalShops.filter((s: any) => {
      if (s.city) {
        return s.city.toLowerCase() === currentCity;
      }
      const addressLower = (s.address || "").toLowerCase();
      if (currentCity === "guwahati") {
        return addressLower.includes("guwahati");
      } else if (currentCity === "morigaon") {
        return addressLower.includes("morigaon");
      } else {
        return !addressLower.includes("guwahati") && !addressLower.includes("morigaon");
      }
    });

    // Clean deduplication of shop IDs
    const uniqueShops: any[] = [];
    const seenShopIds = new Set<string>();
    finalShops.forEach((s: any) => {
      if (s && s.id && !seenShopIds.has(s.id)) {
        seenShopIds.add(s.id);
        uniqueShops.push(s);
      }
    });

    return uniqueShops;
  }, [dbShops, localTick, user.activeCity]);

  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [showMapLocator, setShowMapLocator] = useState(false);

  // Search filter for restaurants
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');

  // Interactive profile details drawer
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<any | null>(null);

  // Lazy loading state for products rendering
  const [visibleCount, setVisibleCount] = useState(20);
  const [observerTarget, setObserverTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(20); // Reset when filters change
  }, [activeCategory, searchQuery, selectedShopId]);

  useEffect(() => {
    if (!observerTarget) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget);

    return () => observer.disconnect();
  }, [observerTarget]);

  // Dynamic mobile scroll locking hook to prevent background scrolling when detail sheet is active
  useEffect(() => {
    if (selectedHotelForDetails) {
      document.body.style.overflow = 'hidden';
      if (onHotelDetailsToggle) onHotelDetailsToggle(true);
    } else {
      document.body.style.overflow = '';
      if (onHotelDetailsToggle) onHotelDetailsToggle(false);
    }
    return () => {
      document.body.style.overflow = '';
      if (onHotelDetailsToggle) onHotelDetailsToggle(false);
    };
  }, [selectedHotelForDetails, onHotelDetailsToggle]);

  useEffect(() => {
    const handleOpenShopDetails = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetShopId = customEvent.detail?.shopId;
      if (targetShopId) {
        const foundShop = shops.find((s: any) => s.id === targetShopId);
        if (foundShop) {
          setSelectedHotelForDetails(foundShop);
        }
      }
    };

    window.addEventListener('open-shop-details', handleOpenShopDetails);
    return () => {
      window.removeEventListener('open-shop-details', handleOpenShopDetails);
    };
  }, [shops]);

  // Sync current filtered/loaded shops list to localStorage so components can immediately check shop status
  useEffect(() => {
    if (shops && shops.length > 0) {
      try {
        localStorage.setItem('grezto_cached_shops', JSON.stringify(shops));
      } catch (e) {
        console.warn("Failed to write grezto_cached_shops to localStorage", e);
      }
    }
  }, [shops]);

  const activeDisplayCategories = useMemo(() => {
    // Start with all standard hardcoded categories (such as Cake, All, Vegetables, etc.)
    const combined: any[] = [];
    const seen = new Set<string>();

    categories.forEach(c => {
      if (c && c.id) {
        const idNorm = c.id.trim().toLowerCase();
        if (!seen.has(idNorm)) {
          seen.add(idNorm);
          combined.push({ ...c });
        }
      }
    });
    
    // Smoothly merge in any custom categories from Firestore
    dbCategories.forEach(dbCat => {
      if (dbCat && dbCat.id) {
        const idNorm = dbCat.id.trim().toLowerCase();
        const existsIdx = combined.findIndex(c => c.id.trim().toLowerCase() === idNorm);
        if (existsIdx === -1) {
          combined.push({
            id: dbCat.id,
            name: dbCat.name || dbCat.id,
            displayName: dbCat.displayName || dbCat.name || dbCat.id,
            imageUrl: dbCat.imageUrl,
            bgColor: dbCat.bgColor || 'bg-pink-50'
          });
        } else {
          // If it exists statically, allow Firestore attributes to override or enrich (e.g. custom image uploaded by user)
          combined[existsIdx] = {
            ...combined[existsIdx],
            ...dbCat,
            displayName: dbCat.displayName || dbCat.name || combined[existsIdx].id
          };
        }
      }
    });

    // Final sweep to make absolutely sure no duplicates or empty values seep through
    const finalUnique: any[] = [];
    const finalSeen = new Set<string>();
    combined.forEach(cat => {
      if (cat && cat.id) {
        const idNorm = cat.id.trim().toLowerCase();
        if (!finalSeen.has(idNorm)) {
          finalSeen.add(idNorm);
          finalUnique.push(cat);
        }
      }
    });

    return finalUnique;
  }, [dbCategories]);

  // Calculate geodistance wrapper
  const calculateGeodistanceWithUser = useCallback((shopLat: number, shopLng: number) => {
    return calculateGeodistance(shopLat, shopLng, user.lat, user.lng);
  }, [user.lat, user.lng]);

  const allCombinedProducts = useMemo(() => {
    const deletedIdsVal = new Set(
      dbProducts.filter(p => (p as any).deleted).map(p => p.id)
    );

    const combinedProductsList = [
      ...dbProducts.filter(p => !(p as any).deleted)
    ];

    // Deduplicate products
    const uniqueList: any[] = [];
    const seenIds = new Set<string>();
    for (const p of combinedProductsList) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        uniqueList.push(p);
      }
    }
    return { uniqueList, deletedIdsVal };
  }, [dbProducts]);

  const searchFeedData = useMemo(() => {
    const qClean = searchQuery.trim().toLowerCase();
    if (!qClean) return null;
    
    const { uniqueList } = allCombinedProducts;

    // Filter out products belonging to exclusive/pinned shops
    const nonExclusiveUniqueList = uniqueList.filter(p => {
      const pAny = p as any;
      const shopId = pAny.shopId || pAny.productShopId;
      const shop = shopId && shopId !== 'direct' 
        ? (dbShops.find((s: any) => s.id === shopId) || globalShopsCache.find((s: any) => s.id === shopId))
        : null;

      if (shop && shop.status === 'blocked') {
        return false;
      }

      if (shop && (shop.pinned === true || shop.pinned === 'true' || shop.pinned === 1 || shop.pinned === '1')) {
        if (selectedShopId !== shopId) {
          return false;
        }
      }
      return true;
    });
    
    // Tiered lists for high relevance
    const prefixMatches: any[] = [];
    const substringMatches: any[] = [];
    const otherMatches: any[] = [];
    
    const fuse = new Fuse(nonExclusiveUniqueList, {
      keys: ['name', 'category', 'description'],
      threshold: 0.45,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
    
    const fuzzyResults = fuse.search(searchQuery).map(res => res.item);
    const seenIds = new Set<string>();

    // Prefix & substring matches in the name
    for (const p of nonExclusiveUniqueList) {
      if (!p.name) continue;
      const nameLower = p.name.toLowerCase();
      
      if (nameLower.startsWith(qClean)) {
        prefixMatches.push(p);
        seenIds.add(p.id);
      } else if (nameLower.includes(qClean)) {
        substringMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // Fuzzy search matches
    for (const p of fuzzyResults) {
      if (!seenIds.has(p.id)) {
        otherMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // Category & description matches
    for (const p of nonExclusiveUniqueList) {
      if (seenIds.has(p.id)) continue;
      
      const catLower = (p.category || '').toLowerCase();
      const descLower = (p.description || '').toLowerCase();
      
      if (catLower.includes(qClean) || descLower.includes(qClean)) {
        otherMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // Combine tiers
    const combinedResults = [...prefixMatches, ...substringMatches, ...otherMatches];
    
    const uniqueNames = new Set<string>();
    const exactMatches: any[] = [];
    
    for (const p of combinedResults) {
      if (p.name && !uniqueNames.has(p.name.toLowerCase())) {
        uniqueNames.add(p.name.toLowerCase());
        exactMatches.push(p);
      }
    }
    
    let topCategory: string | null = null;
    let relatedMatches: any[] = [];
    let fallbackMatches: any[] = [];
    
    if (exactMatches.length > 0) {
      topCategory = exactMatches[0].category || null;
      if (topCategory) {
        const related = nonExclusiveUniqueList.filter(p => p.category === topCategory && !exactMatches.some(e => e.id === p.id));
        const shuffledRelated = [...related].sort((a, b) => {
          const hashA = String(a.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hashB = String(b.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (hashA % 13) - (hashB % 13);
        });
        relatedMatches = shuffledRelated;
      }
    } else {
      const qLower = qClean;
      if (qLower.includes('pizza') || qLower.includes('burger') || qLower.includes('biryani') || qLower.includes('roll')) {
        topCategory = 'Fast Food';
      } else if (qLower.includes('veg') || qLower.includes('tomato') || qLower.includes('potato') || qLower.includes('onion')) {
        topCategory = 'Vegetables';
      } else if (qLower.includes('cake') || qLower.includes('sweet') || qLower.includes('pastry')) {
        topCategory = 'Cake';
      }
      
      if (topCategory) {
        fallbackMatches = nonExclusiveUniqueList.filter(p => p.category === topCategory);
      } else {
        fallbackMatches = nonExclusiveUniqueList.filter(p => p.category === 'Fast Food' || p.category === 'Vegetables');
      }
    }
    
    return { exactMatches, relatedMatches, fallbackMatches, topCategory };
  }, [searchQuery, allCombinedProducts, shops, dbShops]);

  const filteredProducts = useMemo(() => {
    const { uniqueList } = allCombinedProducts;
    
    if (searchQuery && searchQuery.trim() !== '') {
      return []; // handled by searchFeedData
    }
    
    let finalFiltered = uniqueList.filter(p => {
        const pAny = p as any;
        const shopId = pAny.shopId || pAny.productShopId;
        const shop = shopId && shopId !== 'direct' 
          ? (dbShops.find((s: any) => s.id === shopId) || globalShopsCache.find((s: any) => s.id === shopId))
          : null;

        if (shop && shop.status === 'blocked') {
          return false;
        }

        // Hide products belonging to exclusive/pinned shops from the main homepage feed
        // BUT if the user specifically selects/filters by this shop, we MUST show them!
        if (shop && (shop.pinned === true || shop.pinned === 'true' || shop.pinned === 1 || shop.pinned === '1')) {
          if (selectedShopId !== shopId) {
            return false;
          }
        }

        if (selectedShopId) {
          if (selectedShopId === 'direct') {
            if (pAny.shopId && pAny.shopId !== 'direct') return false;
          } else {
            if (pAny.shopId !== selectedShopId) return false;
          }
        }
        
        // Category check
        if (activeCategory !== 'All') {
          if (activeCategory === 'Fast Food') {
            const isFromHotel = pAny.shopId && shops.some((s: any) => s.id === pAny.shopId && (s.type === 'hotel' || s.type === 'restaurant'));
            const isExplicitFastFood = p.category === activeCategory;
            if (!isFromHotel && !isExplicitFastFood) {
              return false;
            }
          } else if (p.category !== activeCategory) {
            return false;
          }
        }
        return true;
      });
      
      // Bonus: Randomized/Shuffled feed for "All" category
      if (activeCategory === 'All') {
        finalFiltered.sort((a, b) => {
          const hashA = String(a.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hashB = String(b.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (hashA % 13) - (hashB % 13) || hashA - hashB;
        });
      }

    // Append isClosed state and sort disabled/closed to bottom
    const mapped = finalFiltered.map((p: any) => {
      const parentShop = shops.find((s: any) => s.id === p.shopId);
      const isClosed = !isSystemOnline || (parentShop && parentShop.isOpen === false);
      return { ...p, isClosed };
    });

    mapped.sort((a, b) => {
      // 1. Fully Closed shops go deepest
      if (a.isClosed && !b.isClosed) return 1;
      if (!a.isClosed && b.isClosed) return -1;
      
      // 2. Out of stock goes down just above closed
      const aOOS = a.stock <= 0 ? 1 : 0;
      const bOOS = b.stock <= 0 ? 1 : 0;
      if (aOOS !== bOOS) return aOOS - bOOS;

      return 0;
    });

    return mapped;
  }, [selectedShopId, activeCategory, searchQuery, allCombinedProducts, shops, dbShops, isSystemOnline]);

  // Shared shop sorting function (pinned first, then highest rating first)
  const sortShops = (a: any, b: any) => {
    const aClosed = !isSystemOnline || a.isOpen === false;
    const bClosed = !isSystemOnline || b.isOpen === false;
    if (aClosed && !bClosed) return 1;
    if (!aClosed && bClosed) return -1;

    const pinA = (a.pinned === true || a.pinned === 'true' || a.pinned === 1 || a.pinned === '1') ? 1 : 0;
    const pinB = (b.pinned === true || b.pinned === 'true' || b.pinned === 1 || b.pinned === '1') ? 1 : 0;
    if (pinA !== pinB) {
      return pinB - pinA;
    }
    const ratingA = a.rating !== undefined ? parseFloat(a.rating) : 1.0;
    const ratingB = b.rating !== undefined ? parseFloat(b.rating) : 1.0;
    return ratingB - ratingA;
  };

  // Calculate rating-sorted Hotels index
  const baseHotels = shops
    .filter((s: any) => s.type === 'hotel' || s.type === 'restaurant')
    .sort(sortShops);
    
  let activeHotels = baseHotels;
  if (restaurantSearchQuery && restaurantSearchQuery.trim() !== '') {
    const fuse = new Fuse(baseHotels, {
      keys: ['name', 'category', 'description'],
      threshold: 0.2,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
    activeHotels = fuse.search(restaurantSearchQuery).map(result => result.item);
  }

  // Load menu items for hotel details modal
  const getDishesForHotel = (hotelId: string) => {
    if (!hotelId) return [];
    const { uniqueList, deletedIdsVal } = allCombinedProducts;
    return uniqueList.filter(p => p.shopId && p.shopId === hotelId && !p.deleted && !deletedIdsVal.has(p.id));
  };

  // Calculate countdown to next 8:30 AM via extracted custom hook
  const countdown = useSystemCountdown(isSystemOnline, systemReopenTime);

  return (
    <div className="pb-28 text-left">
      {!isSystemOnline && (
        <SystemOfflineOverlay countdown={countdown} />
      )}

      {/* Visual Mode Switching segment tabs */}
      {!searchQuery && (
        <div className="px-2 mt-4 select-none flex items-center gap-1.5 min-[360px]:gap-2.5" id="mode-switching-container">
          {/* Market Button */}
          <motion.button
            type="button"
            onClick={() => setActiveMode('grocery')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 h-[38px] rounded-xl text-[9px] min-[360px]:text-[10px] min-[390px]:text-[10.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-1 cursor-pointer select-none focus:outline-none border ${
              activeMode === 'grocery'
                ? 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-slate-950 shadow-[0_8px_22px_rgba(15,23,42,0.45),_0_2px_8px_rgba(30,58,138,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)] font-black'
                : 'bg-white text-slate-700 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:bg-slate-50 hover:text-slate-900 font-extrabold'
            }`}
            id="mode-button-grocery"
          >
            <span className={`transition-transform duration-300 inline-block shrink-0 ${activeMode === 'grocery' ? 'scale-110 rotate-3' : 'scale-100 rotate-0'}`}>
              🥬
            </span>
            <span className="truncate whitespace-nowrap">Grezto Market</span>
          </motion.button>
 
          {/* Hotels & Restaurants Button */}
          <motion.button
            type="button"
            onClick={() => setActiveMode('hotel')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 h-[38px] rounded-xl text-[9px] min-[360px]:text-[10px] min-[390px]:text-[10.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-1 cursor-pointer select-none focus:outline-none border ${
              activeMode === 'hotel'
                ? 'bg-gradient-to-r from-[#cc0c23] via-[#ef233c] to-[#b7091a] text-white border-red-900 shadow-[0_8px_22px_rgba(239,35,60,0.45),_0_2px_8px_rgba(204,12,35,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] font-black'
                : 'bg-white text-slate-700 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:bg-slate-50 hover:text-slate-900 font-extrabold'
            }`}
            id="mode-button-hotel"
          >
            <span className={`transition-transform duration-300 inline-block shrink-0 ${activeMode === 'hotel' ? 'scale-110 -rotate-3' : 'scale-100 rotate-0'}`}>
              🍔
            </span>
            <span className="truncate whitespace-nowrap">Hotels & Restaurants</span>
          </motion.button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeMode === 'grocery' ? (
          <motion.div
            key="grocery_mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <AnimatePresence mode="popLayout">
              {!searchQuery && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomeBanners onPromoClick={(q) => {
                    window.dispatchEvent(new CustomEvent('grezto-search', { detail: q }));
                  }} />

                  <CategoryList
                    categories={activeDisplayCategories}
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                    isLoading={isHomeLoading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Extracted modular products rendering block */}
            <GroceryProductGrid
              searchQuery={searchQuery}
              searchFeedData={searchFeedData}
              selectedShopId={selectedShopId}
              setSelectedShopId={setSelectedShopId}
              shops={shops}
              filteredProducts={filteredProducts}
              visibleCount={visibleCount}
              setObserverTarget={setObserverTarget}
              isProductsLoading={isProductsLoading}
              isHomeLoading={isHomeLoading}
            />
          </motion.div>
        ) : (
          <HotelListTab 
            activeHotels={activeHotels}
            isSystemOnline={isSystemOnline}
            calculateGeodistance={calculateGeodistanceWithUser}
            setSelectedHotelForDetails={setSelectedHotelForDetails}
            getDishesForHotel={getDishesForHotel}
            isLoading={isHomeLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedHotelForDetails && (
          <HotelDetailsDrawer
            hotel={selectedHotelForDetails}
            onClose={() => setSelectedHotelForDetails(null)}
            calculateGeodistance={calculateGeodistanceWithUser}
            getDishesForHotel={getDishesForHotel}
            onRatingUpdated={handleRatingUpdated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapLocator && (
          <ShopLocatorModal
            shops={shops}
            onClose={() => setShowMapLocator(false)}
            onVisitShop={(shop: any) => {
              if (shop.type === 'hotel' || shop.type === 'restaurant') {
                setSelectedHotelForDetails(shop);
                setActiveMode('hotel');
              } else {
                setSelectedShopId(shop.id);
              }
              setShowMapLocator(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
