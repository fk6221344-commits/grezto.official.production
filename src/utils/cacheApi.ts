import { getApiUrl } from './api';
import { supabase } from '../services/supabase';

// Frontend Dual-Layer Caching Utility with Unlimited Ultra Lifetime Fail-Safe

export const CACHE_VERSION = 'v1.0';

export const triggerCacheFlush = () => {
  // Legacy cache flush is disabled on the client.
  // The backend will actively evict keys in the background automatically.
};

export async function fetchDualLayerHomeData(city?: string) {
  const activeCity = (city || 'Kawarhagi').trim().toLowerCase() || 'kawarhagi';

  try {
    // Layer 2: Redis Network Cache (extremely fast fetch from Server Redis cache with segmented city key support)
    const url = `/api/home-data?city=${encodeURIComponent(activeCity)}&_cb=${Date.now()}`;
    const res = await fetch(getApiUrl(url));
    if (res.ok) {
      const serverData = await res.json();
      // If server returned valid data with shops, return it
      if (serverData && Array.isArray(serverData.shops) && serverData.shops.length > 0) {
        return { data: serverData, source: 'redis' };
      }
    }
  } catch (error) {
    console.warn("Failed to fetch from live server cache", error);
  }

  // ULTRA LIFETIME FAIL-SAFE FALLBACK: Direct query from Supabase
  try {
    console.warn(`[LIFETIME FAIL-SAFE] /api/home-data returned empty or failed. Querying Supabase directly for city: ${activeCity}...`);
    const [shopsRes, categoriesRes, bannersRes] = await Promise.all([
      supabase.from('shops').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('banners').select('*')
    ]);

    const allShops = shopsRes.data || [];
    const categories = categoriesRes.data || [];
    const banners = bannersRes.data || [];

    // Filter shops by activeCity
    const filteredShops = allShops.filter((s: any) => {
      if (s.status === 'blocked') return false;
      if (s.city) {
        return s.city.toLowerCase() === activeCity;
      }
      const addressLower = (s.address || "").toLowerCase();
      if (activeCity === "guwahati") {
        return addressLower.includes("guwahati");
      } else if (activeCity === "morigaon") {
        return addressLower.includes("morigaon");
      } else {
        return !addressLower.includes("guwahati") && !addressLower.includes("morigaon");
      }
    });

    // Load recommended/pinned products
    const pinnedShopIds = filteredShops
      .filter((s: any) => s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1')
      .map((s: any) => s.id);

    let loadedProducts: any[] = [];
    if (pinnedShopIds.length > 0) {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .in('shopId', pinnedShopIds)
        .is('deleted', false);
      if (!prodErr && prodData) {
        loadedProducts = prodData.map((p: any) => ({
          ...p,
          stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
        }));
      }
    }

    const fallbackData = {
      shops: filteredShops,
      banners: banners,
      categories: categories,
      recommendedProducts: loadedProducts,
      timestamp: Date.now()
    };

    console.log(`[LIFETIME FAIL-SAFE] Successfully compiled home-data directly from Supabase for city: ${activeCity}.`);
    return { data: fallbackData, source: 'live' };
  } catch (fallbackError) {
    console.warn('[LIFETIME FAIL-SAFE ERROR] Supabase direct home data fetch failed:', fallbackError);
  }

  return { data: null, source: 'live' };
}

export async function fetchProductsByCategory(category: string, dispatchEventCallback?: (prods: any[]) => void) {
  // Always fetch from server directly to keep it synced without stale client-side cache
  try {
    const res = await fetch(getApiUrl(`/api/products?category=${encodeURIComponent(category)}&_cb=${Date.now()}`));
    if (res.ok) {
      const data = await res.json();
      const products = data.products || [];
      if (products.length > 0) {
        if (dispatchEventCallback) dispatchEventCallback(products);
        return products;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch lazy products for ${category}`, error);
  }

  // ULTRA LIFETIME FAIL-SAFE FALLBACK: Direct fetch from Supabase
  try {
    console.warn(`[LIFETIME FAIL-SAFE] /api/products returned empty or failed. Querying Supabase directly for category: ${category}...`);
    let query = supabase.from('products').select('*').is('deleted', false);
    if (category !== 'All') {
      query = query.eq('category', category);
    }
    const { data: directProds, error: directErr } = await query;
    if (!directErr && directProds && directProds.length > 0) {
      console.log(`[LIFETIME FAIL-SAFE] Successfully retrieved ${directProds.length} products directly from Supabase!`);
      const mapped = directProds.map((p: any) => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
      }));
      if (dispatchEventCallback) dispatchEventCallback(mapped);
      return mapped;
    }
  } catch (fallbackError) {
    console.warn('[LIFETIME FAIL-SAFE ERROR] Supabase direct products fetch failed:', fallbackError);
  }

  return [];
}
