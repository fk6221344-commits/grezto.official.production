import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';

interface MerchantAddMenuModalProps {
  showAddMenuModal: boolean;
  setShowAddMenuModal: (show: boolean) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  newItem: any;
  setNewItem: (item: any) => void;
  handleSaveMenuItem: (e: React.FormEvent) => Promise<void>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isSaving: boolean;
  isUploadingImage: boolean;
}

export function MerchantAddMenuModal({
  showAddMenuModal,
  setShowAddMenuModal,
  editingItem,
  setEditingItem,
  newItem,
  setNewItem,
  handleSaveMenuItem,
  handleImageUpload,
  isSaving,
  isUploadingImage
}: MerchantAddMenuModalProps) {
  if (!showAddMenuModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setShowAddMenuModal(false);
            setEditingItem(null);
          }}
          className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-sm rounded-[2rem] p-6 relative z-10 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh]"
        >
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              {editingItem ? 'Edit Dish details' : 'Add New Dish to Menu'}
            </h3>
            <button 
              onClick={() => {
                setShowAddMenuModal(false);
                setEditingItem(null);
              }}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-0 rounded-xl cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSaveMenuItem} className="space-y-3.5 text-xs text-left">
            <div className="space-y-1">
              <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Dish / Product Name</label>
              <input 
                type="text" 
                value={newItem.name || ''}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                placeholder="e.g. Garlic butter Naan, Chicken Biryani"
                className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Price (₹)</label>
                <input 
                  type="number" 
                  value={newItem.price || ''}
                  onChange={e => setNewItem({...newItem, price: e.target.value})}
                  placeholder="e.g. 120"
                  className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none focus:border-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Unit quantity</label>
                <input 
                  type="text" 
                  value={newItem.unit || ''}
                  onChange={e => setNewItem({...newItem, unit: e.target.value})}
                  placeholder="e.g. 1 serving, plate"
                  className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none focus:border-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Category</label>
                <select 
                  value={newItem.category || ''}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                  className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none focus:border-slate-800"
                >
                  <option value="" disabled>None</option>
                  {/* Standard Categories */}
                  <option value="Vegetables">Vegetables 🥦</option>
                  <option value="Grocery">Grocery 🍚</option>
                  <option value="Non-Veg">Non-Veg 🍗</option>
                  <option value="Cold Drinks">Cold Drinks 🥤</option>
                  <option value="Clothes">Clothes 👕</option>
                  <option value="Cake">Cake / Bakery 🎂</option>
                  <option value="Fast Food">Fast Food 🍔</option>
                  <option value="Medicine">Medicine 💊</option>
                  <option value="Fruits">Fruits 🍎</option>
                  
                  <option value="Others">Others / Packaged 🍿</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Initial Stock</label>
                <input 
                  type="number" 
                  value={newItem.stock === undefined ? '' : newItem.stock}
                  onChange={e => setNewItem({...newItem, stock: e.target.value === '' ? '' : Number(e.target.value)})}
                  placeholder="Available stock"
                  className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-rose-500 uppercase tracking-wider block">Discount Offer (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="99"
                  value={newItem.discount === undefined ? (newItem.discount_percentage === undefined ? '' : newItem.discount_percentage) : newItem.discount}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setNewItem({...newItem, discount: val, discount_percentage: val});
                  }}
                  placeholder="e.g. 10 (-10% badge)"
                  className="w-full bg-rose-50/50 border border-rose-200 rounded-xl p-3 font-bold text-rose-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Dish Photo / Picture</label>
              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 p-2 text-left rounded-2xl">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col items-center justify-center cursor-pointer shrink-0">
                  {newItem.imageUrl ? (
                    <img src={newItem.imageUrl || undefined} className="w-full h-full object-cover" alt="Preview Image" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span className="text-[7.5px] font-black uppercase">Upload</span>
                    </div>
                  )}
                  {isUploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mb-1" />
                      <span className="text-[6.5px] font-black uppercase tracking-wider">Uploading</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/jpg" 
                    onChange={handleImageUpload} 
                    disabled={isUploadingImage || isSaving}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Or Paste Web Image Link</span>
                  <input 
                    type="text" 
                    value={newItem.imageUrl || ''}
                    disabled={isUploadingImage || isSaving}
                    onChange={e => setNewItem({...newItem, imageUrl: e.target.value})}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[9px] font-semibold focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Brief Description</label>
              <textarea 
                value={newItem.description || ''}
                disabled={isSaving}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                placeholder="Describe organic ingredients, prep style, taste profiles..."
                className="w-full bg-slate-50 border rounded-xl p-3 font-semibold focus:outline-none focus:border-slate-800 h-16 resize-none disabled:opacity-60"
              />
            </div>

            <button 
              type="submit"
              disabled={!newItem.category || isSaving || isUploadingImage}
              className={`w-full font-black text-[10px] tracking-widest uppercase py-3.5 rounded-xl border-0 shadow-md cursor-pointer mt-2 transition-all flex items-center justify-center space-x-2 ${
                newItem.category && !isSaving && !isUploadingImage
                  ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-white" />
                  <span>Publishing... 🥦⏳</span>
                </>
              ) : isUploadingImage ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-white" />
                  <span>Uploading Image... ⏳</span>
                </>
              ) : editingItem ? (
                'Save Updates'
              ) : (
                'Publish Dish to Live Menu'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
