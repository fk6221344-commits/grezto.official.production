import React, { useState } from 'react';
import { MapPin, Bell, Search, Globe, ChevronDown, ChevronLeft, User, Compass, Check, Info, X, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { toast } from 'react-hot-toast';
import { getDeviceLocation } from '../services/nativeService';
import HomeHeader from './home/HomeHeader';

export default function Navbar({ 
  onOpenNotifications, 
  onBack, 
  onProfileTap,
  activeTab = 'home',
  searchQuery = '',
  onSearchChange,
  onSearchClick,
  viewTab,
  onViewTabChange
}: { 
  onOpenNotifications: () => void; 
  onBack?: () => void;
  onProfileTap?: () => void;
  activeTab?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSearchClick?: () => void;
  viewTab?: 'pending' | 'history';
  onViewTabChange?: (tab: 'pending' | 'history') => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  const { user, updateProfile, cities, changeActiveCity } = useUser();
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showOrdersMenu, setShowOrdersMenu] = useState(false);
  const isDarkHeader = activeTab === 'home' || activeTab === 'cart' || activeTab === 'orders';

  // Structured address input states
  const [addrState, setAddrState] = useState('Assam');
  const [addrCity, setAddrCity] = useState('');
  const [addrStreetArea, setAddrStreetArea] = useState('');

  // Handle opening modal and pre-populating fields if possible
  const handleOpenAddressModal = () => {
    if (user.address) {
      const parts = user.address.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        setAddrState(parts[parts.length - 1] || 'Assam');
        setAddrCity(parts[parts.length - 2] || 'Kawarhagi');
        setAddrStreetArea(parts.slice(0, parts.length - 2).join(', '));
      } else if (parts.length === 2) {
        setAddrStreetArea(parts[0]);
        setAddrCity(parts[1]);
        setAddrState('Assam');
      } else {
        setAddrStreetArea(user.address);
        setAddrCity('Kawarhagi');
        setAddrState('Assam');
      }
    } else {
      setAddrStreetArea('');
      setAddrCity('');
      setAddrState('Assam');
    }
    setShowAddressModal(true);
  };

  if (activeTab === 'home') {
    return (
      <HomeHeader
        onOpenNotifications={onOpenNotifications}
        onProfileTap={onProfileTap}
        searchQuery={searchQuery}
        onSearchClick={onSearchClick}
      />
    );
  }

  if (activeTab === 'home' && searchQuery) {
    return (
      <div className="bg-white pt-[max(env(safe-area-inset-top),42px)] pb-3 px-4 sticky top-0 z-[100] border-b border-gray-100 shadow-sm flex items-center gap-2 transition-colors duration-100">
        <button 
          onClick={() => window.history.back()}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <div 
          className="flex-1 bg-gray-100 rounded-2xl flex items-center px-3 h-10 border border-gray-200 cursor-text"
          onClick={onSearchClick}
        >
          <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
          <div className="flex-1 text-sm text-gray-800 truncate select-none">
            {searchQuery}
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onSearchChange) onSearchChange('');
            }} 
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 bg-gray-200 ml-2 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={
      isDarkHeader
        ? activeTab === 'cart'
          ? "px-3 pt-[max(env(safe-area-inset-top),42px)] pb-5 sticky top-0 z-[100] border-b border-slate-950/20 shadow-lg shadow-slate-950/10 transition-colors duration-100"
          : "px-3 pt-[max(env(safe-area-inset-top),42px)] pb-5 sticky top-0 z-[100] border-b border-emerald-950/20 shadow-lg shadow-emerald-950/10 transition-colors duration-100"
        : "bg-white/90 backdrop-blur-md px-3 pt-[max(env(safe-area-inset-top),42px)] pb-5 sticky top-0 z-[100] border-b border-gray-100 transition-colors duration-100"
    }>
      {/* Background container that is absolute so it can have overflow-hidden, keeping Navbar's main div overflow visible for the dropdown */}
      {isDarkHeader && (
        <div className={`absolute inset-0 ${activeTab === 'cart' ? 'animated-navy-gradient' : 'animated-green-gradient'} overflow-hidden z-0 pointer-events-none`}>
          <div className="absolute inset-y-0 w-36 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent skew-x-[-20deg] filter blur-[3px] animate-red-scan" style={{ animationDuration: '6.5s' }} />
        </div>
      )}
      <div className="flex items-center justify-between relative z-50">
        <div className="flex items-center space-x-1">
          {onBack && (
            <button 
              onClick={onBack}
              className={`p-2 -ml-2 rounded-xl transition-colors ${
                isDarkHeader 
                  ? activeTab === 'cart'
                    ? 'text-blue-200 hover:text-white hover:bg-white/5'
                    : 'text-emerald-200 hover:text-white hover:bg-white/5' 
                  : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          
          {/* Top-Left Profile Icon Logo */}
          <button 
            onClick={onProfileTap}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 hover:shadow-lg active:scale-95 transition-all cursor-pointer overflow-hidden ${
              isDarkHeader 
                ? activeTab === 'cart'
                  ? 'bg-white/10 text-white border-white/15'
                  : 'bg-white/10 text-white border-white/15' 
                : 'bg-gradient-to-tr from-emerald-100 to-emerald-50 text-emerald-700 border-white'
            }`}
            title="View Profile"
          >
            {user.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" alt="Profile" />
            ) : (
              <User className={`w-5 h-5 ${isDarkHeader ? 'text-white' : 'text-emerald-600'}`} />
            )}
          </button>

          {activeTab === 'home' ? (
            <div className="relative z-50 flex items-center py-1">
              <div 
                onClick={() => setShowLocationMenu(!showLocationMenu)}
                className="flex items-center space-x-1 cursor-pointer select-none group"
              >
                <span className="text-emerald-300 group-hover:scale-110 transition-transform text-xs">📍</span>
                <span className="text-xs font-extrabold text-white truncate max-w-[130px] tracking-tight">
                  {(() => {
                    if (!user.address || user.address.trim() === "") return "Add location";
                    const parts = user.address.split(',').map(p => p.trim()).filter(Boolean);
                    if (parts.length > 0) {
                      const cleanParts = parts.filter(p => {
                        const low = p.toLowerCase();
                        return !low.includes("india") && !/^\d{5,6}$/.test(p) && low !== "assam";
                      });

                      // Check if first part is a GPS pin identifier
                      const firstPart = cleanParts[0] || parts[0];
                      if (firstPart.startsWith("GPS Pin") || firstPart.startsWith("Location Pin") || firstPart.startsWith("Location Point")) {
                        const remaining = cleanParts.slice(1, 3);
                        if (remaining.length > 0) return remaining.join(', ');
                      }

                      const finalParts = cleanParts.length > 0 ? cleanParts.slice(0, 2) : parts.slice(0, 2);
                      return finalParts.join(', ');
                    }
                    return user.address;
                  })()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-300 group-hover:text-amber-300" />
              </div>

              {/* Delivering Options Menu Dropdown */}
              {showLocationMenu && (
                <>
                  {/* Absolute backdrop closing overlay covers whole screen behind dropdown */}
                  <div 
                    className="fixed inset-0 z-40 bg-black/0 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLocationMenu(false);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setShowLocationMenu(false);
                    }}
                  />
                  
                  <div className="absolute top-11 left-0 w-64 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-gray-100/60 p-3 z-50 flex flex-col space-y-1.5 font-sans animate-in fade-in slide-in-from-top-2 duration-200 text-gray-850">
                    <p className="text-[8px] text-gray-400 font-extrabold uppercase tracking-widest px-2.5 py-1 border-b border-gray-50">Select Delivery Mode</p>

                    {/* Use Current GPS Location option */}
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        setShowLocationMenu(false); // Close dropdown immediately on click
                        const toastId = toast.loading("🛰️ Fetching current GPS location...");
                        try {
                          const { Geolocation } = await import('@capacitor/geolocation');
                          const { getUnifiedHighSpeedLocation, reverseGeocodeCoords } = await import('../lib/geocoder');
                          const location = await getUnifiedHighSpeedLocation();
                          const result = await reverseGeocodeCoords(location.latitude, location.longitude);
                          
                          const compiledAddress = `${result.street || "Location Point"}, ${result.city || "Kawarhagi"}, ${result.state || "Assam"}${result.pincode ? ` (Pin - ${result.pincode})` : ""}`;
                          
                          updateProfile({
                            address: compiledAddress,
                            lat: location.latitude,
                            lng: location.longitude,
                            activeCity: result.city || "Kawarhagi"
                          });
                          
                          const isCoarse = location.method.includes("IP-Geolocation") || location.method.includes("Offline-Regional-Fallback") || location.method.includes("Network-Coarse");
                          if (isCoarse) {
                            toast.error("Low accuracy location detected. Please type your exact address manually for absolute precision!", { id: toastId, duration: 5000 });
                          } else {
                            toast.success(`🎯 GPS locked & address updated!`, { id: toastId });
                          }
                        } catch (err: any) {
                          console.warn("Capacitor Geolocation failed:", err);
                          toast.error(err?.message || "GPS access failed. Please enable hardware location permissions.", { id: toastId });
                        }
                      }}
                      className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-gray-50 text-left transition-colors cursor-pointer group border-b border-gray-50/50 pb-1.5"
                    >
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <Compass className="w-4.5 h-4.5 animate-spin-slow text-emerald-650" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-850">Use Current Location</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">Auto-detect via GPS</p>
                      </div>
                    </button>

                    {/* Create / Type manual address option */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLocationMenu(false);
                        handleOpenAddressModal();
                      }}
                      className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-gray-50 text-left transition-colors cursor-pointer group pb-1.5 border-b border-gray-50/50"
                    >
                      <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                        <span className="text-xs font-semibold">✍️</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-850">Create your address</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">Type custom address</p>
                      </div>
                    </button>


                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {activeTab === 'profile' && (
                <>
                  <span className="text-[8px] text-gray-400 font-black uppercase tracking-wider">My Account</span>
                  <span className="text-xs font-bold text-gray-850 uppercase italic tracking-tight">Profile Details</span>
                </>
              )}
              {activeTab === 'cart' && (
                <>
                  <span className="text-[8px] text-blue-200/70 font-black uppercase tracking-wider">My Cart</span>
                  <span className="text-xs font-bold text-[#fffdf5] uppercase italic tracking-tight">Shopping Bag</span>
                </>
              )}
              {activeTab === 'orders' && (
                <>
                  <span className="text-[8px] text-emerald-200/70 font-black uppercase tracking-wider">My Purchase</span>
                  <span className="text-xs font-bold text-[#fffdf5] uppercase italic tracking-tight">Order History</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3 pr-4">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'as' : 'en')}
            className={`p-2 rounded-xl transition-colors flex items-center space-x-1 border ${
              isDarkHeader 
                ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
                : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-500'
            }`}
          >
            <Globe className="w-4 h-4 text-inherit" />
            <span className="text-[10px] font-black uppercase">{language}</span>
          </button>
          <button 
            onClick={onOpenNotifications}
            className={`relative p-2 transition-colors ${
              isDarkHeader 
                ? activeTab === 'cart'
                  ? 'text-blue-100 hover:text-white'
                  : 'text-emerald-100 hover:text-white' 
                : 'text-gray-400 hover:text-emerald-500'
            }`}
          >
            <Bell className="w-6 h-6" />
            <span className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 shadow-sm ${
              isDarkHeader 
                ? activeTab === 'cart'
                  ? 'bg-amber-400 border-[#020c1b]'
                  : 'bg-amber-400 border-[#043315]' 
                : 'bg-red-500 border-white'
            }`}></span>
          </button>
          
          {/* Discrete Info Button for Orders History Toggle */}
          {activeTab === 'orders' && (
            <div className="relative">
              <button 
                onClick={() => setShowOrdersMenu(!showOrdersMenu)}
                className="p-2 rounded-xl transition-all hover:bg-gray-50 border border-transparent text-gray-400 hover:text-emerald-500 cursor-pointer flex items-center justify-center bg-transparent focus:outline-none active:scale-95"
                title="Info"
              >
                <Info className={`w-5 h-5 stroke-[2.5] ${isDarkHeader ? 'text-emerald-200 hover:text-white' : 'text-gray-400 hover:text-gray-650'}`} />
              </button>
              
              {showOrdersMenu && (
                <>
                  <div className="fixed inset-0 z-[110] bg-black/0 cursor-default" onClick={() => setShowOrdersMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-150 rounded-2xl shadow-xl shadow-gray-200/50 p-2 z-[120] flex flex-col space-y-1">
                    <button
                      onClick={() => {
                        onViewTabChange?.('pending');
                        setShowOrdersMenu(false);
                      }}
                      className={`flex items-center space-x-2.5 w-full px-3 py-2.5 rounded-xl text-left border-0 cursor-pointer text-[10px] font-black uppercase tracking-wider transition-all focus:outline-none ${
                        viewTab === 'pending' 
                          ? 'bg-emerald-50 text-emerald-850' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 bg-transparent'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>Active Orders</span>
                    </button>
                    <button
                      onClick={() => {
                        onViewTabChange?.('history');
                        setShowOrdersMenu(false);
                      }}
                      className={`flex items-center space-x-2.5 w-full px-3 py-2.5 rounded-xl text-left border-0 cursor-pointer text-[10px] font-black uppercase tracking-wider transition-all focus:outline-none ${
                        viewTab === 'history' 
                          ? 'bg-emerald-50 text-emerald-850' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 bg-transparent'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span>Order History</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {activeTab === 'home' && (
        <>
          <div className="mt-2.5 relative z-10" onClick={onSearchClick}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-200/60">
              <Search className="w-4 h-4" />
            </div>
            <div 
              className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl py-2 pl-10 pr-4 text-sm font-medium border border-white/5 flex items-center h-9 cursor-pointer"
            >
              {searchQuery ? (
                <span className="text-white">{searchQuery}</span>
              ) : (
                <span className="text-white/40">Search 'Milk' or 'Veggies'</span>
              )}
            </div>
          </div>
          
          {/* New 10 to 45 mins (under 6KM) Express Delivery Info Strip */}
          <div className="mt-2 flex items-center justify-center space-x-1.5 px-3 py-1 bg-[#021d0a] rounded-xl border border-emerald-800 text-white shadow-inner relative z-10">
            <span className="text-amber-400 text-xs animate-bounce font-sans">⚡</span>
            <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-100 font-display">
              10 to 45 minutes (under 6KM) 🚀
            </span>
          </div>
        </>
      )}

      {/* Elegant Manual Address Form Modal Layout */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto font-sans text-gray-800">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-1 italic text-left">Create Address</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 text-left">Add your location details carefully</p>
            
            {/* Live GPS Autofill Button */}
            <button
              type="button"
              onClick={async () => {
                const toastId = toast.loading("🛰️ Fetching live physical GPS location...");
                try {
                  const { getUnifiedHighSpeedLocation, reverseGeocodeCoords } = await import('../lib/geocoder');
                  const location = await getUnifiedHighSpeedLocation();
                  const result = await reverseGeocodeCoords(location.latitude, location.longitude);
                  
                  setAddrState(result.state || 'Assam');
                  setAddrCity(result.city || 'Kawarhagi');
                  setAddrStreetArea(result.street || 'Kawarhagi, Mitreno Tech Road');
                  
                  toast.success(`🎯 Live GPS lock synchronized! (${location.method})`, { id: toastId });
                } catch (err: any) {
                  console.warn("Capacitor Geolocation failed:", err);
                  toast.error(err?.message || "Geolocation failed. Please type address manually.", { id: toastId });
                }
              }}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3.5 px-4 mb-4 rounded-2xl text-[10.5px] font-black uppercase tracking-widest border border-dashed border-emerald-300 shadow-xs transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 animate-spin-slow text-emerald-600 shrink-0" />
              <span>Use Live Current GPS</span>
            </button>

            <div className="space-y-3.5">
              {/* 1. State */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">State</label>
                <input
                  type="text"
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  placeholder="e.g. Assam"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 text-xs font-bold text-gray-750 focus:ring-1.5 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              {/* 2. City / Village name */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">City / Village Name</label>
                <input
                  type="text"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="e.g. Kawarhagi"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 text-xs font-bold text-gray-750 focus:ring-1.5 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              {/* 3. Street / Area */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider ml-1">Street / Area</label>
                <input
                  type="text"
                  value={addrStreetArea}
                  onChange={(e) => setAddrStreetArea(e.target.value)}
                  placeholder="e.g. Mitreno Tech Road, Kawarhagi Village"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 text-xs font-bold text-gray-750 focus:ring-1.5 focus:ring-emerald-500/30 outline-none"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowAddressModal(false)}
                className="flex-1 bg-gray-100 py-3 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (addrState.trim() === "" || addrCity.trim() === "" || addrStreetArea.trim() === ""){
                    toast.error("All three address fields (State, City/Village, Street/Area) are absolutely required!");
                    return;
                  }
                  
                  // Clean combine
                  const parts = [
                    addrStreetArea.trim(),
                    addrCity.trim(),
                    addrState.trim()
                  ].filter(Boolean);
                  
                  const combinedPath = parts.join(', ');
                  updateProfile({ address: combinedPath });
                  setShowAddressModal(false);
                  toast.success("Delivery address updated successfully!");
                }}
                className="flex-1 bg-emerald-600 py-3 rounded-2xl text-[10px] font-black text-white uppercase tracking-wider hover:bg-emerald-700 shadow-md transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
