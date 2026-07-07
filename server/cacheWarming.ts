import { supabase } from "./clients";
import { safeSet } from "./redisClient";

export async function warmShopProductsCache(shopId: string) {
  try {
    if (!supabase) return;
    console.log(`[PRE-WARM] Background pre-warming products for shop: ${shopId}`);
    const { data, error } = await supabase.from('products').select('*').eq('shopId', shopId).is('deleted', false);
    if (!error && data) {
      const mapped = data.map((p: any) => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
      }));
      await safeSet(`grezto:shop:${shopId}:products`, JSON.stringify(mapped), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm products cache written for shop: ${shopId}`);
    }
  } catch (err: any) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm shop products cache for ${shopId}:`, err.message || err);
  }
}

export async function warmCategoryProductsCache(category: string) {
  try {
    if (!supabase) return;
    console.log(`[PRE-WARM] Background pre-warming products for category: ${category}`);
    let query = supabase.from('products').select('*');
    if (category !== 'All') {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map((p: any) => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
      }));
      await safeSet(`grezto:category:${category}:products`, JSON.stringify(mapped), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm products cache written for category: ${category}`);
    }
  } catch (err: any) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm category products cache for ${category}:`, err.message || err);
  }
}

export async function warmCityShopsCache(city: string) {
  try {
    if (!supabase) return;
    const cleanCity = city.trim().toLowerCase();
    console.log(`[PRE-WARM] Background pre-warming shops for city: ${cleanCity}`);
    const { data, error } = await supabase.from('shops').select('*');
    if (!error && data) {
      const allShops = data || [];
      const filteredShops = allShops.filter((s: any) => {
        if (s.status === 'blocked') return false;
        if (s.city) {
          return s.city.toLowerCase() === cleanCity;
        }
        const addressLower = (s.address || "").toLowerCase();
        if (cleanCity === "guwahati") {
          return addressLower.includes("guwahati");
        } else if (cleanCity === "morigaon") {
          return addressLower.includes("morigaon");
        } else {
          return !addressLower.includes("guwahati") && !addressLower.includes("morigaon");
        }
      });

      // Also prewarm the recommended products
      const pinnedShopIds = filteredShops
        .filter((s: any) => s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1')
        .map((s: any) => s.id);

      let prewarmProducts: any[] = [];
      if (pinnedShopIds.length > 0) {
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .in('shopId', pinnedShopIds)
          .is('deleted', false);
        if (!prodErr && prodData) {
          prewarmProducts = prodData.map((p: any) => ({
            ...p,
            stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
          }));
        }
      }

      const cacheValue = { shops: filteredShops, prewarmProducts };
      await safeSet(`grezto:shops:city:${cleanCity}`, JSON.stringify(cacheValue), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm shops cache with ${prewarmProducts.length} pre-warmed products written for city: ${cleanCity}`);
    }
  } catch (err: any) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm city shops cache for ${city}:`, err.message || err);
  }
}
