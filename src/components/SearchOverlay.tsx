import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowLeft, TrendingUp, Clock, X } from 'lucide-react';
import Fuse from 'fuse.js';
import ProductCard from './ProductCard';
import { getApiUrl } from '../utils/api';
import { useUser } from '../context/UserContext';

interface SearchOverlayProps {
  onClose: () => void;
  onSelect: (query: string) => void;
  initialQuery?: string;
}

export default function SearchOverlay({ onClose, onSelect, initialQuery = '' }: SearchOverlayProps) {
  const { user } = useUser();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Local state for products cache to perform searches against
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Load products from localStorage for search
    try {
      const cached = localStorage.getItem('grezto_cached_products');
      if (cached) {
        setProducts(JSON.parse(cached));
      }
    } catch (e) {
      console.warn("Could not load products for search overlay", e);
    }

    // Always fetch latest products catalog in the background to ensure real-time search results are up to date
    const fetchLatestCatalog = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/products?category=All&_cb=${Date.now()}`));
        if (res.ok) {
          const serverData = await res.json();
          if (serverData && serverData.products && serverData.products.length > 0) {
            setProducts(serverData.products);
            localStorage.setItem('grezto_cached_products', JSON.stringify(serverData.products));
          }
        }
      } catch (err) {
        console.warn("Failed to background fetch products for SearchOverlay", err);
      }
    };

    fetchLatestCatalog();
  }, []);

  const searchResults = useMemo(() => {
    const qClean = query.trim().toLowerCase();
    if (!qClean) return { exactMatches: [], relatedMatches: [], fallbackMatches: [], topCategory: null };
    
    // Filter products by the user's active city if available
    let cityFilteredProducts = products;
    if (user && user.activeCity) {
      try {
        const cachedShops = localStorage.getItem('grezto_cached_shops');
        if (cachedShops) {
          const allShops = JSON.parse(cachedShops);
          const activeCityLower = user.activeCity.toLowerCase();
          
          const activeShopIds = new Set(
            allShops
              .filter((s: any) => {
                if (s.city) return s.city.toLowerCase() === activeCityLower;
                const addr = (s.address || "").toLowerCase();
                if (activeCityLower === "guwahati") return addr.includes("guwahati");
                if (activeCityLower === "morigaon") return addr.includes("morigaon");
                return !addr.includes("guwahati") && !addr.includes("morigaon");
              })
              .map((s: any) => s.id)
          );

          const exclusiveShopIds = new Set(
            allShops
              .filter((s: any) => s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1')
              .map((s: any) => s.id)
          );
          
          cityFilteredProducts = products.filter((p: any) => {
            if (!p.shopId || p.shopId === 'direct') return true;
            return activeShopIds.has(p.shopId) && !exclusiveShopIds.has(p.shopId);
          });
        }
      } catch (err) {
        console.warn("Error filtering search products by city", err);
      }
    }

    // Tiered lists for high relevance
    const prefixMatches: any[] = [];
    const substringMatches: any[] = [];
    const otherMatches: any[] = [];
    
    // Initialize Fuse with a relaxed threshold (0.5) for true fuzzy typos
    const fuse = new Fuse(cityFilteredProducts, {
      keys: ['name', 'category', 'description'],
      threshold: 0.5,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
    
    const fuzzyResults = fuse.search(query).map(res => res.item);
    const seenIds = new Set<string>();

    // 1. Scan for Prefix and Substring matches in the name first (critical for "b", "bir", etc.)
    for (const p of cityFilteredProducts) {
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

    // 2. Add fuzzy search matches
    for (const p of fuzzyResults) {
      if (!seenIds.has(p.id)) {
        otherMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // 3. Typo tolerance check: custom overlap matcher for query length >= 3
    const calculateOverlap = (str1: string, str2: string) => {
      const s1 = str1.toLowerCase();
      const s2 = str2.toLowerCase();
      if (s2.includes(s1)) return 1.0;
      
      let common = 0;
      const chars2 = s2.split('');
      for (const char of s1) {
        const idx = chars2.indexOf(char);
        if (idx !== -1) {
          common++;
          chars2.splice(idx, 1);
        }
      }
      return common / Math.max(s1.length, 1);
    };

    if (qClean.length >= 3) {
      for (const p of cityFilteredProducts) {
        if (seenIds.has(p.id) || !p.name) continue;
        const overlapScore = calculateOverlap(qClean, p.name);
        if (overlapScore >= 0.75) {
          otherMatches.push(p);
          seenIds.add(p.id);
        }
      }
    }

    // 4. Scan for substring matches in category & description as a fallback
    for (const p of cityFilteredProducts) {
      if (seenIds.has(p.id)) continue;
      
      const catLower = (p.category || '').toLowerCase();
      const descLower = (p.description || '').toLowerCase();
      
      if (catLower.includes(qClean) || descLower.includes(qClean)) {
        otherMatches.push(p);
        seenIds.add(p.id);
      }
    }

    // Combine tiers: Prefix matches come first, then inside substring, then fuzzy/others
    const combinedResults = [...prefixMatches, [...substringMatches].filter(p => !prefixMatches.some(prev => prev.id === p.id)), ...otherMatches].flat();
    
    const uniqueNames = new Set<string>();
    const exactMatches: any[] = [];
    
    for (const p of combinedResults) {
      if (p.name && !uniqueNames.has(p.name.toLowerCase())) {
        uniqueNames.add(p.name.toLowerCase());
        exactMatches.push(p);
      }
      if (exactMatches.length >= 12) break; // Allow showing up to 12 matched products
    }
    
    let topCategory: string | null = null;
    let relatedMatches: any[] = [];
    let fallbackMatches: any[] = [];
    
    if (exactMatches.length > 0) {
      topCategory = exactMatches[0].category || null;
      if (topCategory) {
        const related = cityFilteredProducts.filter(p => p.category === topCategory && !exactMatches.some(e => e.id === p.id));
        
        const shuffledRelated = [...related].sort((a, b) => {
          const hashA = String(a.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hashB = String(b.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return (hashA % 13) - (hashB % 13);
        });
        
        relatedMatches = shuffledRelated.slice(0, 6);
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
        const fallback = cityFilteredProducts.filter(p => p.category === topCategory);
        fallbackMatches = fallback.slice(0, 4);
      } else {
        const trending = cityFilteredProducts.filter(p => p.category === 'Fast Food' || p.category === 'Vegetables');
        fallbackMatches = trending.slice(0, 4);
      }
    }
    
    return { exactMatches, relatedMatches, fallbackMatches, topCategory };
  }, [query, products, user]);

  const trendingSearches = ['Tomato', 'Potato', 'Onion', 'Chicken', 'Milk', 'Eggs'];
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('grezto_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load recent searches", e);
    }
  }, []);

  const handleSelectQuery = (q: string) => {
    setQuery(q); // Important: Update the local query state so results render
    if (q && q.trim() !== '') {
      try {
        const newRecent = [q, ...recentSearches.filter(s => s.toLowerCase() !== q.toLowerCase())].slice(0, 5);
        setRecentSearches(newRecent);
        localStorage.setItem('grezto_recent_searches', JSON.stringify(newRecent));
      } catch (e) {
        console.warn("Failed to save recent search", e);
      }
    }
    // Just dismiss the keyboard, keep the user in the search overlay interface
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex flex-col bg-transparent"
    >
      <div className="w-full h-[env(safe-area-inset-top)] bg-transparent shrink-0"></div>
      
      {/* Search Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-white shadow-sm z-10">
        <button 
          onClick={onClose}
          className="p-2 -ml-2 mr-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-3 h-10 border border-gray-200">
          <Search size={18} className="text-gray-400 mr-2" />
          <form onSubmit={(e) => { e.preventDefault(); handleSelectQuery(query); }} className="w-full flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 'Milk' or 'Veggies'"
              className="w-full bg-transparent border-none outline-none text-gray-800 text-sm font-medium placeholder-gray-400"
            />
          </form>
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-gray-400 p-1 hover:text-gray-600 rounded-full"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* Search Results / History */}
      <div className="flex-1 overflow-y-auto bg-gray-50 pb-20">
        {query.trim() === '' ? (
          <div className="p-4 space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Clock size={12} /> Recent Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map(term => (
                    <button
                      key={'recent_'+term}
                      onClick={() => handleSelectQuery(term)}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 shadow-sm hover:border-emerald-300 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TrendingUp size={12} /> Trending Now
              </h3>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map(term => (
                  <button
                    key={'trend_'+term}
                    onClick={() => handleSelectQuery(term)}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2">
            
            {searchResults.exactMatches.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-2 mb-3 mt-1">
                  <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    Exact Matches for "{query}"
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-display mb-4">
                  {searchResults.exactMatches.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                
                {searchResults.relatedMatches.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-2 mb-3 mt-4 border-t border-gray-100 pt-4">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        More from {searchResults.topCategory} 🥦
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-display">
                      {searchResults.relatedMatches.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50 rounded-2xl mx-2 mb-4 border border-gray-100">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <Search size={28} className="text-gray-300" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">No exact matches found</h3>
                <p className="text-xs text-gray-500 font-medium px-8 mb-4">
                  We couldn't find "{query}". {searchResults.fallbackMatches.length > 0 ? 'But check out these trending items!' : 'Try a different term.'}
                </p>
              </div>
            )}
            
            {searchResults.exactMatches.length === 0 && searchResults.fallbackMatches.length > 0 && (
              <>
                <div className="flex items-center justify-between px-2 mb-3 mt-2">
                  <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                    {searchResults.topCategory ? `Trending in ${searchResults.topCategory}` : 'Trending Right Now'}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-display">
                  {searchResults.fallbackMatches.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </>
            )}
            
            {(searchResults.exactMatches.length > 0 || searchResults.fallbackMatches.length > 0) && (
              <button 
                onClick={() => handleSelectQuery(query)}
                className="w-full mt-6 bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm shadow-md hover:bg-emerald-700 transition-colors"
              >
                See All Results in Feed
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

