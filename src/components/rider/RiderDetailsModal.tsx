import React from 'react';
import { X, Phone, Store, MapPin, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RiderDetailsModalProps {
  selectedOrder: any | null;
  setSelectedOrder: (order: any | null) => void;
  shopsFeed?: any[];
}

export const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({
  selectedOrder,
  setSelectedOrder,
  shopsFeed = []
}) => {
  return (
    <AnimatePresence>
      {selectedOrder && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/40 backdrop-blur-xs">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="bg-white fixed inset-0 w-full h-full flex flex-col text-left overflow-hidden"
          >
            {/* Elegant Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={18} className="text-emerald-400" />
                <h3 className="text-[13px] font-black uppercase tracking-wider font-sans">Delivered Package Items</h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border-0 cursor-pointer transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Vertically full-screen scrollable container with grouped items */}
            <div className="py-4 px-0 flex-1 overflow-y-auto bg-slate-50/30">
              {(() => {
                const orderItemsList = selectedOrder.items || selectedOrder.fullItems || [];
                
                if (orderItemsList.length === 0) {
                  return (
                    <div className="flex items-start gap-2.5 bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl text-slate-700 mx-2">
                      <span className="text-sm mt-0.5">📦</span>
                      <p className="text-[11px] font-bold leading-normal font-sans">
                        {selectedOrder.items?.map((i: any) => typeof i === 'string' ? i : i.name).join(', ') || 'Standard Package Item'}
                      </p>
                    </div>
                  );
                }

                // Group items by shopId
                const groupedByShop: {
                  [shopId: string]: {
                    shopName: string;
                    shopAddress: string;
                    ownerPhone: string;
                    items: any[];
                    totalAmount: number;
                  }
                } = {};

                orderItemsList.forEach((item: any) => {
                  const sId = item.shopId || 'admin';
                  const matchedShop = shopsFeed.find((s: any) => String(s.id) === String(sId));
                  
                  let sName = matchedShop?.name || item.shopName;
                  if (!sName) {
                    sName = sId === 'admin' ? 'Grezto Central Hub (Admin Warehouse)' : 'Local Merchant Shop';
                  }

                  const sPhone = matchedShop?.ownerPhone || '';
                  const sAddress = matchedShop?.address || 'Assam Market Sector';

                  if (!groupedByShop[sId]) {
                    groupedByShop[sId] = {
                      shopName: sName,
                      shopAddress: sAddress,
                      ownerPhone: sPhone,
                      items: [],
                      totalAmount: 0
                    };
                  }

                  groupedByShop[sId].items.push(item);
                  groupedByShop[sId].totalAmount += (Number(item.price) || 0) * (Number(item.quantity) || 1);
                });

                return (
                  <div className="space-y-4 pb-16">
                    {Object.entries(groupedByShop).map(([shopId, group], index) => (
                      <div 
                        key={shopId} 
                        className="mx-2 bg-white border-2 border-slate-300 rounded-3xl p-5 text-left relative shadow-xs hover:border-slate-400 transition-all"
                      >
                        {/* Shop Header */}
                        <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-150">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Store size={14} className="text-emerald-600 shrink-0" />
                              <span className="text-[13.5px] font-black text-slate-900 font-sans tracking-tight leading-tight">
                                {group.shopName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              <MapPin size={11} className="shrink-0" />
                              <span className="text-[9.5px] font-bold tracking-wide font-sans truncate max-w-[240px]">
                                {group.shopAddress}
                              </span>
                            </div>
                          </div>

                          {/* Direct call icon to shopkeeper */}
                          {group.ownerPhone ? (
                            <a 
                              href={`tel:${group.ownerPhone}`}
                              onClick={(e) => {
                                console.log(`Rider calling shopkeeper at ${group.ownerPhone}`);
                              }}
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-full border border-emerald-150 cursor-pointer active:scale-90 transition-all flex items-center justify-center shrink-0 shadow-xs"
                              title={`Call Shop: ${group.ownerPhone}`}
                            >
                              <Phone size={14} fill="currentColor" strokeWidth={2} />
                            </a>
                          ) : (
                            <div className="p-2 bg-slate-100 text-slate-400 rounded-full border border-slate-200 cursor-not-allowed flex items-center justify-center shrink-0">
                              <Phone size={14} strokeWidth={2} />
                            </div>
                          )}
                        </div>

                        {/* Items under this shop */}
                        <div className="mt-3.5 space-y-3.5">
                          {group.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-left">
                              <div className="flex items-center gap-2.5">
                                <p className="text-[15.5px] font-black text-slate-900 font-sans leading-tight">
                                  {item.name}
                                </p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                                  Qty: {item.quantity}
                                </span>
                              </div>
                              <span className="text-[14px] font-black text-slate-950 font-display">
                                ₹{(Number(item.price) || 0) * (Number(item.quantity) || 1)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Shop Subtotal Banner */}
                        <div className="mt-4 pt-3 border-t border-dashed border-slate-150 flex justify-between items-center">
                          <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-sans">Shop Subtotal</span>
                          <span className="text-[13px] font-black text-slate-950 font-display">
                            ₹{group.totalAmount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Total Bill Section with clear delivery charge breakdown & ultra-high contrast for outdoor sunlight */}
            <div className="px-3.5 pb-6 pt-3 border-t border-slate-200 bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.04)] shrink-0 space-y-1.5">
              <div className="flex justify-between items-center bg-blue-50 border border-blue-300 py-2.5 px-4 rounded-xl shadow-xs">
                <span className="font-bold text-[12px] uppercase tracking-wider text-blue-950 font-sans antialiased">
                  Total Items Price:
                </span>
                <span className="font-sans font-extrabold text-[15px] text-blue-950 antialiased">
                  ₹{selectedOrder.totalAmount || selectedOrder.amount}
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-amber-50 border border-amber-300 py-2.5 px-4 rounded-xl shadow-xs">
                <span className="font-bold text-[12px] uppercase tracking-wider text-amber-950 font-sans antialiased">
                  Delivery Charge:
                </span>
                <span className="font-sans font-extrabold text-[15px] text-amber-950 antialiased">
                  ₹{selectedOrder.deliveryCharge || 0}
                </span>
              </div>
              
              <div className="h-px bg-slate-200 my-1" />
              
              {/* Premium Dark Green Grand Total Card */}
              <div className="bg-emerald-950 text-white py-3 px-4 rounded-xl flex justify-between items-center shadow-md border-2 border-emerald-800">
                <span className="text-[12px] font-extrabold uppercase tracking-widest font-sans text-white antialiased">
                  Grand Total Bill:
                </span>
                <span className="text-[20px] font-black font-sans text-white tracking-tight antialiased">
                  ₹{selectedOrder.finalAmount || (Number(selectedOrder.totalAmount || selectedOrder.amount || 0) + Number(selectedOrder.deliveryCharge || 0))}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
