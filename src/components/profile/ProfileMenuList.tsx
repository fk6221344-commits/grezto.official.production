import React from 'react';
import { motion } from 'motion/react';
import { Plus, Headphones, LogOut, Info, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileMenuListProps {
  user: any;
  showAddNewAddress: boolean;
  setShowAddNewAddress: (val: boolean) => void;
  setIsEditingAddress: (val: boolean) => void;
  setShowAIChat: (val: boolean) => void;
  setShowSignOutConfirm: (val: boolean) => void;
  setShowAboutModal: (val: boolean) => void;
}

export default function ProfileMenuList({
  user,
  showAddNewAddress,
  setShowAddNewAddress,
  setIsEditingAddress,
  setShowAIChat,
  setShowSignOutConfirm,
  setShowAboutModal,
}: ProfileMenuListProps) {
  return (
    <div className="px-1 py-1 space-y-3">
      <div className="bg-white rounded-xl border border-gray-150/40 shadow-xs divide-y divide-gray-50 overflow-hidden">
        <MenuListItem 
          icon={<Plus className="text-emerald-500" />} 
          label="Add New Address" 
          onClick={() => {
            if (!user.isLoggedIn) {
              toast.error("Please login to add a new delivery address! 🌿");
              return;
            }
            setShowAddNewAddress(!showAddNewAddress);
            setIsEditingAddress(false);
          }}
        />
        <MenuListItem 
          icon={<Headphones className="text-purple-500" />} 
          label="Help & Support" 
          onClick={() => setShowAIChat(true)}
        />
        {user.isLoggedIn && (
          <MenuListItem 
            icon={<LogOut className="text-red-500" />} 
            label="Sign Out" 
            onClick={() => setShowSignOutConfirm(true)}
          />
        )}
        <MenuListItem 
          icon={<Info className="text-pink-500" />} 
          label="About Grezto" 
          onClick={() => setShowAboutModal(true)}
        />
      </div>
    </div>
  );
}

function MenuListItem({ icon, label, onClick, rightElement }: any) {
  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-white p-3.5 flex items-center justify-between active:bg-gray-50 transition-colors group border-0 cursor-pointer"
    >
      <div className="flex items-center space-x-3.5">
        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-sm transition-all group-hover:scale-110">
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 11 }) : icon}
        </div>
        <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-center space-x-2 text-gray-300">
        {rightElement}
        <ChevronRight size={11} />
      </div>
    </motion.button>
  );
}
