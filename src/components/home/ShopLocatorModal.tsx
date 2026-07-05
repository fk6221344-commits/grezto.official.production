import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';

interface ShopLocatorModalProps {
  shops: any[];
  onClose: () => void;
  onVisitShop: (shop: any) => void;
}

export default function ShopLocatorModal({
  shops,
  onClose,
  onVisitShop
}: ShopLocatorModalProps) {
  const [selectedMapShop, setSelectedMapShop] = useState<any>(null);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" 
      id="shop-locator-modal-overlay"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
        id="shop-locator-modal-dialog"
      >
        <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30" id="shop-locator-header">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none" id="shop-locator-h3">Shop Locator</h3>
            <p className="text-[9px] text-slate-405 font-bold uppercase tracking-wider mt-1" id="shop-locator-sub">Kawarhagi Region Map</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-slate-450 hover:text-rose-500 transition-colors shadow-sm cursor-pointer"
            id="shop-locator-close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="relative flex-1 min-h-[400px] bg-slate-50 flex flex-col p-5 overflow-y-auto no-scrollbar" id="shop-locator-list-body">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3 text-left" id="shop-locator-subtitle">Active Delivery Nodes & Shops</p>
          <div className="space-y-3" id="shop-locator-items-container">
            {shops.map((shop: any) => (
              <div 
                key={shop.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMapShop(shop)}
                className={`p-3.5 rounded-[1.5rem] border transition-all cursor-pointer flex items-center justify-between ${
                  selectedMapShop?.id === shop.id 
                    ? 'bg-rose-50/70 border-rose-200 shadow-md ring-1 ring-rose-200' 
                    : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                }`}
                id={`locator-shop-item-${shop.id}`}
              >
                <div className="flex items-center gap-3" id={`locator-shop-left-${shop.id}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm ${
                    (shop.type === 'hotel' || shop.type === 'restaurant') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                  }`} id={`locator-shop-icon-${shop.id}`}>
                    {(shop.type === 'hotel' || shop.type === 'restaurant') ? '🏨' : '🛍️'}
                  </div>
                  <div className="text-left" id={`locator-shop-text-wrapper-${shop.id}`}>
                    <h4 className="font-extrabold text-slate-800 text-[11px] uppercase" id={`locator-shop-name-${shop.id}`}>{shop.name}</h4>
                    <p className="text-[9px] text-slate-405 font-bold uppercase" id={`locator-shop-address-${shop.id}`}>{shop.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 self-center" id={`locator-shop-badge-${shop.id}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${(shop.type === 'hotel' || shop.type === 'restaurant') ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{shop.type}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Info Card overlay for selected shop */}
          <AnimatePresence>
            {selectedMapShop && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-rose-100 shadow-xl z-20 flex items-center gap-4"
                id="locator-selected-card"
              >
                <img src={selectedMapShop.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} className="w-14 h-14 rounded-xl object-cover border border-gray-100" id="locator-selected-img" />
                <div className="flex-1 min-w-0 text-left" id="locator-selected-details">
                   <h4 className="font-extrabold text-slate-800 text-[11px] uppercase truncate" id="locator-selected-title">{selectedMapShop.name}</h4>
                   <p className="text-[9px] text-slate-405 font-bold uppercase truncate" id="locator-selected-address">{selectedMapShop.address || "Kawarhagi"}</p>
                   <button 
                     type="button"
                     onClick={() => {
                       onVisitShop(selectedMapShop);
                       onClose();
                     }}
                     className="mt-1.5 text-[9px] font-black text-rose-600 uppercase flex items-center gap-1 hover:underline outline-hidden cursor-pointer border-0 bg-transparent p-0"
                     id="locator-selected-visit-btn"
                   >
                     Visit Shop <ChevronRight size={10} />
                   </button>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedMapShop(null)}
                  className="p-1.5 text-gray-400 border-0 bg-transparent cursor-pointer"
                  id="locator-selected-dismiss"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-slate-950 text-white flex justify-between items-center shrink-0" id="shop-locator-footer">
           <div className="flex gap-4" id="shop-locator-legends">
              <div className="flex items-center gap-1.5" id="legend-groceries">
                 <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white/20 shadow-sm animate-pulse" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Grocery Stores</span>
              </div>
              <div className="flex items-center gap-1.5" id="legend-hotels">
                 <div className="w-2.5 h-2.5 bg-rose-500 rounded-full border border-white/20 shadow-sm animate-pulse" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Hotels & Restaurants</span>
              </div>
           </div>
           <span className="text-[8px] font-bold text-gray-500 uppercase" id="shop-locator-count">{shops.length} Locations Active</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
