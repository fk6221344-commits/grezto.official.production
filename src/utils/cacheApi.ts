import { getApiUrl } from './api';

// Frontend Dual-Layer Caching Utility

export const CACHE_VERSION = 'v1.0';

export const triggerCacheFlush = () => {
  // Legacy cache flush is disabled on the client.
  // The backend will actively evict keys in the background automatically.
};

export async function fetchDualLayerHomeData(city?: string) {
  try {
    // Layer 2: Redis Network Cache (extremely fast fetch from Server Redis cache with segmented city key support)
    const url = city ? `/api/home-data?city=${encodeURIComponent(city)}` : '/api/home-data';
    const res = await fetch(getApiUrl(url));
    if (res.ok) {
      const serverData = await res.json();
      return { data: serverData, source: 'redis' };
    }
  } catch (error) {
    console.error("Failed to fetch from live server cache", error);
  }

  return { data: null, source: 'live' };
}

export async function fetchProductsByCategory(category: string, dispatchEventCallback?: (prods: any[]) => void) {
  // Always fetch from server directly to keep it synced without stale client-side cache
  try {
    const res = await fetch(getApiUrl(`/api/products?category=${encodeURIComponent(category)}`));
    if (res.ok) {
      const data = await res.json();
      const products = data.products || [];
      if (dispatchEventCallback) dispatchEventCallback(products);
      return products;
    }
  } catch (error) {
    console.error(`Failed to fetch lazy products for ${category}`, error);
  }
  return [];
}
