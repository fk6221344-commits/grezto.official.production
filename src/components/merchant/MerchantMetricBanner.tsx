import React from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { AnimatedCounter } from './AnimatedCounter';
import { getApiUrl, getAuthHeaders } from '../../utils/api';

export function MerchantMetricBanner({
  ordersActive,
  products,
  historyOrders,
  isShopOnline,
  setIsShopOnline,
  shop
}: {
  ordersActive: any[];
  products: any[];
  historyOrders: any[];
  isShopOnline: boolean;
  setIsShopOnline: (val: boolean) => void;
  shop: any;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 pb-2 pt-2 font-sans">
      {/* Live Orders Card */}
      <div className="w-full bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-2 text-white shadow-xl flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
        <div className="absolute top-1 right-1 w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
        <div>
          <p className="text-emerald-100 text-[6px] uppercase font-black tracking-widest mb-0.5 w-full truncate select-none">Live Orders</p>
          <h3 className="text-lg font-black tracking-tight leading-none metric-box-text">{ordersActive.length}</h3>
        </div>
        <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-black/20 rounded w-fit border border-white/10 backdrop-blur-sm mt-1">
            <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[5.5px] font-black tracking-widest text-emerald-100 uppercase leading-none">Active</span>
        </div>
      </div>

      {/* Inventory Card */}
      <div className="w-full bg-gradient-to-br from-[#015f3e] to-[#043324] rounded-2xl p-2 text-white shadow-xl flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
        <div>
          <p className="text-emerald-100 text-[6px] uppercase font-black tracking-widest mb-0.5 w-full truncate select-none">Inventory</p>
          <h3 className="text-lg font-black tracking-tight leading-none truncate metric-box-text">
            <AnimatedCounter value={products.filter((p: any) => Number(p.stock) > 0).length} />
          </h3>
        </div>
        <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-black/20 rounded w-fit border border-white/10 backdrop-blur-sm select-none mt-1">
            <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[4.8px] font-black tracking-widest text-emerald-100 uppercase text-nowrap leading-none shrink-0">
              {products.filter((p: any) => Number(p.stock) > 0).length}/{products.length} In Stock
            </span>
        </div>
      </div>

      {/* Delivered Card */}
      <div className="w-full bg-gradient-to-br from-[#aa4403] via-[#853c02] to-[#4a1c02] rounded-2xl p-2 text-white shadow-xl flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
        <div>
          <p className="text-amber-100 text-[6px] uppercase font-black tracking-widest mb-0.5 w-full truncate select-none animate-pulse">Delivered</p>
          <h3 className="text-lg font-black tracking-tight leading-none metric-box-text">
              <AnimatedCounter value={historyOrders.length} />
          </h3>
        </div>
        <div className="flex items-center space-x-0.5 px-1.5 py-0.5 border border-amber-400 bg-amber-500/10 rounded w-fit backdrop-blur-sm select-none mt-1">
            <div className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[5.5px] font-black tracking-widest text-amber-200 uppercase text-nowrap leading-none">Success</span>
        </div>
      </div>

      {/* Duty Card */}
      <div 
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const newState = !isShopOnline;
            setIsShopOnline(newState);
            
            const storedShops = JSON.parse(localStorage.getItem('grezto_offline_shops') || '[]');
            const shopIdx = storedShops.findIndex((s: any) => s.id === shop.id);
            if (shopIdx !== -1) {
              storedShops[shopIdx].isOpen = newState;
            } else {
              storedShops.push({ ...shop, isOpen: newState });
            }
            localStorage.setItem('grezto_offline_shops', JSON.stringify(storedShops));
            window.dispatchEvent(new Event('grezto-products-updated'));

            const response = await fetch(getApiUrl('/api/shops/update'), {
              method: 'POST',
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                shopId: shop.id,
                city: shop.city,
                updateData: { isOpen: newState }
              })
            });
            if (!response.ok) {
              throw new Error('Server returned error status');
            }
            toast.success(newState ? "Shop is now Online" : "Shop is now Offline");
          } catch (err) {
            setIsShopOnline(!isShopOnline);
            toast.error("Failed to update status");
          }
        }} 
        className={`w-full ${isShopOnline ? 'bg-[#05402a]' : 'bg-slate-700'} rounded-2xl p-2 text-white shadow-xl flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden cursor-pointer active:scale-95 transition-all z-20 font-sans`}
      >
        <div className="flex justify-between items-start">
          <p className="text-emerald-100 text-[6px] uppercase font-black tracking-widest mb-0.5 w-full truncate select-none text-white/70">Duty</p>
          <div className="relative inline-flex items-center">
            <div className={`w-5 h-2.5 rounded-full transition-colors relative ${isShopOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}>
              <div className={`absolute top-[1px] left-[1px] bg-white w-[8px] h-[8px] rounded-full transition-transform ${isShopOnline ? 'translate-x-[10px]' : 'translate-x-0'}`}></div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight leading-none truncate metric-box-text">{isShopOnline ? 'Online' : 'Offline'}</h3>
        </div>
        <div className="flex items-center space-x-0.5 px-1 py-0.5 w-fit mt-0.5">
          <span className="text-[5px] font-black tracking-widest text-emerald-100 uppercase opacity-80 mt-1">Tap to toggle</span>
        </div>
      </div>
    </div>
  );
}
