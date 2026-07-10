import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useUser } from './UserContext';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShoppingBag, X, Lock } from 'lucide-react';
import { triggerNativeImpactVibration, setSecureItem, getSecureItem, triggerMediumHapticVibration } from '../services/nativeService';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  shopId?: string;
  shopName?: string;
  productShopId?: string;
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('grezto_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [exclusiveAlert, setExclusiveAlert] = useState<{
    isOpen: boolean;
    exclusiveShopName: string;
  } | null>(null);

  useEffect(() => {
    if (exclusiveAlert && exclusiveAlert.isOpen) {
      const timer = setTimeout(() => {
        setExclusiveAlert(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [exclusiveAlert]);

  const syncCartItemsWithDatabase = async (currentItems: CartItem[]) => {
    if (!supabase || currentItems.length === 0) return;

    try {
      const productIds = currentItems.map(item => item.id);
      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (error) {
        console.error("Error syncing cart items with db:", error);
        return;
      }

      const dbProductsMap = new Map<string, { stock: number; deleted: boolean }>();
      if (dbProducts) {
        dbProducts.forEach((p: any) => {
          // If stock is undefined, fall back to inStock boolean (true -> 10, false -> 0)
          const stockVal = p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0);
          dbProductsMap.set(p.id, {
            stock: stockVal,
            deleted: p.deleted === true
          });
        });
      }

      let changed = false;
      const updatedItems = currentItems.filter(item => {
        const dbProd = dbProductsMap.get(item.id);
        
        // If the product is not found in the database, it means it is deleted completely.
        if (!dbProd) {
          changed = true;
          return false;
        }

        // If product is explicitly marked as deleted, filter it out.
        if (dbProd.deleted) {
          changed = true;
          return false;
        }

        // If stock is 0 or less, filter it out.
        if (dbProd.stock <= 0) {
          changed = true;
          return false;
        }

        return true;
      });

      if (changed) {
        setItems(updatedItems);
        toast.error("Kuch items out of stock ya store se remove ho chuke hain, unhe aapke cart se automatically hata diya gaya hai.", {
          duration: 5000,
          id: 'cart-auto-sync'
        });
      }
    } catch (err) {
      console.error("Failed to execute syncCartItemsWithDatabase:", err);
    }
  };

  // Load cart from native Preferences on mount for bulletproof offline recovery
  useEffect(() => {
    async function recoverCart() {
      try {
        const saved = await getSecureItem('grezto_cart_items');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            syncCartItemsWithDatabase(parsed);
          }
        }
      } catch (err) {
        console.warn("[Cart Recovery] Could not restore cart from native storage:", err);
      }
    }
    recoverCart();
  }, []);

  // Periodic database validation (fail-safe) for stock and deletion status every 8 seconds
  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      syncCartItemsWithDatabase(items);
    }, 8000);
    return () => clearInterval(interval);
  }, [items]);

  // Real-time Supabase postgres change subscription to handle out-of-stock and deletion instantly
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('realtime_products_cart_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          setItems(prevItems => {
            if (prevItems.length === 0) return prevItems;

            const targetId = eventType === 'DELETE' ? oldRecord?.id : newRecord?.id;
            if (!targetId) return prevItems;

            const existsInCart = prevItems.some(i => i.id === targetId);
            if (!existsInCart) return prevItems;

            // Handle DELETE event
            if (eventType === 'DELETE') {
              const matchedItem = prevItems.find(i => i.id === targetId);
              toast.error(`"${matchedItem?.name || 'Item'}" ab store se delete ho gaya hai aur aapke cart se hata diya gaya hai.`, {
                id: `del-${targetId}`
              });
              return prevItems.filter(i => i.id !== targetId);
            }

            // Handle UPDATE event
            if (eventType === 'UPDATE') {
              const isDeleted = newRecord.deleted === true;
              const isOutOfStock = newRecord.stock <= 0;

              if (isDeleted || isOutOfStock) {
                const matchedItem = prevItems.find(i => i.id === targetId);
                if (matchedItem) {
                  const reasonText = isDeleted ? "delete/remove" : "out of stock";
                  toast.error(`"${matchedItem.name}" ab ${reasonText} ho gaya hai aur aapke cart se hata diya gaya hai.`, {
                    id: `upd-${targetId}`
                  });
                  return prevItems.filter(i => i.id !== targetId);
                }
              }
            }

            return prevItems;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('grezto_cart_items', JSON.stringify(items));
      // Asynchronously mirror state to native Capacitor Preferences to survive OS-level memory pruning
      setSecureItem('grezto_cart_items', JSON.stringify(items)).catch(() => {});
    } catch (e) {
      console.warn("Error saving cart items to localStorage:", e);
    }
  }, [items]);

  const { user } = useUser();

  const [shops, setShops] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('grezto_cached_shops');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!supabase) return;
    const fetchShops = async () => {
      try {
        const { data } = await supabase.from('shops').select('id, name, pinned');
        if (data) setShops(data);
      } catch (e) {
        console.error("Error fetching shops in CartProvider:", e);
      }
    };

    fetchShops();

    const sub = supabase.channel('cart_shops_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
        fetchShops();
      })
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  
  // Delivery fee is computed dynamically at Checkout page based on GPS coordinates.
  const deliveryFee = 0;

  const total = subtotal + deliveryFee;

  const addToCart = async (product: any) => {
    if (!product || !product.id) return;

    let targetShops = shops;
    if (!targetShops || targetShops.length === 0) {
      try {
        const { data } = await supabase.from('shops').select('id, name, pinned');
        if (data && data.length > 0) {
          targetShops = data;
          setShops(data);
          localStorage.setItem('grezto_cached_shops', JSON.stringify(data));
        }
      } catch (e) {
        console.error("Error fetching shops in addToCart fallback:", e);
      }
    }

    // Double fallback from localStorage
    if (!targetShops || targetShops.length === 0) {
      try {
        const cached = localStorage.getItem('grezto_cached_shops');
        if (cached) {
          targetShops = JSON.parse(cached);
        }
      } catch {}
    }

    if (!targetShops) targetShops = [];

    const newShopId = product.shopId || product.productShopId || 'direct';
    const isNewShopExclusive = targetShops.some(s => s.id === newShopId && (s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1'));

    if (items.length > 0) {
      // Find if there is any exclusive item already in the cart
      const existingExclusiveItem = items.find(item => {
        const sId = item.shopId || item.productShopId || 'direct';
        return targetShops.some(s => s.id === sId && (s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1'));
      });

      if (existingExclusiveItem) {
        // There is an exclusive shop item in the cart.
        // We can only add items from the exact same shop!
        const existingShopId = existingExclusiveItem.shopId || existingExclusiveItem.productShopId || 'direct';
        if (existingShopId !== newShopId) {
          const existingShopObj = targetShops.find(s => s.id === existingShopId);
          setExclusiveAlert({
            isOpen: true,
            exclusiveShopName: existingShopObj?.name || 'Exclusive Shop'
          });
          return;
        }
      } else {
        // There are only normal items in the cart.
        // We cannot add an exclusive item!
        if (isNewShopExclusive) {
          const newShopObj = targetShops.find(s => s.id === newShopId);
          setExclusiveAlert({
            isOpen: true,
            exclusiveShopName: newShopObj?.name || 'Exclusive Shop'
          });
          return;
        }
      }
    }

    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: Number(product.price) || 0, 
        imageUrl: product.image || product.imageUrl || '',
        shopId: product.shopId || product.productShopId || '',
        shopName: product.shopName || '',
        productShopId: product.productShopId || product.shopId || '',
        quantity: 1 
      }];
    });
    
    // Trigger responsive, low-latency native haptic tap confirm
    triggerMediumHapticVibration();
  };

  // Automated exclusive warning sliding banner active

  const removeFromCart = (id: string) => {
    if (!id) return;
    setItems(prev => prev.filter(i => i.id !== id));
    triggerMediumHapticVibration();
  };

  const updateQuantity = (id: string, delta: number) => {
    if (!id) return;
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : i;
      }
      return i;
    }).filter(i => i.quantity > 0));
    triggerMediumHapticVibration();
  };

  const clearCart = () => {
    setItems([]);
    triggerMediumHapticVibration();
  };

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, subtotal, deliveryFee, total }}>
      {children}

      {/* Top Floating Exclusive Shop Alert Banner */}
      <AnimatePresence>
        {exclusiveAlert && exclusiveAlert.isOpen && (
          <motion.div
            initial={{ y: -120, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -120, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 16, stiffness: 200 }}
            className="fixed top-6 left-4 right-4 md:left-1/2 md:right-auto md:w-[480px] md:-translate-x-1/2 z-[10000] bg-[#0b0826] border-2 border-amber-400 shadow-[0_20px_50px_rgba(245,158,11,0.35)] rounded-[2rem] p-5 flex items-start gap-4 select-none"
            id="exclusive-top-alert-banner"
          >
            <div className="bg-amber-500/20 border border-amber-400 text-amber-300 p-2.5 rounded-2xl shrink-0 mt-0.5 shadow-inner">
              <Lock className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-extrabold text-white leading-relaxed select-text" id="exclusive-alert-subtitle">
                You can only place orders from <span className="text-amber-300 font-black tracking-wide drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">"{exclusiveAlert.exclusiveShopName}"</span> right now.
              </p>
              <p className="text-[11px] font-semibold text-slate-300 mt-2 select-text" id="exclusive-alert-footer">
                Clear your cart first to order from this shop.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setExclusiveAlert(null)}
              className="text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-1.5 rounded-full border-0 cursor-pointer transition-colors shrink-0"
              id="exclusive-alert-close-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
