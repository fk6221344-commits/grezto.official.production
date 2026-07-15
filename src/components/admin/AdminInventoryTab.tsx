import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { ProductAdminRow } from '../AdminProductRow';
import { VirtualListItem } from '../VirtualListItem';

interface AdminInventoryTabProps {
  products: any[];
  shops: any[];
  startAdd: () => void;
  toggleStock: (id: string, currentStock: number) => void;
  handleDeleteProduct: (id: string) => void;
  startEdit: (product: any) => void;
  isLoading?: boolean;
  isUpdatingStock?: Record<string, boolean>;
}

export default function AdminInventoryTab({
  products,
  shops,
  startAdd,
  toggleStock,
  handleDeleteProduct,
  startEdit,
  isLoading = false,
  isUpdatingStock = {},
}: AdminInventoryTabProps) {
  
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>('direct');

  // [PILLAR 4: LAZY LOADING & INFINITE SCROLL STATE]
  const [visibleCount, setVisibleCount] = useState<number>(15);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when filter or total products list changes
  useEffect(() => {
    setVisibleCount(15);
  }, [selectedShopFilter, products.length]);

  const filteredProductsMemo = useMemo(() => {
    let list = products;
    if (selectedShopFilter !== 'all') {
      if (selectedShopFilter === 'direct') {
        list = products.filter(p => !p.shopId || p.shopId === 'direct');
      } else {
        list = products.filter(p => p.shopId === selectedShopFilter);
      }
    }
    return list;
  }, [products, selectedShopFilter]);

  // [PILLAR 4: INFINITE SCROLL OBSERVER]
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 10, filteredProductsMemo.length));
      }
    }, {
      rootMargin: '150px', // Load next chunk 150px before reaching the end
    });

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
      observer.disconnect();
    };
  }, [filteredProductsMemo.length]);

  const productsListMemo = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-stone-100 shadow-xs animate-pulse" id={`admin-inv-skeleton-${idx}`}>
          <div className="flex items-center space-x-3 w-full" id={`admin-inv-skeleton-left-${idx}`}>
            <div className="w-12 h-12 rounded-xl bg-gray-100/80" id={`admin-inv-skeleton-img-${idx}`}></div>
            <div className="space-y-2 flex-1 max-w-[200px]" id={`admin-inv-skeleton-text-${idx}`}>
              <div className="h-3 bg-gray-100/80 rounded-md w-3/4" id={`admin-inv-skeleton-t1-${idx}`}></div>
              <div className="h-2.5 bg-gray-100/70 rounded-md w-1/2" id={`admin-inv-skeleton-t2-${idx}`}></div>
            </div>
          </div>
          <div className="flex items-center space-x-2" id={`admin-inv-skeleton-actions-${idx}`}>
            <div className="w-14 h-6 bg-gray-100/80 rounded-full" id={`admin-inv-skeleton-toggle-${idx}`}></div>
            <div className="w-8 h-8 bg-gray-100/80 rounded-lg" id={`admin-inv-skeleton-b1-${idx}`}></div>
            <div className="w-8 h-8 bg-gray-100/80 rounded-lg" id={`admin-inv-skeleton-b2-${idx}`}></div>
          </div>
        </div>
      ));
    }

    if (filteredProductsMemo.length === 0) {
      return (
        <div className="text-center py-20 text-gray-400 uppercase text-[10px] font-bold tracking-widest" id="admin-inventory-empty">
          Inventory empty for selected shop
        </div>
      );
    }

    // Slice according to lazy load / infinite scroll visible count
    const chunk = filteredProductsMemo.slice(0, visibleCount);
    
    return chunk.map((product) => (
      <VirtualListItem key={product.id} height={76} id={`admin-virtual-item-${product.id}`}>
        <ProductAdminRow 
          name={product.name} 
          price={product.price} 
          stock={product.stock}
          imageUrl={product.image || product.imageUrl}
          onToggleStock={() => toggleStock(product.id, product.stock)}
          onDelete={() => handleDeleteProduct(product.id)}
          onEdit={() => startEdit(product)}
          isUpdating={isUpdatingStock[product.id] || false}
        />
      </VirtualListItem>
    ));
  }, [isLoading, filteredProductsMemo, visibleCount, toggleStock, handleDeleteProduct, startEdit, isUpdatingStock]);

  return (
    <div className="space-y-4 animate-fade-in text-stone-850">
      <div className="flex flex-col mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1 w-full max-w-[200px]">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock Management</h3>
            <select 
              value={selectedShopFilter}
              onChange={e => setSelectedShopFilter(e.target.value)}
              className="bg-gray-100 border-none shadow-sm py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-xs text-gray-700 cursor-pointer"
            >
              <option value="direct">👑 Grezto VIP (Self)</option>
              <option value="all">🌐 All Products</option>
              <option disabled>──────────</option>
              {shops.map((sh: any) => (
                <option key={sh.id} value={sh.id}>🏪 {sh.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={startAdd}
            className="bg-emerald-600 text-white p-2 rounded-xl flex items-center space-x-2 px-4 shadow-lg shadow-emerald-100 border-0 cursor-pointer font-sans text-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Add Product</span>
          </button>
        </div>
      </div>
      
      {productsListMemo}

      {/* [PILLAR 4: INFINITE SCROLL SENTINEL] */}
      {filteredProductsMemo.length > visibleCount && (
        <div 
          ref={sentinelRef} 
          id="admin-inventory-infinite-sentinel" 
          className="w-full h-8 flex items-center justify-center text-stone-400 text-[9px] font-bold uppercase tracking-widest py-2"
        >
          Loading more items...
        </div>
      )}
    </div>
  );
}
