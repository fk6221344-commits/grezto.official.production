import React from 'react';
import { Home, ShoppingCart, Repeat, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { triggerNativeImpactVibration } from '../services/nativeService';

export default function BottomNav({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) {
  const { t } = useLanguage();
  const { items } = useCart();
  const { user } = useUser();

  const handleTabTap = (tab: string) => {
    triggerNativeImpactVibration();
    onTabChange(tab);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex items-center justify-around px-4 z-[100] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
      <NavButton active={activeTab === 'home'} icon={<Home />} label="Home" onClick={() => handleTabTap('home')} />
      <NavButton 
        active={activeTab === 'cart'} 
        icon={
          <div className="relative">
            <ShoppingCart />
            {items.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-lg">
                {items.length}
              </span>
            )}
          </div>
        } 
        label="Cart" 
        onClick={() => handleTabTap('cart')} 
      />
      <NavButton active={activeTab === 'orders'} icon={<Repeat />} label="Orders" onClick={() => handleTabTap('orders')} />
      
      {/* 👤 Dynamic Bottom Profile Button */}
      <button 
        onClick={() => handleTabTap('profile')}
        className={`flex flex-col items-center justify-center space-y-1 transition-all duration-100 flex-1 border-0 bg-transparent cursor-pointer ${
          activeTab === 'profile' ? "text-emerald-600" : "text-gray-300"
        }`}
      >
        <div className={`transition-all duration-100 ${activeTab === 'profile' ? "scale-105" : ""}`}>
          {user.avatar ? (
            <div className={`w-5.5 h-5.5 rounded-full overflow-hidden border ${activeTab === 'profile' ? 'border-emerald-500 shadow-sm' : 'border-gray-250'}`}>
              <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="User Profile" />
            </div>
          ) : (
            <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          )}
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-widest transition-opacity ${activeTab === 'profile' ? "opacity-100" : "opacity-0"}`}>Profile</span>
      </button>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center space-y-1 transition-all duration-100 flex-1 border-0 bg-transparent cursor-pointer ${
        active ? "text-emerald-600" : "text-gray-300"
      }`}
    >
      <div className={`transition-all duration-100 ${active ? "scale-105" : ""}`}>
        {React.cloneElement(icon, { size: 22, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>{label}</span>
    </button>
  );
}
