import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { MerchantProductRow } from '../MerchantProductRow';
import { VirtualListItem } from '../VirtualListItem';

interface MerchantMenuTabProps {
  products: any[];
  setEditingItem: (val: any) => void;
  setNewItem: (val: any) => void;
  setShowAddMenuModal: (val: boolean) => void;
  handleToggleStock: (productId: string, currentStock: any) => Promise<any> | any;
  handleDeleteItem: (productId: string) => Promise<any> | any;
  isLoading?: boolean;
  isUpdatingStock?: Record<string, boolean>;
}

export function MerchantMenuTab({
  products,
  setEditingItem,
  setNewItem,
  setShowAddMenuModal,
  handleToggleStock,
  handleDeleteItem,
  isLoading = false,
  isUpdatingStock = {}
}: MerchantMenuTabProps) {
  
  // [PILLAR 4: LAZY LOADING & INFINITE SCROLL STATE]
  const [visibleCount, setVisibleCount] = useState<number>(15);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when products list changes
  useEffect(() => {
    setVisibleCount(15);
  }, [products.length]);

  // [PILLAR 4: INFINITE SCROLL OBSERVER]
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 10, products.length));
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
  }, [products.length]);

  const chunk = products.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active dishes & inventory</span>
        <button 
          onClick={() => {
            setEditingItem(null);
            setNewItem({
              name: '',
              price: '',
              category: '',
              imageUrl: '',
              description: '',
              unit: '1 serving',
              stock: 15
            });
            setShowAddMenuModal(true);
          }}
          className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer border-0 shadow-md hover:bg-emerald-700 transition"
        >
          <Plus size={12} className="stroke-[3]" />
          Add Dish / Item
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between p-3.5 bg-white rounded-3xl border border-slate-100 shadow-xs animate-pulse" id={`merchant-menu-skeleton-${idx}`}>
              <div className="flex items-center space-x-3 w-full" id={`merchant-menu-skeleton-left-${idx}`}>
                <div className="w-[52px] h-[52px] rounded-2xl bg-slate-100" id={`merchant-menu-skeleton-img-${idx}`}></div>
                <div className="space-y-2 flex-1 max-w-[200px]" id={`merchant-menu-skeleton-text-${idx}`}>
                  <div className="h-3 bg-slate-100 rounded-md w-3/4" id={`merchant-menu-skeleton-t1-${idx}`}></div>
                  <div className="h-2.5 bg-slate-100 rounded-md w-1/2" id={`merchant-menu-skeleton-t2-${idx}`}></div>
                </div>
              </div>
              <div className="flex items-center space-x-2" id={`merchant-menu-skeleton-actions-${idx}`}>
                <div className="w-14 h-6 bg-slate-100 rounded-full" id={`merchant-menu-skeleton-toggle-${idx}`}></div>
                <div className="w-8 h-8 bg-slate-100 rounded-xl" id={`merchant-menu-skeleton-b1-${idx}`}></div>
                <div className="w-8 h-8 bg-slate-100 rounded-xl" id={`merchant-menu-skeleton-b2-${idx}`}></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-400">
          <p className="text-[10px] uppercase font-black tracking-widest">Your menu list is empty</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-[200px] mx-auto leading-relaxed">Add food items, milkshakes or organic products above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chunk.map((item) => (
            <VirtualListItem key={item.id} height={80} id={`merchant-virtual-item-${item.id}`}>
              <MerchantProductRow 
                item={item}
                handleToggleStock={handleToggleStock}
                setEditingItem={setEditingItem}
                setNewItem={setNewItem}
                setShowAddMenuModal={setShowAddMenuModal}
                handleDeleteItem={handleDeleteItem}
                isUpdating={isUpdatingStock[item.id] || false}
              />
            </VirtualListItem>
          ))}
        </div>
      )}

      {/* [PILLAR 4: INFINITE SCROLL SENTINEL] */}
      {products.length > visibleCount && (
        <div 
          ref={sentinelRef} 
          id="merchant-menu-infinite-sentinel" 
          className="w-full h-8 flex items-center justify-center text-slate-400 text-[9px] font-bold uppercase tracking-widest py-2"
        >
          Loading more items...
        </div>
      )}
    </div>
  );
}
