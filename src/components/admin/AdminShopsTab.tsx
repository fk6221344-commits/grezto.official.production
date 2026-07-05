import React, { useMemo } from 'react';
import { Plus, Unlock, Ban, Trash2, Phone } from 'lucide-react';

interface AdminShopsTabProps {
  shops: any[];
  setEditingShop: (shop: any | null) => void;
  setNewShop: (shop: any) => void;
  setShowAddShopModal: (val: boolean) => void;
  setConfirmModal: (modalState: any) => void;
}

export default function AdminShopsTab({
  shops,
  setEditingShop,
  setNewShop,
  setShowAddShopModal,
  setConfirmModal,
}: AdminShopsTabProps) {

  const shopsListMemo = useMemo(() => {
    if (shops.length === 0) {
      return (
        <div className="text-center py-20 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
          No shops registered yet
        </div>
      );
    }

    return shops.map((shop: any) => (
      <div 
        key={shop.id}
        className="bg-white p-4.5 rounded-[2rem] border border-gray-100 shadow-sm space-y-3 hover:shadow-md transition-shadow relative overflow-hidden text-left"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-rose-50 rounded-2xl flex items-center justify-center text-lg shadow-inner border border-rose-100/30 font-black text-rose-700">
              🏪
            </div>
            <div>
              <div className="flex items-center space-x-1.5 font-sans">
                <h4 className="font-bold text-gray-800 text-sm tracking-tight">{shop.name}</h4>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                  shop.status === 'blocked' 
                    ? 'bg-rose-50 text-rose-800 border-rose-100 border' 
                    : 'bg-emerald-50 text-emerald-800 border-emerald-100 border'
                }`}>
                  {shop.status === 'blocked' ? 'Blocked' : 'Active'}
                </span>
                {!!(shop.pinned === true || shop.pinned === 'true' || shop.pinned === 1 || shop.pinned === '1') && (
                  <span className="text-[8px] bg-indigo-50 text-indigo-800 border border-indigo-100 font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    Exclusive 🔒
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">
                Category: <span className="text-gray-600 font-bold">{shop.category || 'Swiggy Swifts'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setEditingShop(shop);
                setNewShop({
                  name: shop.name || '',
                  ownerPhone: shop.ownerPhone || '',
                  ownerName: shop.ownerName || '',
                  category: shop.category || '',
                  defaultCategory: shop.defaultCategory || '',
                  address: shop.address || '',
                  status: shop.status || 'active',
                  type: shop.type || 'grocery',
                  imageUrl: shop.image || shop.imageUrl || '',
                  rating: shop.rating || '1.0',
                  ratingCount: shop.ratingCount || 0,
                  lat: shop.lat || 26.1522,
                  lng: shop.lng || 91.7589,
                  pinned: !!(shop.pinned === true || shop.pinned === 'true' || shop.pinned === 1 || shop.pinned === '1')
                });
                setShowAddShopModal(true);
              }}
              className="p-2 text-gray-400 hover:text-amber-600 transition border-0 bg-transparent cursor-pointer"
              title="Edit Shop"
            >
              <Plus className="w-4 h-4 rotate-45 text-amber-500 hover:scale-105" />
            </button>
            <button
              onClick={() => {
                if (shop.status === 'blocked') {
                  setConfirmModal({
                    isOpen: true,
                    type: 'unblock',
                    shopId: shop.id,
                    shopName: shop.name,
                    currentStep: 1,
                    shopObj: shop
                  });
                } else {
                  setConfirmModal({
                    isOpen: true,
                    type: 'block',
                    shopId: shop.id,
                    shopName: shop.name,
                    currentStep: 1,
                    shopObj: shop
                  });
                }
              }}
              className={`p-2 transition border-0 bg-transparent cursor-pointer ${
                shop.status === 'blocked' ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-400 hover:text-rose-600'
              }`}
              title={shop.status === 'blocked' ? "Unblock Partner" : "Block Partner"}
            >
              {shop.status === 'blocked' ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setConfirmModal({
                isOpen: true,
                type: 'delete',
                shopId: shop.id,
                shopName: shop.name,
                currentStep: 1
              })}
              className="p-2 text-gray-400 hover:text-red-500 transition border-0 bg-transparent cursor-pointer"
              title="Delete Shop"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col text-[10px] bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50 space-y-1.5 font-sans">
          <div className="flex justify-between">
            <span className="text-gray-400 font-bold uppercase text-[8px]">Owner:</span>
            <span className="font-bold text-gray-700">{shop.ownerName} ({shop.ownerPhone})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-bold uppercase text-[8px]">Address:</span>
            <span className="font-semibold text-gray-500 text-right max-w-[200px] truncate">{shop.address || 'Kawarhagi'}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <a 
            href={`tel:${shop.ownerPhone}`}
            className="w-full py-2.5 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 border border-gray-100 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center transition flex items-center justify-center space-x-1.5 no-underline font-sans"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Owner</span>
          </a>
        </div>
      </div>
    ));
  }, [shops, setEditingShop, setNewShop, setShowAddShopModal, setConfirmModal]);

  return (
    <div className="space-y-4 animate-fade-in text-stone-850">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Partner Shops</h3>
        <button 
          onClick={() => {
            setEditingShop(null);
            setNewShop({
              name: '',
              ownerPhone: '',
              ownerName: '',
              category: '',
              defaultCategory: '',
              address: '',
              status: 'active',
              type: 'grocery',
              imageUrl: '',
              rating: '1.0',
              ratingCount: 0,
              lat: 26.1522,
              lng: 91.7589,
              pinned: false
            });
            setShowAddShopModal(true);
          }}
          className="bg-emerald-600 text-white p-2 rounded-xl flex items-center space-x-2 px-4 shadow-lg shadow-emerald-100 border-0 cursor-pointer font-sans text-xs active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase">Add Shop</span>
        </button>
      </div>
      {shopsListMemo}
    </div>
  );
}
