import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { prefetchImage } from '../../../utils/imagePrefetcher';

interface ShopModalProps {
  showAddShopModal: boolean;
  setShowAddShopModal: (val: boolean) => void;
  editingShop: any | null;
  newShop: any;
  setNewShop: React.Dispatch<React.SetStateAction<any>>;
  handleSaveShop: (e: React.FormEvent) => Promise<any> | any;
}

export default function ShopModal({
  showAddShopModal,
  setShowAddShopModal,
  editingShop,
  newShop,
  setNewShop,
  handleSaveShop
}: ShopModalProps) {
  const [docs, setDocs] = React.useState({
    pan: false,
    aadhar: false,
    agreement: false,
    tradeLic: false
  });

  React.useEffect(() => {
    const key = newShop.id || newShop.ownerPhone || 'temp';
    if (key) {
      try {
        const saved = localStorage.getItem(`shop_docs_${key}`);
        if (saved) {
          setDocs(JSON.parse(saved));
        } else {
          setDocs({ pan: false, aadhar: false, agreement: false, tradeLic: false });
        }
      } catch (e) {
        console.error("Failed to load shop docs state:", e);
      }
    }
  }, [newShop.id, newShop.ownerPhone, showAddShopModal]);

  const toggleDoc = (docKey: 'pan' | 'aadhar' | 'agreement' | 'tradeLic') => {
    const nextDocs = { ...docs, [docKey]: !docs[docKey] };
    setDocs(nextDocs);
    const key = newShop.id || newShop.ownerPhone || 'temp';
    try {
      localStorage.setItem(`shop_docs_${key}`, JSON.stringify(nextDocs));
    } catch (e) {
      console.error("Failed to save shop docs state:", e);
    }
  };

  return (
    <AnimatePresence>
      {showAddShopModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0"
        >
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 pb-12 space-y-5 shadow-2xl relative border-t border-gray-100/30 overflow-y-auto max-h-[90vh] font-sans text-left"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-105">
              <h3 className="font-black text-xs text-gray-800 uppercase tracking-widest">
                {editingShop ? "Edit Partner Shop" : "Add Partner Shop 🏪"}
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddShopModal(false)}
                className="bg-gray-105 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-xl px-3 py-1 text-xs font-black transition-colors flex items-center justify-center border-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShop} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Shop Name</label>
                <input 
                  type="text" 
                  required
                  value={newShop.name || ''}
                  onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                  placeholder="e.g. Grill Zone / Grand Hotel"
                  className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Owner Name</label>
                  <input 
                    type="text" 
                    required
                    value={newShop.ownerName || ''}
                    onChange={(e) => setNewShop({...newShop, ownerName: e.target.value})}
                    placeholder="e.g. Rajiv Patwari"
                    className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Owner Phone Number</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs border-r border-gray-200 pr-2">+91</div>
                      <input 
                        type="tel" 
                        required
                        maxLength={10}
                        value={newShop.ownerPhone || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setNewShop({...newShop, ownerPhone: val});
                        }}
                        placeholder="10-digit number"
                        className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 pl-12 pr-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification & Status Section */}
              <div className="flex items-end justify-between gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                {/* Left Side: Document Checklist */}
                <div className="flex-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block mb-2">
                    Onboarding Verification Documents
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'pan', label: 'PAN 🪪' },
                      { id: 'aadhar', label: 'Aadhar 👤' },
                      { id: 'agreement', label: 'Agreement 📄' },
                      { id: 'tradeLic', label: 'Trade Lic 📜' }
                    ].map((item) => {
                      const isChecked = docs[item.id as keyof typeof docs];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleDoc(item.id as any)}
                          className={`flex-1 flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all border cursor-pointer select-none ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 shadow-sm shadow-emerald-500/5'
                              : 'bg-white border-slate-200/60 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[7.5px] font-black uppercase tracking-tight mb-1 whitespace-nowrap">
                            {item.label}
                          </span>
                          <div className={`w-3.5 h-3.5 rounded-md flex items-center justify-center transition-all ${
                            isChecked 
                              ? 'bg-emerald-600 text-white scale-110' 
                              : 'bg-slate-50 border border-slate-200'
                          }`}>
                            {isChecked && (
                              <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Compact Status Dropdown */}
                <div className="space-y-1 shrink-0">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block text-right pr-1">
                    Status
                  </label>
                  <select 
                    value={newShop.status || 'active'}
                    onChange={(e) => setNewShop({...newShop, status: e.target.value as any})}
                    className="w-[95px] h-[34px] bg-white border border-slate-200/80 text-gray-700 py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer text-center"
                  >
                    <option value="active">Active 🟢</option>
                    <option value="blocked">Blocked 🔴</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Shop Address</label>
                <input 
                  type="text" 
                  required
                  value={newShop.address || ''}
                  onChange={(e) => setNewShop({...newShop, address: e.target.value})}
                  placeholder="e.g. Mitreno Tech Road, Kawarhagi"
                  className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Partner Type</label>
                  <select 
                    value={newShop.type || 'grocery'}
                    onChange={(e) => setNewShop({...newShop, type: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                  >
                    <option value="grocery">🥬 Grezto Market</option>
                    <option value="hotel">🍔 Premium Hotel (Zomato)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
                    {editingShop ? "Rating (Customer Driven ⭐)" : "Initial Rating"}
                  </label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="1" 
                    max="5"
                    required
                    disabled={!!editingShop}
                    value={newShop.rating || '1.0'}
                    onChange={(e) => setNewShop({...newShop, rating: e.target.value})}
                    className={`w-full border py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 ${
                      editingShop 
                        ? 'bg-gray-150 border-gray-200 text-gray-400 cursor-not-allowed font-medium' 
                        : 'bg-gray-50 border-gray-100 text-gray-700'
                    }`}
                  />
                </div>
              </div>

              {/* Category Dropdown and Smaller Shrunk Pin Toggle Side-by-Side */}
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* Product Category Option */}
                <div className="col-span-7 space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Category</label>
                  <select 
                    value={newShop.defaultCategory || ''}
                    onChange={(e) => {
                      const dCat = e.target.value;
                      let sCat = '';
                      if (dCat === 'Vegetables' || dCat === 'Grocery') sCat = 'Groceries & Vegetables';
                      else if (dCat === 'Fast Food' || dCat === 'Non-Veg') sCat = 'Fast Food';
                      else if (dCat === 'Cold Drinks') sCat = 'Juice & Beverages';
                      else if (dCat === 'Cake') sCat = 'Bakery / Sweets';
                      else if (dCat === 'Clothes') sCat = 'Clothes';
                      else if (dCat === 'Medicine') sCat = 'Groceries & Vegetables';
                      else sCat = dCat || '';

                      setNewShop({
                        ...newShop,
                        defaultCategory: dCat,
                        category: sCat
                      });
                    }}
                    className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3.5 px-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                  >
                    <option value="">None 🚫</option>
                    <option value="Vegetables">Vegetables 🥬</option>
                    <option value="Grocery">Grocery 🛒</option>
                    <option value="Non-Veg">Non-Veg 🍗</option>
                    <option value="Cold Drinks">Cold Drinks 🥤</option>
                    <option value="Clothes">Clothes 👕</option>
                    <option value="Cake">Cake 🍰</option>
                    <option value="Fast Food">Fast Food 🍔</option>
                    <option value="Medicine">Medicine 💊</option>
                  </select>
                </div>

                {/* Shrunk Pinned Toggle to the right of Category */}
                <div className="col-span-5 bg-indigo-50/40 border border-indigo-100/50 p-2.5 rounded-xl flex items-center justify-between select-none font-sans h-[46px]">
                  <div className="text-left leading-3">
                    <span className="text-[8px] font-black text-indigo-750 uppercase tracking-widest block leading-3">Exclusive Shop 🔒</span>
                    <span className="text-[7.5px] text-indigo-950/60 font-bold block leading-none mt-0.5">Solo Order</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewShop({...newShop, pinned: !newShop.pinned})}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      newShop.pinned ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        newShop.pinned ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">Shop Banner Photo URL</label>
                  <button
                    type="button"
                    onClick={() => {
                      const presets: {[key: string]: string} = {
                        "Fast Food": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800",
                        "Restaurant / Main Meals": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800",
                        "Bakery / Sweets": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=800",
                        "Juice & Beverages": "https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=800",
                        "Groceries & Vegetables": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800"
                      };
                      const selectedUrl = presets[newShop.category] || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800";
                      setNewShop({...newShop, imageUrl: selectedUrl});
                      prefetchImage(selectedUrl);
                    }}
                    className="text-[8px] font-black text-emerald-600 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:underline"
                  >
                    ⚡ Auto-Fill Banner
                  </button>
                </div>
                <input 
                  type="url" 
                  value={newShop.imageUrl || ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    setNewShop({...newShop, imageUrl: url});
                    if (url && url.startsWith('http')) {
                      prefetchImage(url);
                    }
                  }}
                  placeholder="Provide image link or tap auto-fill above"
                  className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-2 font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block leading-3">Partner Coordinates (GPS)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const randLat = 26.1522 + (Math.random() - 0.5) * 0.04;
                      const randLng = 91.7602 + (Math.random() - 0.5) * 0.04;
                      setNewShop({
                        ...newShop,
                        lat: parseFloat(randLat.toFixed(5)),
                        lng: parseFloat(randLng.toFixed(5))
                      });
                    }}
                    className="text-[8.5px] font-black text-purple-700 uppercase tracking-wider bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border-0 cursor-pointer"
                  >
                    📍 Generate Random GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Latitude</label>
                    <input 
                      type="number" 
                      step="0.00001"
                      required
                      value={newShop.lat === undefined || isNaN(newShop.lat as any) || newShop.lat === '' as any ? '' : newShop.lat}
                      onChange={(e) => setNewShop({...newShop, lat: e.target.value === '' ? '' as any : parseFloat(e.target.value)})}
                      className="w-full bg-white border border-gray-150 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Longitude</label>
                    <input 
                      type="number" 
                      step="0.00001"
                      required
                      value={newShop.lng === undefined || isNaN(newShop.lng as any) || newShop.lng === '' as any ? '' : newShop.lng}
                      onChange={(e) => setNewShop({...newShop, lng: e.target.value === '' ? '' as any : parseFloat(e.target.value)})}
                      className="w-full bg-white border border-gray-150 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

               <button 
                type="submit"
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg cursor-pointer mt-2 border-0 flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100/50`}
              >
                {editingShop ? "Update Shop Details" : "REGISTER PARTNER SHOP"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
