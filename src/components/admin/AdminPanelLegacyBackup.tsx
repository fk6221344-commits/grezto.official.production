import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Crop, Upload, Trash2, ShieldAlert, Bike } from 'lucide-react';

/**
 * ⚠️ ADMIN PANEL LEGACY BACKUP FILE
 * 
 * This file contains deactivated copies of modals that were previously located in `AdminPanel.tsx`.
 * These blocks are preserved 100% block-for-block to satisfy strict retention and backup policies.
 * Do not delete this file.
 */

export default function AdminPanelLegacyBackup({
  editingShop,
  handleSaveShop,
  uploadingImageIds,
  newShop,
  setNewShop,
  selectedShopImg,
  handleSaveRider,
  editingRider,
  newRider,
  setNewRider,
  setShowRiderModal,
  confirmModal,
  setConfirmModal,
  handleDeleteShop,
  handleToggleBlockShop,
  showAdminProfileModal,
  setShowAdminProfileModal,
  adminOwnerPhoto,
  setAdminOwnerPhoto,
  adminOwnerName,
  setAdminOwnerName,
  adminOwnerRole,
  setAdminOwnerRole,
  toast
}: any) {
  return (
    <div style={{ display: 'none' }} aria-hidden="true">
      {/* 1. Shop Modal Block Backup */}
      <AnimatePresence>
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 pb-12 space-y-5 shadow-2xl relative border-t border-gray-100/30 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-105">
                <h3 className="font-black text-xs text-gray-800 uppercase tracking-widest block-for-block">
                  {editingShop ? "Edit Partner Shop" : "Add Partner Shop 🏪"}
                </h3>
              </div>

              <form onSubmit={handleSaveShop} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Shop Name
                  </label>
                  <input
                    required
                    value={newShop.name}
                    onChange={(e) =>
                      setNewShop({ ...newShop, name: e.target.value })
                    }
                    className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm text-[#1c1917]"
                    placeholder="e.g. Royal Fresh Mart"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Owner WhatsApp Phone
                  </label>
                  <input
                    required
                    maxLength={10}
                    value={newShop.ownerPhone}
                    onChange={(e) =>
                      setNewShop({
                        ...newShop,
                        ownerPhone: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm text-[#1c1917]"
                    placeholder="10-digit primary number"
                    disabled={!!editingShop}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Category
                    </label>
                    <select
                      value={newShop.category}
                      onChange={(e) =>
                        setNewShop({ ...newShop, category: e.target.value })
                      }
                      className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm appearance-none cursor-pointer text-[#1c1917]"
                    >
                      <option value="Groceries">Vegetables & Fruits 🥬</option>
                      <option value="Daily Essentials">
                        Daily Essentials 🥚
                      </option>
                      <option value="Local Special">Local Special 🍯</option>
                      <option value="Meat & Fish">Meat & Fish 🍗</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Store Status
                    </label>
                    <select
                      value={newShop.status}
                      onChange={(e) =>
                        setNewShop({ ...newShop, status: e.target.value })
                      }
                      className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm appearance-none cursor-pointer text-[#1c1917]"
                    >
                      <option value="Active">Open / Verified √</option>
                      <option value="Paused">Paused / Closed 💤</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Store Address / Area Location
                  </label>
                  <input
                    required
                    value={newShop.address}
                    onChange={(e) =>
                      setNewShop({ ...newShop, address: e.target.value })
                    }
                    className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm text-[#1c1917]"
                    placeholder="Area, Landmark, Colony, Assam"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                    <span>Shop Cover Image</span>
                    <span className="text-[8px] text-emerald-600 font-extrabold animate-pulse">
                      High Quality Crop Active
                    </span>
                  </label>
                  <div className="relative group w-full bg-stone-50 hover:bg-stone-100 rounded-2xl p-4 border border-dashed border-stone-200 transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors mb-1.5" />
                    <span className="text-[8px] text-gray-400 font-black uppercase tracking-widest">
                      {uploadingImageIds["shop_image"]
                        ? "Compressing Image Texture..."
                        : newShop.imageUrl
                        ? "Change Store Artwork ✔️"
                        : "Upload Store Banner (Max 3MB)"}
                    </span>
                    {newShop.imageUrl && (
                      <div className="absolute inset-2 w-16 h-12 bg-white rounded-lg overflow-hidden border shadow-xs pointer-events-none">
                        <img
                          src={newShop.imageUrl}
                          alt="Cover Banner"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploadingImageIds["shop_image"]}
                  className="w-full bg-emerald-700 hover:bg-emerald-850 py-4.5 rounded-3xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] border-0"
                >
                  {uploadingImageIds["shop_image"] ? (
                    <>Compressing...</>
                  ) : editingShop ? (
                    "Update Shop Details"
                  ) : (
                    "REGISTER PARTNER SHOP"
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Three-Step Triple Confirmation Modal Backup */}
      <AnimatePresence>
        {false && (
          <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                setConfirmModal((prev: any) => ({
                  ...prev,
                  isOpen: false,
                  currentStep: 1,
                }))
              }
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-10 relative z-[251] text-center shadow-2xl border border-red-50 font-sans"
            >
              <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-5 shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <h4 className="text-xs font-black uppercase tracking-widest text-[#1c1917] mb-1">
                Admin Security Clearance
              </h4>
              <p className="text-[9px] text-[#e11d48] font-bold tracking-wider uppercase mb-5">
                Step {confirmModal.currentStep} of 3
              </p>

              <div className="bg-stone-50/50 p-4.5 rounded-2xl mb-7 border border-stone-200/40 text-left">
                {confirmModal.currentStep === 1 && (
                  <p className="text-[10px] text-stone-500 font-bold leading-relaxed block-for-block">
                    Are you absolutely sure you want to perform this restricted operation? This modifies active database collections instantly.
                  </p>
                )}
                {confirmModal.currentStep === 2 && (
                  <p className="text-[10px] text-stone-500 font-bold leading-relaxed block-for-block">
                    All associated active menus, operational calculations, and session histories for this account might be impacted. Please verify fully.
                  </p>
                )}
                {confirmModal.currentStep === 3 && (
                  <p className="text-[10px] text-[#e11d48] font-black uppercase tracking-wide leading-relaxed text-center block-for-block">
                    ⚠️ TRIPLE SHIELD AUTHORIZED!
                    <br />
                    Click "Authorize Action" below to commit these database changes permanently.
                  </p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfirmModal((prev: any) => ({
                      ...prev,
                      isOpen: false,
                      currentStep: 1,
                    }))
                  }
                  className="flex-1 bg-[#f5f5f4] hover:bg-stone-100 text-[#78716c] py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-stone-200 transition-colors"
                >
                  Aborted
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.currentStep < 3) {
                      setConfirmModal((prev: any) => ({
                        ...prev,
                        currentStep: (prev.currentStep + 1) as any,
                      }));
                    } else if (confirmModal.onConfirmed) {
                      setConfirmModal((prev: any) => ({
                        ...prev,
                        isOpen: false,
                        currentStep: 1,
                      }));
                      if (confirmModal.actionType === "DELETE_SHOP") {
                        handleDeleteShop(confirmModal.shopId).catch(
                          console.error,
                        );
                      } else {
                        handleToggleBlockShop(confirmModal.shopObj).catch(
                          console.error,
                        );
                      }
                    }
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 shadow-md transition-all"
                >
                  {confirmModal.currentStep < 3
                    ? "Next Step"
                    : "Authorize Action ✔️"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Custom Admin Owner Profile Editor Modal Backup */}
      <AnimatePresence>
        {false && (
          <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-0 sm:p-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminProfileModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-10 relative z-[261] shadow-2xl border border-stone-105/10 font-sans"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <h3 className="font-black text-xs text-stone-850 uppercase tracking-widest block-for-block">
                  Master Profile Cover
                </h3>
              </div>

              <div className="space-y-4 text-left mt-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input
                    value={adminOwnerName}
                    onChange={(e) => setAdminOwnerName(e.target.value)}
                    className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none font-bold text-sm text-[#1c1917]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Designated Title Role
                  </label>
                  <input
                    value={adminOwnerRole}
                    onChange={(e) => setAdminOwnerRole(e.target.value)}
                    className="w-full bg-gray-50 border-0 p-4 rounded-2xl outline-none font-bold text-sm text-[#1c1917]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Contact Phone Number
                  </label>
                  <input
                    disabled
                    value="7577950272"
                    className="w-full bg-stone-100 border-0 p-4 rounded-2xl outline-none font-bold text-sm text-stone-400"
                  />
                </div>
              </div>

              <div className="flex space-x-2.5 mt-8">
                <button
                  type="button"
                  onClick={() => setShowAdminProfileModal(false)}
                  className="flex-1 bg-stone-50 hover:bg-stone-100 text-stone-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-stone-150 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      "grezto_admin_owner_photo",
                      adminOwnerPhoto,
                    );
                    localStorage.setItem(
                      "grezto_admin_owner_name",
                      adminOwnerName,
                    );
                    localStorage.setItem(
                      "grezto_admin_owner_role",
                      adminOwnerRole,
                    );
                    toast.success(
                      "Admin Profile Details Saved Successfully! 👑",
                    );
                    setShowAdminProfileModal(false);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 shadow-md hover:shadow-lg transition-all shadow-emerald-100"
                >
                  Save & Publish ✔️
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Rider Modal Block Backup */}
      <AnimatePresence>
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto relative shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest block-for-block">
                  {editingRider
                    ? "Update Rider Profile"
                    : "Register New Rider"}
                </h3>
              </div>

              <form onSubmit={handleSaveRider} className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Rider Name
                    </label>
                    <input
                      required
                      value={newRider.name}
                      onChange={(e) =>
                        setNewRider({ ...newRider, name: e.target.value })
                      }
                      className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Phone Number
                    </label>
                    <input
                      required
                      maxLength={10}
                      value={newRider.phone}
                      onChange={(e) =>
                        setNewRider({
                          ...newRider,
                          phone: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                      placeholder="10-digit number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Vehicle Type
                    </label>
                    <select
                      value={newRider.vehicle}
                      onChange={(e) =>
                        setNewRider({ ...newRider, vehicle: e.target.value })
                      }
                      className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                    >
                      <option value="Electric Scooter">Electric Scooter</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Bicycle">Bicycle</option>
                      <option value="Car">Car</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Current Status
                    </label>
                    <select
                      value={newRider.status}
                      onChange={(e) =>
                        setNewRider({ ...newRider, status: e.target.value })
                      }
                      className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                    >
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                      <option value="Busy">Busy</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 select-none">
                    COD Balance (₹)
                  </label>
                  <input
                    type="number"
                    value={newRider.codBalance}
                    onChange={(e) =>
                      setNewRider({
                        ...newRider,
                        codBalance: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#5a6cfc] hover:bg-[#4856cc] py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
                >
                  {editingRider ? "Apply Changes" : "Confirm Registration"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
