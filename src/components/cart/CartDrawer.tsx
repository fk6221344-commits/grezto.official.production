import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, Truck, MapPin, Pencil } from 'lucide-react';

// 1. Individual Cart Item Row Component (Item Slide)
interface CartItemRowProps {
  item: any;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white p-2.5 px-3.5 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm gap-3"
      id={`cart-item-${item.id}`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
          {(item.imageUrl && item.imageUrl !== "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=") ? (
            <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center border-dashed border-gray-300">
               <span className="text-[8px] font-bold text-gray-400 uppercase">Image</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <h4 className="font-bold text-gray-800 text-[11px] leading-tight line-clamp-1">{item.name}</h4>
          <p className="text-[9px] text-gray-400 font-bold mt-0.5 uppercase tracking-tight">₹{item.price} / unit</p>
          <div className="text-[10px] font-extrabold text-emerald-600 mt-0.5">₹{item.price * item.quantity}</div>
        </div>
      </div>

      {/* Compact Inline Actions */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <div className="flex items-center bg-gray-50/80 rounded-lg p-0.5 border border-gray-100">
          <button 
            onClick={() => onUpdateQuantity(item.id, -1)} 
            className="p-1 px-1.5 text-gray-400 hover:text-emerald-500 transition-colors bg-transparent border-0 cursor-pointer focus:outline-none"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="text-[10px] font-black text-gray-800 px-1 min-w-[12px] text-center select-none">{item.quantity}</span>
          <button 
            onClick={() => onUpdateQuantity(item.id, 1)} 
            className="p-1 px-1.5 text-gray-400 hover:text-emerald-500 transition-colors bg-transparent border-0 cursor-pointer focus:outline-none"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
        <button 
          onClick={() => onRemove(item.id)}
          className="p-1 text-gray-300 hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// 2. Cart Calculation Overlay Component (Used in Checkout & Cart views)
interface CartCalculationOverlayProps {
  subtotal: number;
  deliveryFee: number;
  total: number;
  isMultiShop?: boolean;
  isFirstOrder?: boolean;
}

export function CartCalculationOverlay({
  subtotal,
  deliveryFee,
  total,
  isMultiShop = false,
  isFirstOrder = false
}: CartCalculationOverlayProps) {
  return (
    <div className="bg-white border border-stone-150 rounded-[16px] p-3 shadow-[0_1px_6px_rgba(0,0,0,0.01)] space-y-2.5">
      {/* Subtotal Row */}
      <div className="flex justify-between items-center text-stone-600 tracking-wider">
        <span className="flex items-center gap-2 text-[9.5px] font-black uppercase">
          <ShoppingBag className="w-3.5 h-3.5 text-[#0e9f6e]" />
          <span>Items Subtotal</span>
        </span>
        <span className="text-[13px] font-black text-stone-800 font-sans">
          ₹{subtotal}
        </span>
      </div>

      {/* Delivery Charges Row */}
      <div className="pt-2 flex flex-col gap-1">
        <div className="flex justify-between items-center text-stone-600 tracking-wider">
          <span className="flex items-center gap-2 text-[9.5px] font-black uppercase">
            <Truck className="w-3.5 h-3.5 text-[#0e9f6e]" />
            <span>Delivery Charges</span>
          </span>
          <span className={`text-[13px] font-black font-sans ${isFirstOrder && deliveryFee === 0 ? 'text-[#10b981] drop-shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse tracking-widest text-[14px]' : 'text-[#0e9f6e]'}`}>
            {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
          </span>
        </div>
        {deliveryFee > 0 && isMultiShop && (
          <div className="flex justify-between items-center text-[8.5px] font-black text-rose-600 uppercase tracking-widest pl-5.5 animate-pulse">
            <span>✨ Multi-Shop Surcharge Added</span>
            <span>Capped at ₹35</span>
          </div>
        )}
      </div>

      {/* Payable Amount Row */}
      <div className="flex justify-between items-center text-stone-600 tracking-wider border-t border-stone-100 pt-2 mt-2">
        <span className="flex items-center gap-2 text-[9.5px] font-black uppercase">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0e9f6e] ml-0.5 mr-0.5" />
          <span>Payable Amount</span>
        </span>
        <span className="text-[14px] font-black text-stone-900 font-sans">
          ₹{total}
        </span>
      </div>
    </div>
  );
}

// 3. Address Confirmation Sheet Component (Renders the beautiful address confirmation form / sheet)
interface AddressConfirmationSheetProps {
  nameVal: string;
  areaVal: string;
  cityVal: string;
  lat: number;
  lng: number;
  onEdit: () => void;
}

export function AddressConfirmationSheet({
  nameVal,
  areaVal,
  cityVal,
  lat,
  lng,
  onEdit
}: AddressConfirmationSheetProps) {
  return (
    <div className="bg-white rounded-[16px] border border-stone-200/90 border-l-[5px] border-l-[#0b7a2d] p-2.5 shadow-sm flex items-start justify-between min-w-0 w-full" id="premium-address-card">
      <div className="flex flex-col min-w-0 items-start text-left">
        {/* Category Badge & Name Row */}
        <div className="flex items-center gap-1.5 flex-wrap" id="premium-address-header">
          <span className="bg-[#e2f3e7] text-[#0b7a2d] text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full leading-none" id="premium-address-badge">
            HOME
          </span>
          <span className="text-[12.5px] font-black text-stone-900 leading-none" id="premium-address-name">
            {nameVal}
          </span>
        </div>
        
        {/* Detailed Addresses */}
        <div className="text-[10.5px] tracking-tight leading-normal mt-0.5 flex flex-col gap-0.5" id="premium-address-details">
          <span className="font-black text-stone-800" id="premium-address-area">
            {areaVal}
          </span>
          <span className="text-stone-500 text-[9.5px] font-bold" id="premium-address-city">
            {cityVal}
          </span>
        </div>

        {/* High-fidelity GPS Coordinate Pill */}
        <div className="mt-1.5 px-2 py-0.5 bg-blue-50/75 rounded-md border border-blue-100 flex items-center gap-1 self-start shadow-3xs" id="premium-address-gps-pill">
          <span className="text-[#1d4ed8] text-[9px] font-black tracking-wide uppercase font-mono" id="premium-address-gps-text">
            GPS: {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Aesthetic White Edit button */}
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 bg-white border border-stone-300 shadow-sm rounded-full text-stone-700 hover:bg-stone-50 transition-all text-[9px] font-black px-2.5 py-1 active:scale-95 shrink-0 ml-4 cursor-pointer focus:outline-none"
        id="premium-address-edit-btn"
      >
        <Pencil className="w-3 h-3 text-stone-600" />
        <span>EDIT</span>
      </button>
    </div>
  );
}
