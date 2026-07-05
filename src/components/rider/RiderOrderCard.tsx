import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, MapPin, Phone, Navigation, ChevronRight, Bike, Compass } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import SwipeableButton from '../ui/SwipeableButton';

interface LiveTimerProps {
  startTime: any;
  status: string;
}

function LiveTimer({ startTime, status }: LiveTimerProps) {
  const [remaining, setRemaining] = React.useState<number>(3600); // 3600 seconds = 60 mins

  React.useEffect(() => {
    const start = startTime?.seconds ? startTime.seconds * 1000 : startTime;
    if (!start) return;

    const update = () => {
      const startMs = new Date(start).getTime();
      const elapsedMs = Date.now() - startMs;
      const remainingMs = (60 * 60 * 1000) - elapsedMs;
      setRemaining(Math.max(0, Math.floor(remainingMs / 1000)));
    };

    update();
    if (status === 'Delivered' || status === 'Cancelled') return;

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, status]);

  if (status === 'Delivered') {
    return null;
  }

  if (remaining <= 0) {
    return (
      <div className="flex items-center justify-center shrink-0 ml-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-[0_0_6px_#dc2626]"></span>
        </span>
      </div>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const displayTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1 select-none shrink-0 ml-1 bg-emerald-50/40 border border-emerald-500/10 px-1 py-0.5 rounded">
      <div className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#008c50] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#008c50]"></span>
      </div>
      <span className="font-extrabold text-[11px] text-[#008c50] font-mono leading-none tracking-tight">
        {displayTime}
      </span>
    </div>
  );
}

interface RiderOrderCardProps {
  key?: any;
  order: any;
  activeTab: 'pending' | 'history';
  shopsFeed: any[];
  handleAcceptOrder: (orderId: string) => Promise<any> | any;
  openDoorstepAssist: (order: any, shopDetails: any) => void;
  setSelectedOrder: (order: any) => void;
}

export function RiderOrderCard({
  order,
  activeTab,
  shopsFeed,
  handleAcceptOrder,
  openDoorstepAssist,
  setSelectedOrder
}: RiderOrderCardProps) {
  const orderItems = order.items || order.fullItems || [];
  const customerPhone = order.phone || order.customerPhone || order.userPhone || '';
  const itemsCount = orderItems.length > 0 
    ? orderItems.length 
    : 1;
  const isIncoming = activeTab === 'pending' && !order.riderAccepted;

  const [secondsLeftRider, setSecondsLeftRider] = React.useState(() => {
    if (isIncoming && order.assignedAt) {
      const assignedTime = typeof order.assignedAt === 'string' 
        ? new Date(order.assignedAt).getTime() 
        : Number(order.assignedAt || 0);
      const diff = Math.floor((Date.now() - assignedTime) / 1000);
      return Math.max(0, 60 - diff);
    }
    return 0;
  });

  React.useEffect(() => {
    if (!isIncoming || !order.assignedAt) {
      setSecondsLeftRider(0);
      return;
    }

    const getLeft = () => {
      const assignedTime = typeof order.assignedAt === 'string' 
        ? new Date(order.assignedAt).getTime() 
        : Number(order.assignedAt || 0);
      const diff = Math.floor((Date.now() - assignedTime) / 1000);
      return Math.max(0, 60 - diff);
    };

    setSecondsLeftRider(getLeft());

    const interval = setInterval(() => {
      const left = getLeft();
      setSecondsLeftRider(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isIncoming, order.assignedAt]);
  
  // Resolve active shop coordinates and details dynamically for multi-leg journey
  const distinctShops = React.useMemo(() => {
    const shops: any[] = [];
    const seenIds = new Set<string>();
    
    for (const item of orderItems) {
      if (item.shopId && item.shopId !== 'admin' && !seenIds.has(item.shopId)) {
        seenIds.add(item.shopId);
        const matched = shopsFeed.find((s: any) => s.id === item.shopId);
        if (matched) {
          shops.push({
            id: item.shopId,
            name: matched.name || item.shopName || 'Local Merchant Shop',
            address: matched.address || 'Assam Market Sector',
            lat: Number(matched.lat) || 26.243455,
            lng: Number(matched.lng) || 92.1306235
          });
        } else if (item.shopName) {
          shops.push({
            id: item.shopId,
            name: item.shopName,
            address: 'Assam Market Sector',
            lat: 26.243455,
            lng: 92.1306235
          });
        }
      }
    }
    
    if (shops.length === 0) {
      shops.push({
        id: 'admin',
        name: 'Grezto Central Hub (Admin Warehouse)',
        address: 'Grezto Warehouse Central Sector, Kawarhagi, Assam',
        lat: 26.243455,
        lng: 92.1306235
      });
    }
    
    return shops;
  }, [orderItems, shopsFeed]);

  const shopDetails = distinctShops[0];

  const formatCardTime = (createdAt: any) => {
    if (!createdAt) return 'Continuous Delivery';
    try {
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Just Now';
    }
  };

  return (
    <motion.div 
      layout
      className={`rounded-[1.50rem] border p-4.5 space-y-3.5 shadow-xs transition-all duration-150 text-left ${
        isIncoming 
          ? 'bg-amber-50/25 border-amber-300 shadow-md ring-4 ring-amber-500/5' 
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Order header strip */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black bg-slate-100 text-slate-655 px-2 py-0.5 rounded border border-slate-200">
              #{order.id?.slice(-5).toUpperCase() || 'ORDER'}
            </span>
            <span className={isIncoming ? "text-[8px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1" : "text-[8px] font-bold text-slate-400"}>
              {isIncoming ? "🚨 INCOMING JOB" : formatCardTime(order.createdAt)}
            </span>
          </div>
          
          <h3 className="text-[13px] font-extrabold text-slate-800 tracking-tight mt-1 flex items-center gap-1.5 flex-wrap">
            <span>{order.customerName || 'Loyal Client'}</span>
            {!isIncoming && (
              <LiveTimer startTime={order.createdAt} status={order.status} />
            )}
          </h3>
        </div>

        {/* Payout Cash Badge */}
        <div className="text-right">
          <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Collect Cash</span>
          <span className="text-[12.5px] font-black text-emerald-700 font-mono">
            ₹{order.finalAmount || (Number(order.totalAmount || order.amount || 0) + Number(order.deliveryCharge || 0))}
          </span>
        </div>
      </div>

      {/* Pick up Stores Capsule */}
      <div 
        onClick={() => setSelectedOrder(order)}
        className="bg-emerald-50/40 border-2 border-emerald-500/15 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-100/40 hover:border-emerald-500/25 active:scale-[0.98] transition-all select-none"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase text-[#008c50] tracking-wider font-sans">
            Pick Up Stores ({distinctShops.length})
          </span>
          <div className="space-y-1.5 mt-0.5">
            {distinctShops.map((shop, sIdx) => {
              const displayShopName = shop.name === 'Grezto Central Hub (Admin Warehouse)' 
                ? 'Grezto Central Hub (Admin)' 
                : shop.name;
              
              const displayShopAddress = shop.address === 'Grezto Warehouse Central Sector, Kawarhagi, Assam'
                ? 'Central Sector, Kawarhagi, Assam'
                : shop.address;

              return (
                <div key={sIdx} className="flex items-start gap-2 text-[11px]">
                  <span className="text-emerald-600 font-bold shrink-0">🛒</span>
                  <div className="text-left font-sans leading-tight min-w-0">
                    <span className="font-extrabold text-slate-800 break-words">{displayShopName}</span>
                    <span className="text-slate-400 text-[9px] ml-1.5">({displayShopAddress})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 text-[#008c50] bg-emerald-100/50 p-1.5 rounded-full border border-emerald-200">
          <ChevronRight size={16} strokeWidth={3} className="animate-pulse" />
        </div>
      </div>

      {/* Address Capsule */}
      <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-start gap-2.5">
        <MapPin size={13} className="text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold text-slate-700 leading-tight">
            {typeof order.address === 'object'
              ? (order.address?.address || 'Kawarhagi Delivery Route')
              : (order.address || 'Kawarhagi Delivery Route')}
          </p>
        </div>
      </div>

      {!isIncoming && activeTab === 'pending' && false && (
        <div className="bg-slate-950 border border-slate-900 rounded-[1.25rem] p-4.5 space-y-4 my-2.5 text-left text-white font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900">
            <div className="flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-[#00E676] -rotate-12 stroke-[2.5]" />
              <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-[#00E676] animate-pulse">
                Active GPS Multi-Leg Route
              </span>
            </div>
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">
              Rider Co-Pilot Mode
            </span>
          </div>

          <div className="relative pl-5 space-y-5 border-l border-dashed border-slate-850 ml-1.5">
            {/* LEG 1: PICK UP FROM SHOP */}
            <div className="relative text-left">
              <span className={`absolute -left-[27.5px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black transition-all ${
                order.parcelPicked
                  ? 'bg-[#00E676] text-slate-950 shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                  : 'bg-amber-400 text-slate-950 animate-pulse font-bold'
              }`}>
                {order.parcelPicked ? '✓' : '1'}
              </span>

              <div className="space-y-0.5">
                <div className="flex justify-between items-center gap-2">
                  <span className={`text-[8.5px] font-black uppercase tracking-wider ${order.parcelPicked ? 'text-slate-500' : 'text-amber-400'}`}>
                    STEP 1: Pick Up Parcel (Store)
                  </span>
                  {order.parcelPicked && (
                    <span className="text-[7.5px] font-black uppercase text-[#00E676] bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">
                      COLLECTED
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-extrabold text-white leading-tight">
                  {shopDetails.name}
                </p>
                <p className="text-[9.5px] text-slate-400 leading-snug">
                  {shopDetails.address}
                </p>

                {!order.parcelPicked && (
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${shopDetails.lat},${shopDetails.lng}&travelmode=driving`, '_system');
                      }}
                      className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg font-black text-[8px] uppercase tracking-wider flex items-center gap-1 border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-amber-500/10 no-underline"
                    >
                      <Compass size={11} strokeWidth={3} className="text-slate-950" /> NAV TO STORE (PICK-UP)
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          await supabase.from('orders').update({ parcelPicked: true }).eq('id', order.id);
                          toast.success("📦 Package Collected! Leg 2 opened - navigate to customer doorstep pin.");
                        } catch (err) {
                          toast.error("Update failed.");
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-black text-[8px] uppercase tracking-wider border border-slate-850 cursor-pointer transition-all active:scale-95"
                    >
                      Mark Collected ✓
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LEG 2: DELIVER TO CUSTOMER */}
            <div className="relative text-left flex-1">
              <span className={`absolute -left-[27.5px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${
                order.parcelPicked
                  ? 'bg-[#00E676] text-slate-950 animate-pulse font-bold'
                  : 'bg-slate-900 text-slate-650 border border-slate-850'
              }`}>
                2
              </span>

              <div className="space-y-0.5">
                <span className={`text-[8.5px] font-black uppercase tracking-wider ${order.parcelPicked ? 'text-amber-400' : 'text-slate-500'}`}>
                  STEP 2: Deliver to Customer Doorstep
                </span>
                <p className="text-[12px] font-extrabold text-white leading-tight">
                  {order.customerName}
                </p>
                <p className="text-[9.5px] text-slate-400 leading-snug">
                  {typeof order.address === 'object' ? (order.address?.address || '') : (order.address || '')}
                </p>

                {order.parcelPicked && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.lat || 26.1852},${order.lng || 91.7538}&travelmode=driving`, '_system');
                      }}
                      className="inline-flex px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-650 text-white rounded-lg font-black text-[8px] uppercase tracking-widest items-center gap-1.5 border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-emerald-550/15 no-underline"
                    >
                      <Navigation size={12} strokeWidth={3} className="animate-bounce" /> NAV TO CUSTOMER (DOORSTEP) 📍
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Layout Block */}
      <div className="hidden">
        <div>
          <div>
            <p>
              {typeof order.address === 'object'
                ? (order.address?.address || 'Kawarhagi Delivery Route')
                : (order.address || 'Kawarhagi Delivery Route')}
            </p>
            {customerPhone ? (
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Phone: +91 {customerPhone}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Products summary accordion trigger */}
      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 pt-1 border-t border-dashed border-slate-150">
        <span>{itemsCount} {itemsCount === 1 ? 'Item' : 'Items'} to deliver</span>
        <button 
          onClick={() => setSelectedOrder(order)}
          className="text-[9.5px] font-black text-slate-900 border-0 bg-transparent hover:underline cursor-pointer flex items-center gap-0.5"
        >
          View Items <ChevronRight size={12} className="mt-0.5" />
        </button>
      </div>

      {/* Action buttons (only for Assignment pending tab) */}
      {activeTab === 'pending' && (
        <div className="flex gap-2 pt-1 border-t border-slate-150/50">
          {isIncoming ? (
            <div className="w-full mt-2">
              {secondsLeftRider <= 0 ? (
                <div className="w-full py-4 rounded-2xl bg-rose-50 text-rose-500 font-black text-[11px] uppercase tracking-widest flex items-center justify-center border-2 border-rose-100">
                  ASSIGNMENT TIMEOUT 🛑
                </div>
              ) : (
                <SwipeableButton 
                  onSwipeComplete={() => handleAcceptOrder(order.id)}
                  text={`SWIPE TO ACCEPT (${secondsLeftRider}s)`}
                />
              )}
            </div>
          ) : (
            <>
              {/* Navigation Button */}
              <button 
                onClick={() => {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.lat || 26.1852},${order.lng || 91.7538}&travelmode=driving`, '_system');
                }}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-[#1a73e8] py-3 rounded-xl font-black text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer shadow-xs active:scale-95 border-b-2 border-b-[#1a73e8]/30 no-underline"
              >
                <Navigation size={12} className="text-[#1a73e8]" /> MAP
              </button>

              {/* Trigger Call Customer - Styled exact match as requested */}
              <a 
                href={customerPhone ? `tel:${customerPhone}` : "tel:1234567890"}
                className="px-4.5 py-3 bg-[#00b56c] text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95 text-center leading-none"
              >
                <Phone size={14} className="text-white" strokeWidth={2.5} />
              </a>

              {/* Delivery Complete Confirmation Button - Opens doorstep assist system */}
              <button 
                onClick={() => openDoorstepAssist(order, shopDetails)}
                className="flex-[1.5] bg-slate-900 hover:bg-black text-white py-3 border-0 rounded-xl font-black text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-1 transition cursor-pointer shadow-xs active:scale-95"
              >
                Delivered
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
