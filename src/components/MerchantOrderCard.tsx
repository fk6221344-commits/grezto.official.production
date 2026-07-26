import React, { useState, useEffect } from 'react';
import { Phone, Clock, CheckCircle, ChevronUp, ChevronDown, MapPin, ShoppingBag, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { stopAlertAlarmLoop } from '../services/notifications';
import OrderedProductsModal from './OrderedProductsModal';

interface LiveTimerProps {
  startTime: any;
  status: string;
}

function LiveTimer({ startTime, status }: LiveTimerProps) {
  const [remaining, setRemaining] = useState<number>(3600); // 3600 seconds = 60 mins

  useEffect(() => {
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
    // Show only a red dot (red bindu) indicating time is up. No text at all!
    return (
      <div className="flex items-center justify-center shrink-0 ml-1">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_8px_#dc2626]"></span>
        </span>
      </div>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const displayTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 select-none shrink-0 ml-1">
      <div className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#008c50] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#008c50] shadow-[0_0_6px_#008c50]"></span>
      </div>
      <span className="font-extrabold text-[14px] text-[#008c50] font-sans leading-none tracking-tight">
        {displayTime}
      </span>
    </div>
  );
}

const getStatusRank = (st: string): number => {
  const norm = (st || '').toLowerCase().trim();
  if (norm === 'received' || norm === 'pending' || norm === 'receipt preparing') return 1;
  if (norm === 'preparing') return 2;
  if (norm === 'packed') return 3;
  if (norm === 'out for delivery') return 4;
  if (norm === 'delivered') return 5;
  return 0;
};

interface MerchantOrderCardProps {
  order: any;
  shop: any;
  riders: any[];
  handleUpdateStatus: (orderId: string, status: string, riderData?: any) => void;
  mapsAuthError: boolean;
  busyRiders?: string[];
}

export const MerchantOrderCard = React.memo(({ 
  order, 
  shop, 
  riders, 
  handleUpdateStatus, 
  mapsAuthError, 
  busyRiders 
}: MerchantOrderCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localStatus, setLocalStatus] = useState(order.status || 'Pending');
  const [selectedRider, setSelectedRider] = useState(order.partnerPhone || '');
  const [isCardCollapsed, setIsCardCollapsed] = useState(order.status === 'Delivered');
  const [showItemsList, setShowItemsList] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (order.status === 'Out for Delivery' && !order.riderAccepted && order.assignedAt) {
      const assignedTime = new Date(order.assignedAt).getTime();
      const diff = Math.floor((Date.now() - assignedTime) / 1000);
      return Math.max(0, 60 - diff);
    }
    return 0;
  });

  useEffect(() => {
    setLocalStatus(order.status || 'Pending');
    if (order.status === 'Delivered') {
      setIsCardCollapsed(true);
    } else {
      setIsCardCollapsed(false);
    }
  }, [order.status]);

  useEffect(() => {
    setSelectedRider(order.partnerPhone || '');
    setIsAssigning(false);
  }, [order.partnerPhone]);

  useEffect(() => {
    if (order.status !== 'Out for Delivery' || order.riderAccepted || !order.assignedAt) {
      setSecondsLeft(0);
      return;
    }

    const assignedTime = new Date(order.assignedAt).getTime();
    const diffInitial = Math.floor((Date.now() - assignedTime) / 1000);
    const initialLeft = Math.max(0, 60 - diffInitial);
    setSecondsLeft(initialLeft);

    const autoResetAssignment = async () => {
      try {
        const { supabase } = await import('../services/supabase');
        const updateData = { 
          status: "Packed",
          partnerPhone: null,
          partnerName: null,
          riderAccepted: false,
          assignedAt: null as any,
          deliveryOtp: null as any
        };
        await supabase.from('orders').update(updateData).eq('id', order.id);
      } catch (e) {
        console.warn("Could not auto-reset assignment:", e);
      }
    };

    if (initialLeft <= 0) {
      autoResetAssignment();
      return;
    }

    const interval = setInterval(async () => {
      const diff = Math.floor((Date.now() - assignedTime) / 1000);
      const left = Math.max(0, 60 - diff);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        autoResetAssignment();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.status, order.riderAccepted, order.assignedAt]);

  const orderItemsList = order.items || order.fullItems || [];
  const merchantItems = orderItemsList.length > 0 
    ? orderItemsList.filter((i: any) => i.shopId === shop.id || i.productShopId === shop.id)
    : [];

  const displayName = order.customerName || order.name || 'Grezto Customer';
  const displayPhone = order.phone || order.customerPhone || order.userPhone || 'No Phone Number';
  const addressTemp = order.address || 'Morigaon Town Center, Assam';
  const displayAddress = typeof addressTemp === 'object' ? (addressTemp?.address || JSON.stringify(addressTemp)) : addressTemp;
  const displayAmount = order.amount || order.totalAmount || 0;

  if (isCardCollapsed) {
    return (
      <div 
        onClick={() => setIsCardCollapsed(false)}
        className="bg-gray-50/70 p-3.5 px-4.5 rounded-[1.5rem] border border-gray-100 flex items-center justify-between gap-3 text-left transition-all hover:bg-gray-100/60 cursor-pointer mb-2 animate-fade-in"
        title="Click to expand details"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-xs shadow-inner shrink-0 text-emerald-600 font-bold border border-emerald-100/40">✓</div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-700 text-xs tracking-tight truncate max-w-[150px] m-0">{displayName}</h3>
            <p className="text-[8px] text-gray-405 font-extrabold uppercase tracking-widest leading-none mt-1.5">{displayPhone} • ₹{displayAmount}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          <p className="text-[9px] text-gray-400 font-medium italic truncate max-w-[110px] hidden sm:block">
            {merchantItems?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
          </p>
          <div className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-405 border border-gray-200 text-right font-sans">
            <span className="font-black text-[7.5px] uppercase tracking-wider block">Delivered ✓</span>
            <span className="text-[6.5px] text-gray-400 font-bold block bg-white px-1 py-0.5 rounded-sm mt-0.5 border border-gray-100">
              {order.parsedCreatedAt ? new Date(order.parsedCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-6 border border-black/15 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08),_0_0_0_1px_rgba(15,23,42,0.03)] space-y-4 relative overflow-hidden text-left mb-5 transition-all duration-300 hover:translate-y-[-4px] hover:shadow-[0_28px_60px_-10px_rgba(15,23,42,0.14)]">
      {/* Top row: Customer details, Name, Beautiful Glowing Digital Timer & Right-aligned Price with Call Button */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 text-left font-sans flex-grow">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-extrabold text-slate-800 text-base tracking-tight truncate leading-tight uppercase flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{displayName}</span>
            </h4>
            {/* Vertical Green Timer with Pulse dot - No Background */}
            <div className="flex items-center select-none shrink-0 border-l border-slate-100 pl-1.5">
              <LiveTimer startTime={order.createdAt?.seconds * 1000 || order.createdAt} status={order.status} />
            </div>
          </div>
          {displayPhone && (
            <p className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase mt-1 flex items-center gap-1">
              <span className="text-slate-350">•</span> {displayPhone}
            </p>
          )}
        </div>

        {/* Right-aligned Section: Amount, Payment Mode & Green Call Button */}
        <div className="flex items-center gap-3 shrink-0 pl-1">
          {/* Circular solid emerald-green call button placed at the right corner */}
          {displayPhone && (
            <a
              href={`tel:${displayPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#008c50] text-white border border-[#008c50]/20 shadow-sm cursor-pointer shrink-0 select-none active:scale-95"
              title="Call Customer"
            >
              <Phone size={14} className="text-white" strokeWidth={2.5} />
            </a>
          )}
          <div className="text-right">
            <div className="text-[#008c50] text-[18px] font-extrabold tracking-tight leading-none">
              ₹{displayAmount}
            </div>
            <span className="text-slate-450 font-black tracking-widest text-[8px] uppercase block mt-1">
              {order.paymentMode === 'cod' || order.payment_mode === 'cod' ? 'COLLECT CASH' : 'PREPAID'}
            </span>
          </div>
        </div>
      </div>

      {/* Address Rounded Box with a beautiful thin border and light slate text color */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="border border-slate-100 px-3 py-2 rounded-xl flex items-center gap-2 bg-slate-50/60 hover:bg-slate-100/85 text-left mt-3 cursor-pointer transition-all select-none font-sans"
      >
        <MapPin size={11} className="text-rose-400 shrink-0" />
        <p className="text-slate-500 text-[11px] font-medium leading-tight truncate flex-grow">
          {displayAddress}
        </p>
      </div>

      {/* Dashed line divider */}
      <div className="border-t border-dashed border-slate-200 my-3.5"></div>

      {/* Items count & view items trigger */}
      <div className="flex justify-between items-center text-xs font-sans">
        <span className="text-slate-400 font-bold">
          {merchantItems?.length || 1} { (merchantItems?.length || 1) === 1 ? 'Item' : 'Items' } to deliver
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowItemsList(true); }}
          className="font-extrabold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest text-[10px] hover:underline cursor-pointer flex items-center gap-0.5"
        >
          View Items <span className="text-[9px]">&gt;</span>
        </button>
      </div>

      {/* Dark/solid separator */}
      <div className="border-t border-slate-100 my-3"></div>

      <OrderedProductsModal  
        isOpen={showItemsList} 
        onClose={() => setShowItemsList(false)}
        items={merchantItems}
        totalAmount={displayAmount}
      />

      {/* Expanded GPS and Map detail */}
      {isExpanded && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-2 space-y-4 animate-fade-in text-left">
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>GPS Delivery Map View</span>
              {order.lat && order.lng && (
                <button 
                  onClick={() => {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`, '_system');
                  }} 
                  className="text-emerald-600 hover:underline font-extrabold uppercase text-[8px] bg-transparent border-0 cursor-pointer"
                >
                  Open in Google Maps
                </button>
              )}
            </p>
            {order.lat && order.lng ? (
              <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 text-center relative overflow-hidden shadow-sm flex flex-col items-center justify-center">
                {/* Visual Radar Pulse background */}
                <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                  <div className="w-[120px] h-[120px] border border-rose-500 rounded-full animate-ping" />
                  <div className="w-[80px] h-[80px] border border-rose-500 rounded-full" />
                </div>
                
                <MapPin className="w-5 h-5 text-rose-500 animate-bounce mb-1 z-10" />
                <span className="text-[8.5px] font-black uppercase text-rose-450 tracking-widest z-10 font-sans">Coordinates Registered</span>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-1 px-2 z-10 leading-normal">
                  Delivery coordinates locked. Use link above for dynamic visual street navigation.
                </p>
                <div className="mt-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-0.5 text-[8.5px] font-mono text-rose-400 font-bold uppercase tracking-widest z-10">
                  {Number(order.lat).toFixed(5)}, {Number(order.lng).toFixed(5)}
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-slate-400 italic">Exact GPS coordinates not available.</p>
            )}
          </div>
        </div>
      )}

      {/* Order Controls/Actions */}
      {order.status === 'Out for Delivery' || isAssigning ? (
        <div className="pt-3.5 border-t border-slate-100/60 flex flex-col gap-2 text-left bg-gradient-to-tr from-emerald-500/5 to-teal-500/5 p-3 rounded-2xl border border-emerald-100/50 mt-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 font-sans">Active Ride Assignment 🛵</span>
          </div>
          <div className="p-2.5 bg-white border border-emerald-100 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Rider Name</span>
              <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-tight mt-1 truncate max-w-[90px]">
                {order.partnerName || (riders.find((r: any) => r.phone === selectedRider)?.name) || 'Rider'}
              </span>
            </div>
            
            {!order.riderAccepted && secondsLeft > 0 && order.status === 'Out for Delivery' && (
              <div className="flex flex-col items-center justify-center py-1 px-3 bg-amber-50 rounded-full border border-amber-100/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                <span className="text-[10px] font-black tracking-[0.15em] text-amber-600 animate-pulse">{secondsLeft}s</span>
              </div>
            )}
            
            <div className="text-right flex flex-col">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Contact Phone</span>
              <span className="text-[9.5px] font-mono font-black text-slate-700 mt-1">
                {order.partnerPhone || selectedRider}
              </span>
            </div>
          </div>
          {order.riderAccepted && (
            <div className="flex justify-center -mt-2.5 z-10 mx-auto bg-emerald-500 text-white rounded-b-xl px-4 py-1.5 shadow-sm border border-emerald-600 animate-in slide-in-from-top-2 duration-300">
              <span className="text-[7.5px] font-black uppercase tracking-[0.25em]">Assignment Success ✓</span>
            </div>
          )}
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider text-center mt-1">
            Rider is on the way. Controls locked to protect delivery lifecycle.
          </p>
        </div>
      ) : order.status === 'Delivered' ? (
        <div className="pt-3 p-3 bg-gray-50 border border-gray-150 rounded-2xl flex flex-col gap-1 text-center mt-2">
          <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">✓ Order Completed</span>
          <span className="text-[8px] text-gray-400 font-extrabold uppercase tracking-widest">Delivered by {order.partnerName || 'Rider'}</span>
        </div>
      ) : (
        <div className="pt-3.5 border-t border-slate-100/60 flex flex-col gap-2 text-left">
          {(order.status === 'Received' || order.status === 'Pending' || order.status === 'Receipt Preparing' || !order.status) && (
            <div className="flex justify-start pb-1.5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
              <button
                onClick={async () => {
                  try {
                    stopAlertAlarmLoop();
                  } catch (e) {}
                  await handleUpdateStatus(order.id, 'Preparing');
                  setLocalStatus('Preparing');
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-[9.5px] uppercase tracking-widest rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all transform active:scale-95 cursor-pointer flex items-center space-x-1.5 border-0"
              >
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                <span>Accept Order ✨</span>
              </button>
            </div>
          )}
          <span className="text-[9.5px] font-black uppercase text-slate-500 tracking-wider font-sans">Update order status:</span>
          <div className="w-full relative">
            <select 
              value={localStatus}
              onChange={(e) => {
                const val = e.target.value;
                setLocalStatus(val);
                if (val !== 'Out for Delivery') {
                  handleUpdateStatus(order.id, val);
                }
              }}
              className="w-full bg-white border border-slate-200 text-slate-800 py-3.5 px-3 pr-10 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
            >
              <option value="Received" disabled={getStatusRank('Received') < getStatusRank(order.status)}>📥 Received (Receipt)</option>
              <option value="Preparing" disabled={getStatusRank('Preparing') < getStatusRank(order.status)}>🎛️ Preparing</option>
              <option value="Packed" disabled={getStatusRank('Packed') < getStatusRank(order.status)}>📦 Packed</option>
              <option value="Out for Delivery" disabled={getStatusRank('Out for Delivery') < getStatusRank(order.status)}>🛵 Out for Delivery</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <span className="text-[10px]">▼</span>
            </div>
          </div>

          {localStatus === 'Out for Delivery' && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-dashed border-slate-200 mt-2 text-left animate-fade-in">
              <label className="text-[7.5px] font-black uppercase text-slate-550 tracking-wider mb-1 block font-sans">Assign Driver / Rider</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRider}
                  onChange={(e) => setSelectedRider(e.target.value)}
                  disabled={secondsLeft > 0}
                  className={`flex-grow bg-white border border-slate-200 text-slate-800 py-2.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer font-sans ${
                    secondsLeft > 0 ? "opacity-60 cursor-not-allowed bg-gray-50" : ""
                  }`}
                >
                  <option value="">-- Choose Rider --</option>
                  {riders.filter((r: any) => {
                    if (!r.phone) return false;
                    const isCurrentlySelectedOrAssigned = r.phone === (order.partnerPhone || '') || r.phone === selectedRider;
                    return r.status === 'Online' || isCurrentlySelectedOrAssigned;
                  }).map((r: any) => {
                    const codBalance = Number(r.codBalance) || 0;
                    const isOverLimit = codBalance >= 1500;
                    return (
                      <option 
                        key={r.id || r.phone} 
                        value={r.phone}
                        className={isOverLimit ? "text-rose-500 font-bold" : ""}
                      >
                        {(r.name || '').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}{isOverLimit ? ` [BLOCKED: ₹${codBalance} overlimit]` : ''}
                      </option>
                    );
                  })}
                </select>

                {selectedRider && (selectedRider !== (order.partnerPhone || '') || (secondsLeft === 0 && !order.riderAccepted)) && !isAssigning && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedRider) {
                        toast.error("Please choose a delivery rider first!");
                        return;
                      }
                      const matchedRider = riders.find((r: any) => r.phone === selectedRider);
                      if (matchedRider) {
                        setIsAssigning(true);
                        handleUpdateStatus(order.id, 'Out for Delivery', { id: matchedRider.id, name: matchedRider.name, phone: matchedRider.phone });
                        toast.success("Successfully submitted! 🎉");
                        toast.success(`Ringtone sound sent immediately to delivery boy ${matchedRider.name}! 🚀🔊`);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[9px] uppercase tracking-wider py-2.5 px-4.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0 cursor-pointer border-none font-sans"
                  >
                    Submit
                  </button>
                )}
              </div>

              {secondsLeft > 0 && (
                <div className="mt-2 text-[8px] font-black text-amber-700 bg-amber-50/80 border border-amber-200 p-2 rounded-xl flex items-center gap-1.5 animate-pulse font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  RIDER ACCEPTANCE PENDING: {secondsLeft}s REMAINING 🛵🔊
                </div>
              )}

              {order.partnerPhone && !order.riderAccepted && secondsLeft === 0 && (
                <div className="mt-2 text-[8px] font-black text-rose-700 bg-rose-50/80 border border-rose-200 p-2 rounded-xl flex items-center gap-1.5 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  TIMEOUT: Rider did not accept within 60s! Please choose another rider and retry.
                </div>
              )}

              {order.partnerName && (
                <p className="text-[8px] mt-2 text-slate-500 font-bold uppercase tracking-wider font-sans flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${order.riderAccepted ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`}></span>
                  Assigned: <span className="text-emerald-700 font-black">{order.partnerName}</span> ({order.partnerPhone})
                  {order.riderAccepted ? (
                    <span className="ml-auto text-emerald-600 font-extrabold uppercase tracking-widest text-[7.5px] bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 font-sans">ACCEPTED ✓</span>
                  ) : (
                    <span className="ml-auto text-amber-600 font-extrabold uppercase tracking-widest text-[7.5px] bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-sans font-black animate-pulse">AWAITING SYSTEM...</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Display Delivery Proof if available */}
      {order.deliveryProofUrl && (
        <div className="mt-3 w-full flex items-center gap-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 animate-fade-in">
          <img src={order.deliveryProofUrl} alt="Delivery Proof" className="w-14 h-14 object-cover rounded-xl shadow-sm border border-emerald-100/50" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 leading-none mb-1">
              <CheckCircle className="w-3.5 h-3.5" /> Handover Proof
            </span>
            <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider">
              Delivered by: <span className="text-slate-800">{order.partnerName || 'Rider'}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

MerchantOrderCard.displayName = 'MerchantOrderCard';
