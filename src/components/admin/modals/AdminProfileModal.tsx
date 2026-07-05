import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminProfileModalProps {
  showAdminProfileModal: boolean;
  setShowAdminProfileModal: (val: boolean) => void;
  adminOwnerPhoto: string;
  setAdminOwnerPhoto: (val: string) => void;
  adminOwnerName: string;
  setAdminOwnerName: (val: string) => void;
  adminOwnerRole: string;
  setAdminOwnerRole: (val: string) => void;
  setCropTarget: (val: string) => void;
  setImageSrc: (val: string | null) => void;
}

export default function AdminProfileModal({
  showAdminProfileModal,
  setShowAdminProfileModal,
  adminOwnerPhoto,
  setAdminOwnerPhoto,
  adminOwnerName,
  setAdminOwnerName,
  adminOwnerRole,
  setAdminOwnerRole,
  setCropTarget,
  setImageSrc
}: AdminProfileModalProps) {
  return (
    <AnimatePresence>
      {showAdminProfileModal && (
        <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-0 sm:p-5">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAdminProfileModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div 
            initial={{ y: '100%', scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-10 relative z-[261] shadow-2xl border border-stone-105/10 font-sans"
          >
            <button 
              type="button"
              onClick={() => setShowAdminProfileModal(false)} 
              className="absolute top-6 right-6 p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full border-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <h3 className="text-sm font-black text-stone-900 tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
                Admin Owner Setup
              </h3>
              <p className="text-[8px] text-emerald-600 font-extrabold uppercase tracking-widest mt-1">Sadaa Shuddh Chunein, Sehatmand Chunein</p>
            </div>

            {/* 1. Admin Owner Profile Photo Area */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative group w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-emerald-500 via-yellow-450 via-orange-500 to-rose-600 shadow-xl mb-4 text-center">
                <div className="w-full h-full rounded-full bg-stone-950 overflow-hidden flex items-center justify-center relative">
                  {adminOwnerPhoto ? (
                    <img 
                      src={adminOwnerPhoto} 
                      alt="Admin preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-stone-300 font-black text-2xl">👑</div>
                  )}
                </div>
                
                {/* Absolute camera action icon */}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-zinc-950 hover:bg-zinc-900 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-105 active:scale-[0.95]">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/jpg" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isImageFormat = file.type.match(/^image\//i) || file.name.match(/\.(png|jpeg|jpg|webp|heic)$/i);
                        if (!isImageFormat) {
                          toast.error("Please upload a valid image file!");
                          return;
                        }
                        if (file.size > 20 * 1024 * 1024) {
                          toast.error("Image size exceeds 20MB. Please upload a smaller image.");
                          return;
                        }
                        
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCropTarget('admin');
                          setImageSrc(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                    className="hidden" 
                  />
                </label>
              </div>
              <p className="text-[8px] text-stone-400 font-extrabold tracking-widest uppercase">Click on camera to upload & crop</p>
            </div>

            {/* 2. Admin Owner Name & Designation Input Forms */}
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Admin Owner Name</label>
                <input 
                  type="text"
                  value={adminOwnerName}
                  onChange={(e) => setAdminOwnerName(e.target.value)}
                  placeholder="Enter Owner Full Name"
                  className="w-full bg-stone-50 border border-stone-100 text-stone-850 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1 px-1">Designation / Role</label>
                <input 
                  type="text"
                  value={adminOwnerRole}
                  onChange={(e) => setAdminOwnerRole(e.target.value)}
                  placeholder="e.g. Director & Managing Founder"
                  className="w-full bg-stone-50 border border-stone-105 text-stone-850 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            {/* 3. Actions: Cancel and Save */}
            <div className="flex space-x-2.5 mt-8">
              <button
                type="button"
                onClick={() => setShowAdminProfileModal(false)}
                className="flex-1 bg-stone-50 hover:bg-stone-100 text-stone-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-stone-150 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('grezto_admin_owner_photo', adminOwnerPhoto);
                  localStorage.setItem('grezto_admin_owner_name', adminOwnerName);
                  localStorage.setItem('grezto_admin_owner_role', adminOwnerRole);
                  setAdminOwnerPhoto(adminOwnerPhoto);
                  setAdminOwnerName(adminOwnerName);
                  setAdminOwnerRole(adminOwnerRole);
                  setShowAdminProfileModal(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 shadow-md hover:shadow-lg transition-all cursor-pointer shadow-emerald-100"
              >
                Save & Publish ✔️
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
