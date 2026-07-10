import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { fetchDualLayerHomeData, fetchProductsByCategory } from '../utils/cacheApi';
import { staticCategories as categories } from '../data/categories';
import { prefetchImages } from '../utils/imagePrefetcher';

// Module-level global offline caches to ensure instant loads when switching tabs
export let globalCategoriesCache: any[] = (() => {
  try {
    const saved = localStorage.getItem('grezto_cached_categories');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
})();

export let globalProductsCache: any[] = (() => {
  try {
    const saved = localStorage.getItem('grezto_cached_products');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
})();

export let globalShopsCache: any[] = (() => {
  try {
    const saved = localStorage.getItem('grezto_cached_shops');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
})();

export let globalProductsCacheByCategory: Record<string, any[]> = (() => {
  try {
    const saved = localStorage.getItem('grezto_cached_products_by_category');
    const parsed = saved ? JSON.parse(saved) : {};
    if (globalProductsCache.length > 0 && !parsed['All']) {
      parsed['All'] = globalProductsCache;
    }
    return parsed;
  } catch (e) {
    const parsed: Record<string, any[]> = {};
    if (globalProductsCache.length > 0) {
      parsed['All'] = globalProductsCache;
    }
    return parsed;
  }
})();

export function useHomeDataFetching(activeCity: string, activeCategory: string) {
  const [isHomeLoading, setIsHomeLoading] = useState(() => !(globalCategoriesCache.length > 0 && globalShopsCache.length > 0));
  const [dbProducts, setDbProducts] = useState<any[]>(() => globalProductsCache);
  const [localTick, setLocalTick] = useState(0);
  const [dbShops, setDbShops] = useState<any[]>(() => globalShopsCache);
  const [dbCategories, setDbCategories] = useState<any[]>(() => globalCategoriesCache);
  
  // Local product cache per category to avoid flickering during category switch
  const [productsCache, setProductsCache] = useState<Record<string, any[]>>(() => globalProductsCacheByCategory);
  const [isProductsLoading, setIsProductsLoading] = useState(() => !globalProductsCacheByCategory[activeCategory]);

  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(true);
  const [systemReopenTime, setSystemReopenTime] = useState<string | null>(null);

  // Sync isSystemOnline status with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('grezto_system_online', JSON.stringify(isSystemOnline));
    } catch (e) {
      console.warn("Failed to write grezto_system_online to localStorage", e);
    }
  }, [isSystemOnline]);

  // Prefetch all active shop images in the background once they are loaded/updated
  useEffect(() => {
    if (dbShops && dbShops.length > 0) {
      const urls = dbShops.flatMap(shop => [
        shop.image,
        shop.imageUrl,
        shop.image2,
        shop.imageUrl2,
        shop.image3,
        shop.imageUrl3,
        shop.image4,
        shop.imageUrl4
      ]).filter(Boolean);
      prefetchImages(urls).catch(e => console.warn("Prefetching home images failed:", e));
    }
  }, [dbShops]);

  // Initial fetch of system config if available
  useEffect(() => {
    if (!supabase) return;
    
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

  // Sync real-time changes to Shops from Supabase
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

  // Category change product loading effect
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
        try {
          localStorage.setItem('grezto_cached_products_by_category', JSON.stringify(globalProductsCacheByCategory));
        } catch (e) {}
        setProductsCache(prev => ({ ...prev, [activeCategory]: syncedProds }));
        setDbProducts(syncedProds);
      }
    }).then(prods => {
      if (isMounted && prods) {
        globalProductsCacheByCategory[activeCategory] = prods;
        try {
          localStorage.setItem('grezto_cached_products_by_category', JSON.stringify(globalProductsCacheByCategory));
        } catch (e) {}
        setProductsCache(prev => ({ ...prev, [activeCategory]: prods }));
        setDbProducts(prods);
        setIsProductsLoading(false);
      }
    });
    
    return () => { isMounted = false; };
  }, [activeCategory]);

  // Dual-layer home cache loader
  useEffect(() => {
    if (globalCategoriesCache.length === 0 || globalShopsCache.length === 0) {
      setIsHomeLoading(true);
    }
    
    // Warm up the full product catalog cache
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

    fetchDualLayerHomeData(activeCity).then(({ data }) => {
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
          try {
            localStorage.setItem('grezto_cached_products', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }

      if (data && data.shops && data.shops.length > 0) {
        setDbShops(data.shops);
        globalShopsCache = data.shops;
        try {
          localStorage.setItem('grezto_cached_shops', JSON.stringify(data.shops));
        } catch (e) {}
        shopsLoaded = true;
        checkFinished();
      } else if (supabase) {
        supabase.from('shops').select('*').then((res: any) => {
          if (res.data) {
             setDbShops(res.data);
             globalShopsCache = res.data;
             try {
               localStorage.setItem('grezto_cached_shops', JSON.stringify(res.data));
             } catch (e) {}
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
        try {
          localStorage.setItem('grezto_cached_categories', JSON.stringify(data.categories));
        } catch (e) {}
        categoriesLoaded = true;
        checkFinished();
      } else if (supabase) {
        supabase.from('categories').select('*').then((res: any) => {
          if (res.data) {
             setDbCategories(res.data);
             globalCategoriesCache = res.data;
             try {
               localStorage.setItem('grezto_cached_categories', JSON.stringify(res.data));
             } catch (e) {}
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
  }, [activeCity]);

  // Products update event listener
  useEffect(() => {
    const handleUpdate = () => {
      setLocalTick(t => t + 1);
    };
    window.addEventListener('grezto-products-updated', handleUpdate);
    return () => window.removeEventListener('grezto-products-updated', handleUpdate);
  }, []);

  // Phase 5: Real-time CDC WebSocket Streaming
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

  return {
    isHomeLoading,
    setIsHomeLoading,
    dbProducts,
    setDbProducts,
    localTick,
    dbShops,
    setDbShops,
    dbCategories,
    setDbCategories,
    productsCache,
    setProductsCache,
    isProductsLoading,
    setIsProductsLoading,
    isSystemOnline,
    setIsSystemOnline,
    systemReopenTime,
    setSystemReopenTime,
    handleRatingUpdated
  };
}
