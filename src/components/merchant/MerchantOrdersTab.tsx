import React from 'react';
import { Package } from 'lucide-react';
import { MerchantOrderCard } from '../MerchantOrderCard';

interface MerchantOrdersTabProps {
  orders: any[];
  shop: any;
  riders: any[];
  handleUpdateStatus: (orderId: string, status: string, partnerInfo?: any) => Promise<any> | any;
  mapsAuthError: boolean;
  busyRiders: string[];
  isHistory?: boolean;
  isLoading?: boolean;
}

export function MerchantOrdersTab({
  orders,
  shop,
  riders,
  handleUpdateStatus,
  mapsAuthError,
  busyRiders,
  isHistory = false,
  isLoading = false,
}: MerchantOrdersTabProps) {

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          {isHistory ? "Completed Store Orders list (History)" : "Active Store Orders list"}
        </span>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
            {isHistory ? "Order History" : "Realtime live updates"}
          </span>
        </div>
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
             <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-2.5">
                     <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse"></div>
                     <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse"></div>
                   </div>
                   <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-10 w-full bg-slate-50 rounded-xl animate-pulse mt-1"></div>
             </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-400 px-6">
          <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-3" />
          <p className="text-[10px] uppercase font-black tracking-widest mb-1.5">No orders found</p>
          <p className="text-[10px] text-slate-400 font-medium max-w-[240px] mx-auto leading-relaxed">
            Orders placed by customers from your shop/hotel will be instantly generated here!
          </p>
        </div>
      ) : (
        orders.map((order) => (
          <MerchantOrderCard 
            key={order.id}
            order={order}
            shop={shop}
            riders={riders}
            handleUpdateStatus={handleUpdateStatus}
            mapsAuthError={mapsAuthError}
            busyRiders={busyRiders}
            isHistory={isHistory}
          />
        ))
      )}
    </div>
  );
}
