import React from 'react';
import { Search, X } from 'lucide-react';
import ProductCard from '../ProductCard';
import ProductCardSkeleton from './ProductCardSkeleton';

interface GroceryProductGridProps {
  searchQuery: string;
  searchFeedData: {
    exactMatches: any[];
    relatedMatches: any[];
    fallbackMatches: any[];
    topCategory: string | null;
  } | null;
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  shops: any[];
  filteredProducts: any[];
  visibleCount: number;
  setObserverTarget: (el: HTMLDivElement | null) => void;
  isProductsLoading: boolean;
  isHomeLoading: boolean;
}

export const GroceryProductGrid: React.FC<GroceryProductGridProps> = ({
  searchQuery,
  searchFeedData,
  selectedShopId,
  setSelectedShopId,
  shops,
  filteredProducts,
  visibleCount,
  setObserverTarget,
  isProductsLoading,
  isHomeLoading,
}) => {
  return (
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
  );
};

export default GroceryProductGrid;
