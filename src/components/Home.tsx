import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  Zap, 
  Star, 
  MapPin, 
  Search, 
  Plus, 
  Minus, 
  Landmark, 
  Award, 
  ThumbsUp, 
  X, 
  Check, 
  Clock, 
  ShoppingBag,
  Info,
  ChevronLeft,
  MessageCircle,
  Phone
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import ProductCard from './ProductCard';
import { fetchDualLayerHomeData, fetchProductsByCategory } from '../utils/cacheApi';
import { useUser } from '../context/UserContext';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import { staticCategories as categories } from '../data/categories';
import { supabase } from '../services/supabase';

import SlidingBanner from './home/SlidingBanner';
import CategoryList from './home/CategoryList';
import HotelDetailsDrawer from './home/HotelDetailsDrawer';
import ShopLocatorModal from './home/ShopLocatorModal';
import SystemOfflineOverlay from './home/SystemOfflineOverlay';
import HotelListTab from './home/HotelListTab';

// Module-level global offline caches to ensure instant loads when switching tabs
let globalCategoriesCache: any[] = [];
let globalProductsCache: any[] = [];
let globalShopsCache: any[] = [];
let globalProductsCacheByCategory: Record<string, any[]> = {};

const ProductCardSkeleton = () => (
  <div className="bg-white rounded-[1.25rem] p-1 pb-2 flex flex-col justify-between border border-gray-100 shadow-sm animate-pulse select-none">
    {/* Image Skeleton */}
    <div className="aspect-[5/4] rounded-[1rem] bg-gray-100 mb-2 w-full" />
    
    {/* Content Area */}
    <div className="px-1 flex-1 flex flex-col justify-between">
      <div>
        {/* Title Lines */}
        <div className="h-3 bg-gray-100 rounded-md w-11/12 mb-1.5" />
        <div className="h-3 bg-gray-100 rounded-md w-2/3 mb-2" />
        {/* Unit Line */}
        <div className="h-2 bg-gray-50 rounded-md w-1/2 mb-3" />
      </div>
      
      {/* Price & Add Button Row */}
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="h-4 bg-gray-100 rounded-md w-1/4" />
        <div className="h-7 bg-gray-100 rounded-xl w-14" />
      </div>
    </div>
  </div>
);

