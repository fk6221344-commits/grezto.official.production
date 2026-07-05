import React from 'react';
import { Camera } from 'lucide-react';

interface MerchantSettingsTabProps {
  handleSaveShopSettings: (e: React.FormEvent) => Promise<any> | any;
  shopName: string;
  setShopName: (val: string) => void;
  shopCategory: string;
  setShopCategory: (val: string) => void;
  shopOwnerName: string;
  setShopOwnerName: (val: string) => void;
  shopAddress: string;
  setShopAddress: (val: string) => void;
  shopImageUrl: string;
  handleShopImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: string) => Promise<any> | any;
  shop: any;
}

export function MerchantSettingsTab({
  handleSaveShopSettings,
  shopName,
  setShopName,
  shopCategory,
  setShopCategory,
  shopOwnerName,
  setShopOwnerName,
  shopAddress,
  setShopAddress,
  shopImageUrl,
  handleShopImageUpload,
  shop
}: MerchantSettingsTabProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1.5">Configure Shop Parameters</h3>
        <p className="text-[10px] text-slate-400 font-medium">Bechne vale products & food delivery settings configured directly across customers</p>
      </div>

      <form onSubmit={handleSaveShopSettings} className="space-y-4">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Shop / Restaurant Name</label>
            <input 
              type="text" 
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-slate-800"
              placeholder="Enter Restaurant Name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Category / Food Specialty</label>
            <input 
              type="text" 
              value={shopCategory}
              onChange={e => setShopCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-slate-800"
              placeholder="Fast Food, Bakery, Fresh produce"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Owner Contact Name</label>
            <input 
              type="text" 
              value={shopOwnerName}
              onChange={e => setShopOwnerName(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-150 rounded-xl p-3 text-xs font-semibold text-slate-500"
              placeholder="Owner's Name"
              disabled
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Owner Mobile Number (SMS-Verified)</label>
            <input 
              type="text" 
              value={shop.ownerPhone}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-450 focus:outline-none"
              disabled
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Physical Shop Address</label>
          <textarea 
            value={shopAddress}
            onChange={e => setShopAddress(e.target.value)}
            className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-slate-800 h-20 resize-none"
            placeholder="Street Landmark, Area, Kawarhagi Pin Code"
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] tracking-widest uppercase py-4 rounded-xl cursor-pointer border-0 shadow-md"
        >
          Sync Profile to Database
        </button>
      </form>
    </div>
  );
}
