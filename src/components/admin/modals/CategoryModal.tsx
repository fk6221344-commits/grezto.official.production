import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';

interface CategoryModalProps {
  showCategoryModal: boolean;
  setShowCategoryModal: (val: boolean) => void;
  editingCategory: any | null;
  setEditingCategory: (val: any | null) => void;
  newCat: any;
  setNewCat: React.Dispatch<React.SetStateAction<any>>;
  handleSaveCategory: () => Promise<any> | any;
}

export default function CategoryModal({
  showCategoryModal,
  setShowCategoryModal,
  editingCategory,
  setEditingCategory,
  newCat,
  setNewCat,
  handleSaveCategory
}: CategoryModalProps) {
  return (
    <AnimatePresence>
      {showCategoryModal && (
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
            className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] overflow-y-auto no-scrollbar relative font-sans text-left"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
              <button 
                type="button" 
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }} 
                className="p-2 bg-gray-100 rounded-full border-0 cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleSaveCategory(); }} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Category Name</label>
                  <input 
                    required
                    value={newCat.name || ''}
                    onChange={e => setNewCat({...newCat, name: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm transition"
                    placeholder="e.g. Fresh Fruits"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 flex items-center justify-between">
                    <span>Ultra HD Image URL</span>
                  </label>
                  <div className="relative group">
                    <input 
                      required
                      value={newCat.imageUrl || ''}
                      onChange={e => setNewCat({...newCat, imageUrl: e.target.value})}
                      className="w-full bg-gray-50 p-4 pr-12 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm text-gray-600 truncate transition"
                      placeholder="https://..."
                    />
                    <div className="absolute right-3 mx-auto top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none group-focus-within:animate-pulse">
                      <Camera className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Background Color (Tailwind)</label>
                  <select 
                    value={newCat.bgColor || 'bg-emerald-50'}
                    onChange={e => setNewCat({...newCat, bgColor: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm transition appearance-none"
                  >
                    <option value="bg-emerald-50">Emerald</option>
                    <option value="bg-yellow-50">Yellow</option>
                    <option value="bg-orange-50">Orange</option>
                    <option value="bg-blue-50">Blue</option>
                    <option value="bg-red-50">Red</option>
                    <option value="bg-purple-50">Purple</option>
                    <option value="bg-indigo-50">Indigo</option>
                    <option value="bg-pink-50">Pink</option>
                    <option value="bg-lime-50">Lime</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-5 rounded-[2rem] text-white font-bold uppercase tracking-widest shadow-xl shadow-emerald-100 transition-colors border-0 cursor-pointer">
                {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
