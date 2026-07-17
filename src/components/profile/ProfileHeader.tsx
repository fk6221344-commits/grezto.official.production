import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Globe, User, Camera, Edit2 } from 'lucide-react';

interface ProfileHeaderProps {
  onBack?: () => void;
  language: string;
  setLanguage: (lang: string) => void;
  user: any;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  editName: string;
  setEditName: (val: string) => void;
  handleSaveName: () => void;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setAuthMode: (mode: 'signup' | 'login') => void;
  setLoginName: (val: string) => void;
  setLoginPhone: (val: string) => void;
  setOtpCode: (val: string) => void;
  setIsOtpSent: (val: boolean) => void;
  setShowLoginModal: (val: boolean) => void;
  statsOrdersCount: number;
  statsDeliveredCount: number;
  statsTotalSpent: number;
}

export default function ProfileHeader({
  onBack,
  language,
  setLanguage,
  user,
  isEditing,
  setIsEditing,
  editName,
  setEditName,
  handleSaveName,
  handleAvatarChange,
  setAuthMode,
  setLoginName,
  setLoginPhone,
  setOtpCode,
  setIsOtpSent,
  setShowLoginModal,
  statsOrdersCount,
  statsDeliveredCount,
  statsTotalSpent,
}: ProfileHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-[#f3f3f3]/95 backdrop-blur-md border-b border-gray-200/60 px-2 pt-[max(env(safe-area-inset-top),42px)] pb-3 overflow-hidden shadow-xs">
      {/* Subtle decorative glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-550/5 rounded-full blur-[40px] -mr-16 -mt-16 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-gray-400/5 rounded-full blur-[30px] -ml-12 -mb-12 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col space-y-2">
        {/* Top Bar with Back and Welcome Message / Language Switcher */}
        <div className="flex items-center justify-between w-full">
          {onBack ? (
            <button 
              onClick={onBack}
              className="p-1 ml-[-4px] rounded-lg text-slate-700 hover:text-slate-900 bg-black/5 hover:bg-black/10 transition-colors border border-gray-300/30 cursor-pointer flex items-center justify-center shadow-2xs"
              title="Go Back"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div />
          )}
          
          {/* Header Text */}
          <div className="text-center">
             <h2 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-widest leading-none">Welcome to Grezto! 🌿</h2>
             <p className="text-[6.5px] text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-0.5">Always Choose Pure, Choose Healthy</p>
          </div>

          {/* Compact Integrated Language Switcher */}
          <button 
            onClick={() => setLanguage(language === 'en' ? 'as' : 'en')}
            className="px-1.5 py-0.5 rounded-md transition-all flex items-center space-x-0.5 border bg-white border-gray-200 text-slate-700 hover:bg-gray-50 cursor-pointer active:scale-95 shadow-2xs"
          >
            <Globe className="w-2.5 h-2.5 text-inherit" />
            <span className="text-[7.5px] font-black uppercase tracking-wider">{language}</span>
          </button>
        </div>

        {/* Always-visible Center-aligned Profile Avatar & Name Edit Layer - Compact Height & Size */}
        <div className="bg-linear-to-br from-emerald-950 via-teal-900 to-emerald-900 p-3 rounded-[1.4rem] border border-emerald-500/30 shadow-md text-white relative overflow-hidden">
           {/* Premium Cute Glowing Auras */}
           <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
           <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-rose-500/30 rounded-full blur-2xl pointer-events-none"></div>
           <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-24 h-24 bg-teal-400/15 rounded-full blur-xl pointer-events-none"></div>
           <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent pointer-events-none"></div>

           <div className="flex flex-col items-center text-center relative z-10">
              
              {/* 1. Perfectly Round Profile Avatar on Top with 1:1 format */}
              <div className="relative select-none group mb-1.5">
                <motion.div 
                  className="w-14 h-14 bg-stone-950/25 rounded-full border-2 border-white/95 flex items-center justify-center shadow-sm overflow-hidden relative"
                >
                  {user.avatar ? (
                    <img src={user.avatar} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" alt="Profile" />
                  ) : (
                    <User className="w-5 h-5 text-white/90" />
                  )}
                </motion.div>
              </div>

              {/* 2. User info and Name edit option directly below the image */}
              <div className="w-full max-w-xs font-sans">
                {user.isLoggedIn ? (
                  <div className="flex flex-col items-center">
                    {isEditing ? (
                      <div className="flex flex-col items-center space-y-1 w-full">
                        <input 
                          autoFocus
                          className="bg-transparent text-white border-b border-white/60 text-center font-extrabold text-[11px] outline-none placeholder:text-white/50 py-0.5 px-1.5 w-full focus:border-yellow-300 transition-all font-sans"
                          value={editName}
                          placeholder="Enter Your Name"
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <div className="flex space-x-1">
                          <button 
                            onClick={handleSaveName} 
                            className="px-2.5 py-0.5 bg-emerald-50 text-emerald-950 font-extrabold text-[8px] uppercase rounded-full tracking-wider shadow-sm hover:bg-white border-0 cursor-pointer active:scale-95 transition-all"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setIsEditing(false)} 
                            className="px-1.5 py-0.5 bg-white/10 text-white font-extrabold text-[8px] rounded-full border border-white/10 uppercase cursor-pointer active:scale-95 transition-all hover:bg-white/20"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center space-x-1">
                          <span className="text-[11px] font-black text-white tracking-tight drop-shadow-xs truncate max-w-[150px] block">{user.name || 'Grezto Member'}</span>
                          <button 
                            onClick={() => { setEditName(user.name); setIsEditing(true); }} 
                            className="hover:text-yellow-250 text-white/85 transition-all p-0.5 bg-white/10 rounded-full hover:bg-white/25 border-0 cursor-pointer shadow-xs"
                            title="Edit Name"
                          >
                            <Edit2 size={8} className="stroke-[2.5]" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center space-x-1 mt-0.5 bg-black/10 px-1.5 py-0.1 rounded-full border border-white/5">
                          <span className="inline-block w-1 h-1 bg-yellow-400 rounded-full animate-pulse"></span>
                          <span className="text-[7.5px] font-black text-white tracking-wider font-mono">+91 {user.phone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-0.5">
                    <span className="text-[7px] font-black text-rose-100 uppercase tracking-widest bg-black/10 px-1.5 py-0.1 rounded-full border border-white/5">Guest Mode</span>
                    <span className="text-[10px] font-bold text-white mt-0.5 block font-display">Welcome Guest! 👋</span>
                    
                    <motion.button 
                      onClick={() => {
                        setAuthMode('signup');
                        setLoginName('');
                        setLoginPhone('');
                        setOtpCode('');
                        setIsOtpSent(false);
                        setShowLoginModal(true);
                      }}
                      animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 0px rgba(255,255,255,0.2)", "0 0 10px rgba(255,255,255,0.6)", "0 0 0px rgba(255,255,255,0.2)"] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="mt-2 px-4 py-1.5 bg-white text-[#b91c1c] flex items-center justify-center rounded-full text-center font-black text-[9px] uppercase tracking-widest transition-all border-0 shadow-lg cursor-pointer active:scale-95 hover:bg-rose-50"
                    >
                      create/login
                    </motion.button>
                  </div>
                )}
              </div>

           </div>
        </div>

        {/* Premium Highlighted Stats Cards */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
            {/* Orders Card */}
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="flex-1 bg-gradient-to-br from-rose-950 via-[#630b1e] to-rose-700 p-2 rounded-xl text-center text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] border border-rose-500/30 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
               <div className="absolute top-[-20px] right-[-20px] w-12 h-12 bg-white/5 rounded-full blur-md pointer-events-none"></div>
               <p className="font-extrabold text-[12px] tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{statsOrdersCount}</p>
               <p className="text-rose-200/90 text-[6.5px] font-black uppercase tracking-widest mt-0.5 leading-none">Orders</p>
            </motion.div>

            {/* Delivered Card */}
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="flex-1 bg-gradient-to-br from-emerald-950 via-[#065f46] to-emerald-700 p-2 rounded-xl text-center text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)] border border-emerald-500/30 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
               <div className="absolute top-[-20px] right-[-20px] w-12 h-12 bg-white/5 rounded-full blur-md pointer-events-none"></div>
               <p className="font-extrabold text-[12px] tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{statsDeliveredCount}</p>
               <p className="text-emerald-200/90 text-[6.5px] font-black uppercase tracking-widest mt-0.5 leading-none">Delivered</p>
            </motion.div>

            {/* Total Spent Card */}
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="flex-1 bg-gradient-to-br from-indigo-950 via-[#3730a3] to-indigo-700 p-2 rounded-xl text-center text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)] border border-indigo-500/30 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
               <div className="absolute top-[-20px] right-[-20px] w-12 h-12 bg-white/5 rounded-full blur-md pointer-events-none"></div>
               <p className="font-extrabold text-[12px] tracking-tight text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">₹{statsTotalSpent}</p>
               <p className="text-indigo-200/90 text-[6.5px] font-black uppercase tracking-widest mt-0.5 leading-none">Total Spent</p>
            </motion.div>
        </div>
      </div>
    </div>
  );
}
