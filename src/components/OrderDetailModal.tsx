import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, MapPin, Phone, CreditCard, Clock, ShoppingBag, ArrowRight } from 'lucide-react';

interface OrderDetailModalProps {
  order: any;
  onClose: () => void;
  onUpdateStatus?: (order: any, status: string) => void;
}

export default function OrderDetailModal({ order, onClose, onUpdateStatus }: OrderDetailModalProps) {
  const [mapsAuthError, setMapsAuthError] = useState(Boolean((window as any).grezto_maps_auth_failed));

  useEffect(() => {
    const handleAuthFailed = () => {
      setMapsAuthError(true);
    };
    window.addEventListener('grezto-maps-auth-failed', handleAuthFailed);
    return () => {
      window.removeEventListener('grezto-maps-auth-failed', handleAuthFailed);
    };
  }, []);

  if (!order) return null;

  // Format Order Time
  let formattedTime = 'Just now';
  if (order.createdAt) {
    try {
      const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + date.toLocaleDateString() + ')';
    } catch (e) {
      formattedTime = 'Just now';
    }
  }

  const handleAccept = () => {
    if (onUpdateStatus) {
      onUpdateStatus(order, 'Preparing');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ type: 'spring', stiffness: 500, damping: 33 }}
        className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modern Header Alert Accent with active status banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white text-center relative shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-5 right-5 w-9 h-9 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center transition-all active:scale-95 text-white"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-2xl mb-2.5">
            <ShoppingBag className="w-6 h-6 text-white animate-bounce" />
          </div>
          <h3 className="text-lg font-black tracking-tight uppercase leading-none">Order Details</h3>
          <p className="text-[9px] text-emerald-100 font-extrabold uppercase tracking-widest mt-1.5">ID: #{order.id?.slice(-8).toUpperCase() || 'NEW'}</p>
        </div>

        {/* Modal Scrollable Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Customer Metadata */}
          <div className="bg-gray-50/75 p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Customer</p>
              <h4 className="text-base font-black text-slate-850 mt-1">{order.customerName}</h4>
              <p className="text-[10px] text-gray-500 font-extrabold flex items-center mt-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600 mr-1.5" /> +91 {order.phone}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-650 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm">
              {order.customerName ? order.customerName.charAt(0).toUpperCase() : '👤'}
            </div>
          </div>

          {/* Time & Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50/75 p-4 rounded-2xl border border-gray-100">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <Clock className="w-3 h-3 text-emerald-600 mr-1 shrink-0" /> Order Time
              </span>
              <p className="text-[11px] font-black text-gray-700 uppercase mt-1.5 leading-snug">{formattedTime}</p>
            </div>

            <div className="bg-gray-50/75 p-4 rounded-2xl border border-gray-100">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <CreditCard className="w-3 h-3 text-emerald-600 mr-1 shrink-0" /> Payment Route
              </span>
              <p className="text-[11px] font-black text-emerald-700 uppercase mt-1.5 italic leading-snug">UPI / Pay on Delivery</p>
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ordered Products</span>
              <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                {order.items?.length || 0} Items
              </span>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100/80 p-4 space-y-3.5 shadow-sm">
              {(() => {
                let parsedItems = order.items;
                if (typeof parsedItems === 'string') {
                  try { parsedItems = JSON.parse(parsedItems); } catch(e) { parsedItems = []; }
                }
                if (!Array.isArray(parsedItems)) parsedItems = [];

                let parsedFullItems = order.fullItems;
                if (typeof parsedFullItems === 'string') {
                  try { parsedFullItems = JSON.parse(parsedFullItems); } catch(e) { parsedFullItems = []; }
                }
                if (!Array.isArray(parsedFullItems)) parsedFullItems = [];

                const orderItemsList = parsedItems.length > 0 && typeof parsedItems[0] === 'object' ? parsedItems : parsedFullItems;
                
                return orderItemsList.length > 0 ? (
                orderItemsList.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <div>
                        <p className="font-extrabold text-slate-950 uppercase">{item.name}</p>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                            Qty: {item.quantity} × ₹{item.price}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="font-black text-slate-950">₹{item.price * item.quantity}</span>
                  </div>
                ))
              ) : (
                parsedItems.map((item: any, idx: number) => typeof item === 'string' && (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <p className="font-extrabold text-gray-800 uppercase">{item}</p>
                    </div>
                    <span className="font-bold text-gray-400 uppercase text-[9px]">1 Unit</span>
                  </div>
                ))
              );
              })()}

              <div className="border-t border-dashed border-gray-100 pt-3.5 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Total Amount Paid</span>
                <span className="text-lg font-black text-emerald-600">₹{order.finalAmount || order.amount || (Number(order.totalAmount || 0) + Number(order.deliveryCharge || 0))}</span>
              </div>
            </div>
          </div>

          {/* Delivery Location Info */}
          <div className="space-y-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Delivery Destination</span>
            <div className="bg-amber-50/40 p-4 rounded-[2rem] border border-amber-100/50 flex space-x-3 items-start">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-amber-850 uppercase tracking-wider leading-none">Grezto Express Node</p>
                <p className="text-[11px] text-amber-900/90 font-bold mt-1.5 leading-relaxed">{typeof order.address === 'object' ? (order.address?.address || JSON.stringify(order.address)) : order.address}</p>
              </div>
            </div>
          </div>

          {/* Live GPS Map section placeholder */}
          {order.lat && order.lng && (
            <div className="space-y-2 text-left">
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                ACTIVE DESTINATION TELEMETRY
              </span>
              <div className="w-full bg-slate-950 rounded-2xl p-5 border border-slate-800 text-center relative overflow-hidden shadow-sm flex flex-col items-center justify-center">
                {/* Visual Radar Pulse background */}
                <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                  <div className="w-[150px] h-[150px] border border-rose-500 rounded-full animate-ping" />
                  <div className="w-[100px] h-[100px] border border-rose-500 rounded-full" />
                </div>
                
                <MapPin className="w-5 h-5 text-rose-500 animate-bounce mb-1.5 z-10" />
                <span className="text-[9px] font-black uppercase text-rose-400 tracking-widest z-10">GPS Location Coordinates Loaded</span>
                <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mt-1 px-3 z-10 leading-normal">
                  Kawarhagi Region delivery area coordinates verified. Open full map view to track navigation directions.
                </p>
                <div className="mt-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1 text-[9px] font-mono text-rose-300 font-bold uppercase tracking-widest z-10">
                  {Number(order.lat).toFixed(6)}° N, {Number(order.lng).toFixed(6)}° E
                </div>
              </div>
              <div className="flex justify-between items-center px-1 font-mono text-[8.5px] text-gray-500 font-semibold uppercase tracking-wider">
                <span>Accuracy: ±4 meters</span>
                <button 
                  onClick={() => {
                     window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`, '_system');
                  }}
                  className="text-emerald-600 uppercase hover:underline leading-none font-black border-0 bg-transparent cursor-pointer"
                >
                  Open in Google Maps ➔
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action button layout */}
        <div className="p-6 bg-gray-50 shrink-0 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4.5 bg-white border border-gray-250 rounded-2xl font-black text-[10px] uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-all active:scale-95"
          >
            Go Back
          </button>
          
          <button
            onClick={handleAccept}
            className="flex-[2] py-4.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center"
          >
            <span>Process Order</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