export default function Home({ 
  searchQuery = '', 
  onHotelDetailsToggle 
}: { 
  searchQuery?: string; 
  onHotelDetailsToggle?: (isOpen: boolean) => void;
}) {
  const { t } = useLanguage();
  const { user, userShop } = useUser();
  const { addToCart, items: cartItems, updateQuantity } = useCart();

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
  const [isHomeLoading, setIsHomeLoading] = useState(() => !(globalCategoriesCache.length > 0 && globalShopsCache.length > 0));
  const [dbProducts, setDbProducts] = useState<any[]>(() => globalProductsCache);
  const [localTick, setLocalTick] = useState(0);
  const [dbShops, setDbShops] = useState<any[]>(() => globalShopsCache);
  const shops = useMemo(() => {
    let finalShops = [...dbShops];

    // Filter out blocked shops
    finalShops = finalShops.filter((s: any) => s.status !== 'blocked');

    // 4. City Hub Filtering
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

    // 5. Clean deduplication of shop IDs
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
  const [activeRestaurantCategory, setActiveRestaurantCategory] = useState('All');

  // Interactive profile details drawer
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<any | null>(null);

  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(true);
  const [systemReopenTime, setSystemReopenTime] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('grezto_system_online', JSON.stringify(isSystemOnline));
    } catch (e) {
      console.warn("Failed to write grezto_system_online to localStorage", e);
    }
  }, [isSystemOnline]);

  // Lazy loading state
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

  useEffect(() => {
    if (!supabase) return;
    
    // Initial fetch of system config if available
    const fetchConfig = async () => {
      try {
        const { data } = await supabase.from('system_config').select('*').eq('id', 'config').single();
        if (data) {
          if (data.isSystemOnline !== undefined) setIsSystemOnline(data.isSystemOnline);
          if (data.systemReopenTime !== undefined) setSystemReopenTime(data.systemReopenTime);
        }
      } catch(e) {}
    };
    fetchConfig();

    const configSub = supabase.channel('home_config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, (payload) => {
         const data = payload.new as any;
         if (data) {
            if (data.isSystemOnline !== undefined) setIsSystemOnline(data.isSystemOnline);
            if (data.systemReopenTime !== undefined) setSystemReopenTime(data.systemReopenTime);
         }
      })
      .subscribe();

    return () => { configSub.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const shopsSub = supabase.channel('home_shops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, async () => {
         const { data: liveShops } = await supabase.from('shops').select('*');
         if (liveShops) {
            setDbShops(liveShops as any[]);
            globalShopsCache = liveShops as any[];
            try {
              localStorage.setItem('grezto_cached_shops', JSON.stringify(liveShops));
            } catch(e) {}
         }
      })
      .subscribe();
    return () => { shopsSub.unsubscribe(); };
  }, []);

  const handleRatingUpdated = useCallback((hotelId: string, newAvg: string, newCount: number) => {
    setDbShops(prev => prev.map(s => s.id === hotelId ? { ...s, rating: newAvg, ratingCount: newCount } : s));
  }, []);

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

  // Sync current filtered/loaded shops list to localStorage so components can immediately check shop status (exclusive/pinned)
  useEffect(() => {
    if (shops && shops.length > 0) {
      try {
        localStorage.setItem('grezto_cached_shops', JSON.stringify(shops));
      } catch (e) {
        console.warn("Failed to write grezto_cached_shops to localStorage", e);
      }
    }
  }, [shops]);

  const [dbCategories, setDbCategories] = useState<any[]>(() => globalCategoriesCache);
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
            // Fallback to name/displayName gracefully
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

  // Local product cache per category to avoid flickering during category switch
  const [productsCache, setProductsCache] = useState<Record<string, any[]>>(() => globalProductsCacheByCategory);
  const [isProductsLoading, setIsProductsLoading] = useState(() => !globalProductsCacheByCategory[activeCategory]);

  useEffect(() => {
    let isMounted = true;
    
    // Smooth Transition: If we already have it in local/global memory cache, show instantly
    if (productsCache[activeCategory] && productsCache[activeCategory].length > 0) {
      setDbProducts(productsCache[activeCategory]);
      setIsProductsLoading(false);
    } else {
      setIsProductsLoading(true);
    }

    fetchProductsByCategory(activeCategory, (syncedProds) => {
      if (isMounted && syncedProds) {
        globalProductsCacheByCategory[activeCategory] = syncedProds;
        setProductsCache(prev => ({ ...prev, [activeCategory]: syncedProds }));
        setDbProducts(syncedProds);
      }
    }).then(prods => {
      if (isMounted && prods) {
        globalProductsCacheByCategory[activeCategory] = prods;
        setProductsCache(prev => ({ ...prev, [activeCategory]: prods }));
        setDbProducts(prods);
        setIsProductsLoading(false);
      }
    });
    
    return () => { isMounted = false; };
  }, [activeCategory]);

  useEffect(() => {
    // 1. Core Dual-layer cached loader (Redis) for Shops & Categories
    // If we already have caches in memory, don't set loading to true to prevent screen flash
    if (globalCategoriesCache.length === 0 || globalShopsCache.length === 0) {
      setIsHomeLoading(true);
    }
    // Warm up the full product catalog cache for the SearchOverlay cross-category fuzzy search
    fetchProductsByCategory('All').then((allProds) => {
      if (allProds && allProds.length > 0) {
        try {
          localStorage.setItem('grezto_cached_products', JSON.stringify(allProds));
        } catch (e) {
          console.warn("Quota exceeded for grezto_cached_products, skipping cache");
        }
        globalProductsCache = allProds;
      }
    }).catch(err => {
      console.warn("Failed to background fetch products for search overlay", err);
    });

    fetchDualLayerHomeData(user.activeCity).then(({ data, source }) => {
      const finishLoading = () => {
        setIsHomeLoading(false);
      };

      let shopsLoaded = false;
      let categoriesLoaded = false;

      const checkFinished = () => {
        if (shopsLoaded && categoriesLoaded) {
          finishLoading();
        }
      };

      if (data && data.recommendedProducts && data.recommendedProducts.length > 0) {
        setDbProducts((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = data.recommendedProducts.filter((p: any) => !existingIds.has(p.id));
          const updated = [...prev, ...newProducts];
          globalProductsCache = updated;
          return updated;
        });
      }

      if (data && data.shops && data.shops.length > 0) {
        setDbShops(data.shops);
        globalShopsCache = data.shops;
        shopsLoaded = true;
        checkFinished();
      } else if (supabase) {
        supabase.from('shops').select('*').then((res: any) => {
          if (res.data) {
             setDbShops(res.data);
             globalShopsCache = res.data;
          }
          shopsLoaded = true;
          checkFinished();
        });
      } else {
        shopsLoaded = true;
        checkFinished();
      }
      
      if (data && data.categories && data.categories.length > 0) {
        setDbCategories(data.categories);
        globalCategoriesCache = data.categories;
        categoriesLoaded = true;
        checkFinished();
      } else if (supabase) {
        supabase.from('categories').select('*').then((res: any) => {
          if (res.data) {
             setDbCategories(res.data);
             globalCategoriesCache = res.data;
          }
          categoriesLoaded = true;
          checkFinished();
        });
      } else {
        categoriesLoaded = true;
        checkFinished();
      }
    }).catch((cacheError) => {
      console.warn("[DUAL CACHE ERROR] Running pure database fallbacks:", cacheError);
      
      if (supabase) {
        Promise.all([
          supabase.from('products').select('*').then((res: any) => {
            if (res.data) setDbProducts(res.data);
          }),
          supabase.from('shops').select('*').then((res: any) => {
            if (res.data) setDbShops(res.data);
          }),
          supabase.from('categories').select('*').then((res: any) => {
            if (res.data) setDbCategories(res.data);
          })
        ]).finally(() => {
          setIsHomeLoading(false);
        });
      } else {
        setIsHomeLoading(false);
      }
    });
  }, [user.activeCity]);

  useEffect(() => {
    const handleUpdate = () => {
      setLocalTick(t => t + 1);
    };
    window.addEventListener('grezto-products-updated', handleUpdate);
    return () => window.removeEventListener('grezto-products-updated', handleUpdate);
  }, []);

  // Phase 5: Real-time CDC (Change Data Capture) WebSocket Streaming
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('products-realtime-home')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[REAL-TIME CDC UPDATE] Received product change:', payload);
          
          const eventType = payload.eventType;
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          setDbProducts((prevProducts) => {
            let updatedList = [...prevProducts];

            if (eventType === 'INSERT') {
              if (!updatedList.some(p => p.id === newRecord.id)) {
                updatedList = [newRecord, ...updatedList];
              }
            } else if (eventType === 'UPDATE') {
              if (newRecord.deleted) {
                updatedList = updatedList.filter(p => p.id !== newRecord.id);
              } else {
                const idx = updatedList.findIndex(p => p.id === newRecord.id);
                if (idx !== -1) {
                  updatedList[idx] = { ...updatedList[idx], ...newRecord };
                } else {
                  updatedList = [newRecord, ...updatedList];
                }
              }
            } else if (eventType === 'DELETE') {
              updatedList = updatedList.filter(p => p.id !== oldRecord.id);
            }

            return updatedList;
          });

          // Also update productsCache to prevent layout shift or stale cached tabs
          setProductsCache((prevCache) => {
            const nextCache = { ...prevCache };
            
            Object.keys(nextCache).forEach((catKey) => {
              let list = [...(nextCache[catKey] || [])];

              if (eventType === 'INSERT') {
                const matchesCategory = catKey === 'All' || newRecord.category === catKey;
                if (matchesCategory && !list.some(p => p.id === newRecord.id)) {
                  list = [newRecord, ...list];
                }
              } else if (eventType === 'UPDATE') {
                if (newRecord.deleted) {
                  list = list.filter(p => p.id !== newRecord.id);
                } else {
                  const idx = list.findIndex(p => p.id === newRecord.id);
                  const matchesCategory = catKey === 'All' || newRecord.category === catKey;
                  
                  if (idx !== -1) {
                    if (matchesCategory) {
                      list[idx] = { ...list[idx], ...newRecord };
                    } else {
                      list = list.filter(p => p.id !== newRecord.id);
                    }
                  } else if (matchesCategory) {
                    list = [newRecord, ...list];
                  }
                }
              } else if (eventType === 'DELETE') {
                list = list.filter(p => p.id !== oldRecord.id);
              }

              nextCache[catKey] = list;
            });

            return nextCache;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute Geodistance using Haversine formula from customer coordinates
  const calculateGeodistance = useCallback((shopLat: number, shopLng: number) => {
    const defaultLat = 26.1522;
    const defaultLng = 91.7602;
    const originLat = user.lat || defaultLat;
    const originLng = user.lng || defaultLng;

    const destLat = shopLat || defaultLat;
    const destLng = shopLng || defaultLng;

    if (Math.abs(originLat - destLat) < 0.00005 && Math.abs(originLng - destLng) < 0.00005) {
      return "250 m";
    }

    const R = 6371; // Earth radius in km
    const dLat = (destLat - originLat) * Math.PI / 180;
    const dLng = (destLng - originLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km

    if (d < 1) {
      return `${Math.round(d * 1000)} meters`;
    }
    return `${d.toFixed(1)} km`;
  }, [user.lat, user.lng]);

  const allCombinedProducts = useMemo(() => {
    const dbIds = new Set(dbProducts.map(p => p.id));
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
      const shop = shopId && shopId !== 'direct' ? dbShops.find((s: any) => s.id === shopId) : null;

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

    // 1. Prefix & substring in the name
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

    // 2. Fuzzy search matches
    for (const p of fuzzyResults) {
      if (!seenIds.has(p.id)) {
        otherMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // 3. Category & description matches
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
        const shop = shopId && shopId !== 'direct' ? dbShops.find((s: any) => s.id === shopId) : null;

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
          // Stable pseudo-random shuffle based on item ID characters
          const hashA = String(a.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hashB = String(b.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (hashA % 13) - (hashB % 13) || hashA - hashB;
        });
      }

    // Append isClosed state and sort disabled/closed to bottom
    const mapped = finalFiltered.map((p: any) => {
      const parentShop = shops.find((s: any) => s.id === p.shopId);
      // Determine if closed. Global system offline overrides local shop status.
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
    // Determine if offline
    const aClosed = !isSystemOnline || a.isOpen === false;
    const bClosed = !isSystemOnline || b.isOpen === false;
    if (aClosed && !bClosed) return 1;
    if (!aClosed && bClosed) return -1;

    const pinA = (a.pinned === true || a.pinned === 'true' || a.pinned === 1 || a.pinned === '1') ? 1 : 0;
    const pinB = (b.pinned === true || b.pinned === 'true' || b.pinned === 1 || b.pinned === '1') ? 1 : 0;
    if (pinA !== pinB) {
      return pinB - pinA; // pinned first
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
      threshold: 0.2, // Stricter matching
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

  // Submit dynamic rating update to Firebase
  // (Rating submission is now entirely handled inside the HotelDetailsDrawer component)

  // Calculate countdown to next 8:30 AM
  const [countdown, setCountdown] = useState<string>("");
  const timeWasPositive = useRef(false);

  useEffect(() => {
    if (isSystemOnline) return;

    const updateTimer = () => {
      const now = new Date();
      let target: Date;
      
      if (systemReopenTime) {
        target = new Date(systemReopenTime);
        if (target.getTime() <= now.getTime()) {
           target = new Date(); // Evaluate to 0
        }
      } else {
        target = new Date();
        target.setHours(8, 30, 0, 0);
        // If it's already past 8:30 AM today, target tomorrow 8:30 AM
        if (now.getTime() > target.getTime()) {
          target.setDate(target.getDate() + 1);
        }
      }

      const diff = target.getTime() - now.getTime();
      
      if (diff > 0) {
        timeWasPositive.current = true;
      }

      if (diff <= 0) {
        setCountdown("00h : 00m : 00s");
        if (timeWasPositive.current) {
          timeWasPositive.current = false;
          if (supabase) {
             // Optimistically try to reopen the system from the client
             supabase.from('system_config').upsert({ id: 'config', isSystemOnline: true, systemReopenTime: null }).then(() => {
                window.location.reload();
             });
          } else {
             window.location.reload();
          }
        }
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSystemOnline, systemReopenTime]);

  return (
    <div className="pb-28 text-left">
      {!isSystemOnline && (
        <SystemOfflineOverlay countdown={countdown} />
      )}

      {/* Visual Mode Switching segment tabs */}
      {!searchQuery && (
        <div className="px-2 mt-4 select-none flex items-center gap-2.5" id="mode-switching-container">
          {/* 🥬 Grezto Market Button */}
          <motion.button
            type="button"
            onClick={() => setActiveMode('grocery')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 h-[38px] rounded-xl text-[10.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer select-none focus:outline-none border ${
              activeMode === 'grocery'
                ? 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-slate-950 shadow-[0_8px_22px_rgba(15,23,42,0.45),_0_2px_8px_rgba(30,58,138,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)] font-black'
                : 'bg-white text-slate-700 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:bg-slate-50 hover:text-slate-900 font-extrabold'
            }`}
            id="mode-button-grocery"
          >
            <span className={`transition-transform duration-300 inline-block shrink-0 ${activeMode === 'grocery' ? 'scale-115 rotate-3' : 'scale-100 rotate-0'}`}>
              🥬
            </span>
            <span className="truncate whitespace-nowrap">Grezto Market</span>
          </motion.button>
 
          {/* 🍔 Hotels & Restaurants Button */}
          <motion.button
            type="button"
            onClick={() => setActiveMode('hotel')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 h-[38px] rounded-xl text-[10.5px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer select-none focus:outline-none border ${
              activeMode === 'hotel'
                ? 'bg-gradient-to-r from-[#cc0c23] via-[#ef233c] to-[#b7091a] text-white border-red-900 shadow-[0_8px_22px_rgba(239,35,60,0.45),_0_2px_8px_rgba(204,12,35,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] font-black'
                : 'bg-white text-slate-700 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:bg-slate-50 hover:text-slate-900 font-extrabold'
            }`}
            id="mode-button-hotel"
          >
            <span className={`transition-transform duration-300 inline-block shrink-0 ${activeMode === 'hotel' ? 'scale-115 -rotate-3' : 'scale-100 rotate-0'}`}>
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
                  {/* Premium Sliding Banner */}
                  <SlidingBanner />

                  {/* Categories */}
                  <CategoryList
                    categories={activeDisplayCategories}
                    activeCategory={activeCategory}
                    onSelectCategory={setActiveCategory}
                    isLoading={isHomeLoading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Products Grid */}
            <div className="mt-8 px-1">
              {searchQuery && searchFeedData ? (
                <>
                  {searchFeedData.exactMatches.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h5 className="font-bold text-emerald-600 text-sm">
                          Exact Matches for "{searchQuery}"
                        </h5>
                        <div className="w-10 h-1 bg-emerald-100 rounded-full"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-display will-change-transform transform-gpu mb-8">
                        {searchFeedData.exactMatches.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>

                      {searchFeedData.relatedMatches.length > 0 && (
                        <>
                          <div className="flex items-center justify-between mb-4 px-1">
                            <h5 className="font-bold text-gray-800 text-sm">
                              More from {searchFeedData.topCategory} 🥦
                            </h5>
                            <div className="w-10 h-1 bg-gray-100 rounded-full"></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-display will-change-transform transform-gpu">
                            {searchFeedData.relatedMatches.map((product) => (
                              <ProductCard key={product.id} product={product} />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="col-span-2 py-16 flex flex-col items-center justify-center text-center bg-gray-50 rounded-3xl border border-gray-100/50 mb-8">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Search size={24} className="text-gray-300" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 mb-1">No exact matches found</h3>
                      <p className="text-[11px] text-gray-400 font-medium uppercase tracking-widest px-8">
                        We couldn't find "{searchQuery}". {searchFeedData.fallbackMatches.length > 0 ? 'But check out these items!' : 'Try a different term.'}
                      </p>
                    </div>
                  )}

                  {searchFeedData.exactMatches.length === 0 && searchFeedData.fallbackMatches.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h5 className="font-bold text-indigo-500 text-sm">
                          {searchFeedData.topCategory ? `Trending in ${searchFeedData.topCategory}` : 'Trending Right Now'}
                        </h5>
                        <div className="w-10 h-1 bg-indigo-100 rounded-full"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-display will-change-transform transform-gpu">
                        {searchFeedData.fallbackMatches.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6 px-1">
                    <h5 className="font-bold text-gray-800 text-sm">
                      {selectedShopId ? (
                        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-black border border-emerald-100">
                          {shops.find(s => s.id === selectedShopId)?.name || 'Selected Shop'}
                          <button 
                            onClick={() => setSelectedShopId('')} 
                            className="text-emerald-600 hover:text-emerald-950 ml-1 focus:outline-none bg-transparent border-0 cursor-pointer p-0 flex items-center justify-center"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3 stroke-[3]" />
                          </button>
                        </span>
                      ) : (
                        "Trending Near You"
                      )}
                    </h5>
                    <div className="w-10 h-1 bg-gray-100 rounded-full"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-display will-change-transform transform-gpu">
                    {filteredProducts.length > 0 ? (
                      <>
                        {filteredProducts.slice(0, visibleCount).map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                        {visibleCount < filteredProducts.length && (
                          <div ref={setObserverTarget} className="col-span-2 h-20 flex items-center justify-center">
                            <div className="animate-pulse flex space-x-2">
                              <div className="w-2 h-2 bg-emerald-300 rounded-full"></div>
                              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (isProductsLoading || isHomeLoading) ? (
                      <>
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <ProductCardSkeleton key={`skeleton-${idx}`} />
                        ))}
                      </>
                    ) : (
                      <div className="col-span-2 py-16 flex flex-col items-center justify-center text-center bg-gray-50 rounded-3xl border border-gray-100/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                          <Search size={24} className="text-gray-300" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1">No products found</h3>
                        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-widest px-8">
                          No items in this category right now.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <HotelListTab 
            activeHotels={activeHotels}
            isSystemOnline={isSystemOnline}
            calculateGeodistance={calculateGeodistance}
            setSelectedHotelForDetails={setSelectedHotelForDetails}
            getDishesForHotel={getDishesForHotel}
            isLoading={isHomeLoading}
          />
        )}
      </AnimatePresence>

      {/* Hotel / Restaurant detail and food ordering modal drawer */}
      <AnimatePresence>
        {selectedHotelForDetails && (
          <HotelDetailsDrawer
            hotel={selectedHotelForDetails}
            onClose={() => setSelectedHotelForDetails(null)}
            calculateGeodistance={calculateGeodistance}
            getDishesForHotel={getDishesForHotel}
            onRatingUpdated={handleRatingUpdated}
          />
        )}
      </AnimatePresence>

      {/* Google Maps Shop Locator Modal */}
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
