import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';

interface ProductModalProps {
  showAddModal: boolean;
  setShowAddModal: (val: boolean) => void;
  editingProduct: any | null;
  setEditingProduct: (val: any | null) => void;
  newProduct: any;
  setNewProduct: React.Dispatch<React.SetStateAction<any>>;
  handleAddProduct: (e: React.FormEvent) => Promise<any> | any;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: any) => Promise<any> | any;
  shops: any[];
}

export default function ProductModal({
  showAddModal,
  setShowAddModal,
  editingProduct,
  setEditingProduct,
  newProduct,
  setNewProduct,
  handleAddProduct,
  handleImageUpload,
  shops
}: ProductModalProps) {
  return (
    <AnimatePresence>
      {showAddModal && (
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
            className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] overflow-y-auto no-scrollbar font-sans text-left"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
              <button 
                type="button" 
                onClick={() => { setShowAddModal(false); setEditingProduct(null); }} 
                className="p-2 bg-gray-100 rounded-full border-0 cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-6">
              <div className="space-y-4 mb-6">
                {newProduct.category === 'Clothes' ? (
                  <>
                    <div className="text-center">
                      <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest bg-purple-50 px-2.5 py-1 rounded-md">Clothes Category Mode (5 Photos)</span>
                      <p className="text-[8px] text-gray-400 uppercase tracking-wider mt-1">Upload front view, back view, and angles in ultra HD</p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 justify-center">
                      {[
                        { key: 'imageUrl' as const, label: 'Primary', target: 'product' as const },
                        { key: 'imageUrl2' as const, label: 'Photo 2', target: 'product2' as const },
                        { key: 'imageUrl3' as const, label: 'Photo 3', target: 'product3' as const },
                        { key: 'imageUrl4' as const, label: 'Photo 4', target: 'product4' as const },
                        { key: 'imageUrl5' as const, label: 'Photo 5', target: 'product5' as const },
                      ].map((slot) => {
                        const val = (newProduct as any)[slot.key];
                        return (
                          <div key={slot.key} className="w-[82px] flex flex-col items-center bg-gray-50/70 p-1.5 rounded-xl border border-gray-100">
                            <div className="relative w-14 h-14 bg-gray-100 rounded-lg overflow-hidden group border border-dashed border-gray-200 shadow-inner flex items-center justify-center">
                              {val ? (
                                <>
                                  <img src={val || undefined} className="w-full h-full object-cover" alt="Preview" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setNewProduct(prev => ({ ...prev, [slot.key]: '' }));
                                    }}
                                    className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-650 p-0.5 rounded-full text-white shadow-md transition-all z-10 hover:scale-110 active:scale-95 border-0 cursor-pointer"
                                    title="Remove image"
                                  >
                                    <X className="w-2.5 h-2.5 stroke-[4]" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                    <Camera className="w-4 h-4 mb-0.5 text-gray-400" />
                                    <span className="text-[6.5px] font-black uppercase tracking-tight text-center">{slot.label}</span>
                                  </div>
                                  <input 
                                    type="file" 
                                    accept="image/png, image/jpeg, image/jpg" 
                                    onChange={(e) => handleImageUpload(e, slot.target)}
                                    className="absolute inset-0 opacity-0 cursor-pointer text-[0px]" 
                                  />
                                </>
                              )}
                            </div>
                            
                            <input 
                              type="text"
                              value={val || ''}
                              onChange={e => setNewProduct(prev => ({ ...prev, [slot.key]: e.target.value }))}
                              placeholder="Paste URL"
                              className="w-full bg-white mt-1 px-1 py-0.5 rounded-md text-[7.5px] outline-none border border-gray-150 font-bold text-gray-500 text-center placeholder-gray-300"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Product Photo (Ultra HD)</span>
                      <p className="text-[8px] text-gray-400 uppercase tracking-wider mt-0.5">Upload single ultra-high HD product photo</p>
                    </div>

                    <div className="flex justify-center">
                      {(() => {
                        const val = newProduct.imageUrl;
                        return (
                          <div className="w-full max-w-[200px] flex flex-col items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                            <div className="relative w-28 h-28 bg-gray-100 rounded-xl overflow-hidden group border border-dashed border-gray-200 shadow-inner flex items-center justify-center">
                              {val ? (
                                <>
                                  <img src={val || undefined} className="w-full h-full object-cover" alt="Preview" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setNewProduct(prev => ({ ...prev, imageUrl: '' }));
                                    }}
                                    className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-650 p-1 rounded-full text-white shadow-md transition-all z-10 hover:scale-110 active:scale-95 border-0 cursor-pointer"
                                    title="Remove image"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[4]" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                    <Camera className="w-6 h-6 mb-1 text-gray-400" />
                                    <span className="text-[8px] font-black uppercase tracking-tight">Upload Photo</span>
                                  </div>
                                  <input 
                                    type="file" 
                                    accept="image/png, image/jpeg, image/jpg" 
                                    onChange={(e) => handleImageUpload(e, 'product')}
                                    className="absolute inset-0 opacity-0 cursor-pointer text-[0px]" 
                                  />
                                </>
                              )}
                            </div>
                            
                            <input 
                              type="text"
                              value={val || ''}
                              onChange={e => setNewProduct(prev => ({ ...prev, imageUrl: e.target.value }))}
                              placeholder="Or paste image URL"
                              className="w-full bg-white mt-2 px-2 py-1 placeholder-gray-400 rounded-lg text-[9px] outline-none border border-gray-150 font-bold text-gray-500 text-center"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Name</label>
                  <input 
                    required
                    value={newProduct.name || ''}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm" 
                    placeholder="e.g. Fresh Tomato"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Price (₹)</label>
                  <input 
                    required
                    type="number"
                    value={newProduct.price || ''}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm" 
                    placeholder="40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Category</label>
                  <select 
                    value={newProduct.category || ''}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                  >
                    <option value="" disabled>None</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Grocery">Grocery</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Cold Drinks">Cold Drinks</option>
                    <option value="Clothes">Clothes</option>
                    <option value="Cake">Cake</option>
                    <option value="Fast Food">Fast Food</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Weight / Unit</label>
                  <input 
                    required
                    value={newProduct.unit || ''}
                    onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    placeholder="e.g. 500g, 1kg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Description</label>
                <textarea 
                  value={newProduct.description || ''}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm h-24 resize-none" 
                  placeholder="Short description..."
                />
              </div>

              <button 
                type="submit" 
                disabled={!newProduct.category}
                className={`w-full py-5 rounded-[2rem] text-white font-bold uppercase tracking-widest shadow-xl border-0 cursor-pointer font-sans active:scale-[0.98] transition-all ${
                  newProduct.category ? 'bg-emerald-600 shadow-emerald-100' : 'bg-gray-300 shadow-none cursor-not-allowed'
                }`}
              >
                Save Product
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
