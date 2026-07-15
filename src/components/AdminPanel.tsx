import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Bell, Camera, Crop as CropIcon, Globe, Package, Edit, History, Info } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import toast from "react-hot-toast";
import Cropper from "react-easy-crop";
import { useUser } from "../context/UserContext";

// Imported static mock assets & subcomponents
import { NotificationsPanel } from "./NotificationsPanel";
import AdminOrdersTab from "./admin/AdminOrdersTab";
import AdminInventoryTab from "./admin/AdminInventoryTab";
import AdminShopsTab from "./admin/AdminShopsTab";
import AdminMgmtModals from "./admin/AdminMgmtModals";
import AdminLogin from "./admin/AdminLogin";
import { AdminOfflineModal } from "./admin/modals/AdminOfflineModal";
import { unlockNotificationAudio } from "../services/notifications";

// Custom Hooks for separated logic
import { useAdminOrders } from "./admin/hooks/useAdminOrders";
import { useAdminProducts } from "./admin/hooks/useAdminProducts";
import { useAdminShops } from "./admin/hooks/useAdminShops";
import { useAdminCategories } from "./admin/hooks/useAdminCategories";
import { useAdminRiders } from "./admin/hooks/useAdminRiders";
import { supabase } from "../services/supabase";

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { firebaseAuthReady, user, cities } = useUser();
  const { t } = useLanguage();
  const [adminSelectedCityFilter, setAdminSelectedCityFilter] = useState("All");
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("grezto_admin_authed") === "true");
  const [isAdminMaster, setIsAdminMaster] = useState(() => localStorage.getItem("grezto_admin_master") === "true");
  const [localCityScope, setLocalCityScope] = useState(() => localStorage.getItem("grezto_admin_local_city") || "");
  const [impersonatedCity, setImpersonatedCity] = useState("");
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState("orders");
  const [localTick, setLocalTick] = useState(0);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Admin Profile Customization
  const [adminOwnerPhoto, setAdminOwnerPhoto] = useState<string>(() => localStorage.getItem("grezto_admin_owner_photo") || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=");
  const [adminOwnerName, setAdminOwnerName] = useState<string>(() => localStorage.getItem("grezto_admin_owner_name") || "Grezto Admin Owner");
  const [adminOwnerRole, setAdminOwnerRole] = useState<string>(() => localStorage.getItem("grezto_admin_owner_role") || "Founder & MD");
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);

  // Cropper generic state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropTarget, setCropTarget] = useState<"product" | "product2" | "product3" | "product4" | "product5" | "admin">("product");

  // Mount logic hooks
  const {
    orders, riders, busyRiders,
    adminActiveOrders, filteredOrders, filteredAdminActiveOrders,
    filteredAdminActiveOrdersActive, filteredAdminActiveOrdersHistory,
    filteredOrdersActive, filteredOrdersHistory, adminActiveCount,
    filteredRiders, updateOrderStatus, isSystemOnline, isLoadingActive
  } = useAdminOrders(isAuthenticated, firebaseAuthReady, adminSelectedCityFilter);

  const {
    dbCategories, showCategoryModal, setShowCategoryModal,
    editingCategory, setEditingCategory, newCat, setNewCat,
    handleSaveCategory, handleDeleteCategory
  } = useAdminCategories(isAuthenticated, firebaseAuthReady);

  const {
    products, filteredProducts, isLoading, showAddModal, setShowAddModal,
    editingProduct, setEditingProduct, newProduct, setNewProduct,
    toggleStock, handleAddProduct, handleDeleteProduct, startAdd, startEdit, handleImageUpload, isUpdatingStock
  } = useAdminProducts(isAuthenticated, firebaseAuthReady, adminSelectedCityFilter, localTick, setLocalTick, setAdminOwnerPhoto);

  const {
    shops, filteredShops, showAddShopModal, setShowAddShopModal,
    editingShop, setEditingShop, newShop, setNewShop,
    isShopPhoneVerified, setIsShopPhoneVerified, shopOtpSent, setShopOtpSent,
    shopOtpInput, setShopOtpInput, shopOtpLoading, shopOtpError,
    confirmModal, setConfirmModal, handleSendShopOtp, handleSaveShop,
    handleDeleteShop, handleToggleBlockShop, handleTogglePinShop
  } = useAdminShops(isAuthenticated, firebaseAuthReady, adminSelectedCityFilter, localTick);

  const {
    showRiderModal, setShowRiderModal, editingRider, setEditingRider,
    newRider, setNewRider, handleSaveRider
  } = useAdminRiders(adminSelectedCityFilter);

  useEffect(() => {
    if (impersonatedCity) setAdminSelectedCityFilter(impersonatedCity);
    else if (localCityScope) setAdminSelectedCityFilter(localCityScope);
    else setAdminSelectedCityFilter("All");
  }, [impersonatedCity, localCityScope]);

  useEffect(() => {
    if (isAuthenticated) setActiveTab("orders");
  }, [isAuthenticated]);

  // Pre-emptive browser/Capacitor webview gesture unlock mechanism to guarantee 100% audio ringtone reliability
  useEffect(() => {
    const unlockChime = () => {
      try {
        unlockNotificationAudio();
        console.log("🏪 [Admin Panel] User interaction detected, unlocked notification audio contexts!");
      } catch (e) {}
    };
    window.addEventListener('click', unlockChime, { passive: true });
    window.addEventListener('touchstart', unlockChime, { passive: true });
    return () => {
      window.removeEventListener('click', unlockChime);
      window.removeEventListener('touchstart', unlockChime);
    };
  }, []);

  const handleLogin = () => {
    const cleanPin = pin.trim();
    if (cleanPin === "1234") {
      setIsAuthenticated(true);
      setIsAdminMaster(true);
      setLocalCityScope("");
      localStorage.setItem("grezto_admin_authed", "true");
      localStorage.setItem("grezto_admin_master", "true");
      localStorage.setItem("grezto_admin_local_city", "");
      toast.success("Welcome, Master Owner! 👑");
      setActiveTab("orders");
    } else {
      const matchedCity = (cities || []).find((c: any) => c.managerPin && String(c.managerPin).trim() === cleanPin);
      if (matchedCity) {
        setIsAuthenticated(true);
        setIsAdminMaster(false);
        setLocalCityScope(matchedCity.name);
        localStorage.setItem("grezto_admin_authed", "true");
        localStorage.setItem("grezto_admin_master", "false");
        localStorage.setItem("grezto_admin_local_city", matchedCity.name);
        toast.success(`Welcome, Manager of ${matchedCity.name} Hub! 🏙️`);
        setActiveTab("orders");
      } else {
        toast.error("Invalid PIN code!");
        setPin("");
      }
    }
  };

  const onCropComplete = useCallback((_ca: any, croppedAreaPixels: any) => setCroppedAreaPixels(croppedAreaPixels), []);

  const createCroppedImage = async () => {
    try {
      const getCroppedImg = (await import("../utils/cropImage")).getCroppedImg;
      const croppedImage = await getCroppedImg(imageSrc!, croppedAreaPixels);
      if (cropTarget === "admin") setAdminOwnerPhoto(croppedImage as string);
      else if (cropTarget === "product") setNewProduct((prev) => ({ ...prev, imageUrl: croppedImage as string }));
      else if (cropTarget === "product2") setNewProduct((prev) => ({ ...prev, imageUrl2: croppedImage as string }));
      else if (cropTarget === "product3") setNewProduct((prev) => ({ ...prev, imageUrl3: croppedImage as string }));
      else if (cropTarget === "product4") setNewProduct((prev) => ({ ...prev, imageUrl4: croppedImage as string }));
      else if (cropTarget === "product5") setNewProduct((prev) => ({ ...prev, imageUrl5: croppedImage as string }));
      setImageSrc(null);
      toast.success("Perfectly Cropped");
    } catch (e) {
      toast.error("Crop failed");
    }
  };

  if (!isAuthenticated) return <AdminLogin pin={pin} setPin={setPin} handleLogin={handleLogin} onClose={onClose} />;

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] text-stone-900 flex flex-col font-sans relative" id="admin-panel-main-holder">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[130px] pointer-events-none" />

      <header className="px-3 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6 flex items-center justify-between border-b border-stone-200/55 bg-white/70 backdrop-blur-md relative z-10 text-stone-900">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-stone-150/40 rounded-xl transition-colors text-stone-600 border-0 bg-transparent cursor-pointer">
            <ArrowLeft className="w-6 h-6 text-stone-800" />
          </button>
          <button onClick={() => setShowAdminProfileModal(true)} className="w-11 h-11 relative rounded-full p-[2px] bg-emerald-600 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer border-0 inline-flex items-center justify-center shrink-0 group" title="Click to manage Admin Owner details">
            <div className="w-full h-full rounded-full bg-stone-950 overflow-hidden flex items-center justify-center relative">
              {adminOwnerPhoto ? <img src={adminOwnerPhoto} alt={adminOwnerName} className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" /> : <div className="w-full h-full bg-stone-955 text-stone-300 flex items-center justify-center text-sm font-black group-hover:opacity-85">👑</div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera size={12} className="text-white" /></div>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border border-white flex items-center justify-center text-[8px] shadow-sm animate-bounce text-stone-950 font-black">★</div>
          </button>
          <div>
            <h2 className="text-lg font-extrabold tracking-widest uppercase italic leading-none bg-emerald-700 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)] select-none cursor-pointer hover:opacity-85 transition-opacity" onClick={() => setShowAdminProfileModal(true)} style={{ fontFamily: "'Cinzel', serif" }} title="Click to manage Admin Owner details">Grezto VIP</h2>
            <p className="text-[7.5px] text-emerald-600 font-extrabold tracking-widest uppercase mt-1 leading-none">Management Hub</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setShowNotifications(true)} className="relative p-2 rounded-full hover:bg-stone-100/60 text-stone-600 active:scale-95 transition-transform cursor-pointer border-none bg-transparent flex items-center justify-center focus:outline-none" title="Notifications">
            <Bell className="w-5 h-5 text-stone-600" />
            {adminActiveCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-650 rounded-full border-2 border-white animate-bounce"></span>}
          </button>
          <div className="relative">
            <button onClick={() => setShowInfoMenu(prev => !prev)} className={`p-2 rounded-full active:scale-95 transition-all cursor-pointer border-none flex items-center justify-center focus:outline-none ${activeTab === "history" || showInfoMenu ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100/70" : "bg-transparent text-stone-600 hover:bg-stone-100/60"}`} title="Info"><Info className="w-5 h-5" /></button>
            {showInfoMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowInfoMenu(false)} />
                <motion.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} className="absolute right-0 mt-1 w-24 bg-white border border-stone-200/50 rounded-xl shadow-lg z-50 overflow-hidden font-sans border-solid">
                  <div className="p-0.5">
                    <button onClick={() => { setActiveTab("history"); setShowInfoMenu(false); }} className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-stone-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer border-none focus:outline-none">
                      <History className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>History</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-6 no-scrollbar relative z-10 text-stone-800">
        {impersonatedCity && (
          <div className="bg-amber-500 text-stone-955 p-4 rounded-3xl border border-amber-600/30 shadow-md flex items-center justify-between mt-3 animate-fade-in relative z-20 font-sans">
            <div className="text-left">
              <span className="text-[7.5px] font-black uppercase tracking-widest block opacity-70">Super Admin Mirror View</span>
              <span className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5 mt-0.5">🛡️ Viewing {impersonatedCity} Hub</span>
            </div>
            <button onClick={() => { setImpersonatedCity(""); setActiveTab("master"); }} className="bg-stone-950 text-white font-extrabold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-xl border-none cursor-pointer hover:bg-stone-850 active:scale-95 transition-all shadow-sm">Back to Master ✕</button>
          </div>
        )}
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-4 gap-2">
            {/* Live Orders Card */}
            <div className="w-full bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-2.5 text-white shadow-lg flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
              <div className="absolute top-1 right-1 w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
              <div>
                <p className="text-emerald-100 text-[6px] uppercase font-black tracking-widest mb-0.5 select-none w-full truncate">Live Orders</p>
                <h3 className="text-lg font-black tracking-tight select-none leading-none text-white metric-box-text">{filteredAdminActiveOrdersActive.length}</h3>
              </div>
              <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-black/25 rounded w-fit border border-white/5 mt-1"><div className="w-1 h-1 rounded-full bg-emerald-400 animate-ping shrink-0" /><span className="text-[5.5px] font-black tracking-widest text-[#a7f3d0] uppercase leading-none">Active</span></div>
            </div>

            {/* Total Items Card */}
            <div className="w-full bg-gradient-to-br from-[#015f3e] to-[#043324] rounded-2xl p-2.5 text-white shadow-lg flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
              <div>
                <p className="text-emerald-100 text-[6px] uppercase font-black tracking-widest mb-0.5 select-none w-full truncate">Total Items</p>
                <h3 className="text-lg font-black text-white tracking-tight leading-none metric-box-text">{products.length}</h3>
              </div>
              <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-black/25 rounded w-fit border border-white/5 mt-1"><span className="text-[5.5px] font-black tracking-widest text-[#a7f3d0] uppercase leading-none">Stock</span></div>
            </div>

            {/* Delivered Card */}
            <div className="w-full bg-gradient-to-br from-[#aa4403] via-[#853c02] to-[#4a1c02] rounded-2xl p-2.5 text-white shadow-lg flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden font-sans">
              <div>
                <p className="text-amber-100 text-[6px] uppercase font-black tracking-widest mb-0.5 select-none w-full truncate">Delivered</p>
                <h3 className="text-lg font-black text-white tracking-tight leading-none metric-box-text">{filteredAdminActiveOrdersHistory.length}</h3>
              </div>
              <div className="flex items-center space-x-0.5 px-1.5 py-0.5 border border-amber-400 bg-amber-500/10 rounded w-fit mt-1"><span className="text-[5.5px] font-black tracking-widest text-amber-200 uppercase leading-none">Success</span></div>
            </div>

            {/* Duty Card */}
            <div onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isSystemOnline) {
                setShowOfflineModal(true);
              } else {
                try {
                  await supabase.from('system_config').upsert({
                    id: 'config',
                    isSystemOnline: true,
                    systemReopenTime: null 
                  });
                  toast.success("System is now Online");
                } catch (e) { 
                  toast.error("Failed to toggle system duty");
                }
              }
            }} className={`w-full ${isSystemOnline ? 'bg-[#05402a]' : 'bg-slate-700'} rounded-2xl p-2.5 text-white shadow-lg flex flex-col justify-between min-h-[4.5rem] py-2 relative overflow-hidden cursor-pointer active:scale-95 transition-transform z-20 font-sans`}>
              <div className="flex justify-between items-start">
                <p className="text-slate-400 text-[6.5px] uppercase font-black tracking-widest mb-0.5 select-none w-full truncate">Duty</p>
                <div className="relative inline-flex items-center">
                  <div className={`w-5 h-2.5 rounded-full transition-colors relative ${isSystemOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}>
                    <div className={`absolute top-[1px] left-[1px] bg-white w-[8px] h-[8px] rounded-full transition-transform ${isSystemOnline ? 'translate-x-[10px]' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[13px] font-black text-white tracking-tight leading-none truncate metric-box-text">{isSystemOnline ? 'Online' : 'Offline'}</h3>
              </div>
              <div className="flex items-center space-x-0.5 py-0.5 w-fit mt-0.5">
                <span className="text-[5px] font-bold tracking-wider text-slate-300 uppercase leading-none">Tap to toggle</span>
              </div>
            </div>
          </div>
          <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-250 shadow-inner animate-fade-in overflow-x-auto no-scrollbar gap-1.5 max-w-sm mx-auto w-full">
            <TabButton active={activeTab === "orders"} onClick={() => setActiveTab("orders")} icon={<Package className="w-3.5 h-3.5" />} label="Orders" />
            <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")} icon={<Edit className="w-3.5 h-3.5" />} label="Inventory" />
            <TabButton active={activeTab === "shops"} onClick={() => setActiveTab("shops")} icon={<Globe className="w-3.5 h-3.5" />} label="Shops" />
          </div>
        </div>

        {activeTab === "orders" && <AdminOrdersTab orders={filteredOrdersActive} adminActiveOrders={filteredAdminActiveOrdersActive} riders={filteredRiders} busyRiders={busyRiders} updateOrderStatus={updateOrderStatus} isHistory={false} isLoadingActive={isLoadingActive} />}
        {activeTab === "history" && <AdminOrdersTab orders={filteredOrdersHistory} adminActiveOrders={filteredAdminActiveOrdersHistory} riders={filteredRiders} busyRiders={busyRiders} updateOrderStatus={updateOrderStatus} isHistory={true} />}
        {activeTab === "products" && <AdminInventoryTab products={filteredProducts} shops={filteredShops} startAdd={startAdd} toggleStock={toggleStock} handleDeleteProduct={handleDeleteProduct} startEdit={startEdit} isLoading={isLoading} isUpdatingStock={isUpdatingStock} />}
        {activeTab === "shops" && <AdminShopsTab shops={filteredShops} setEditingShop={setEditingShop} setNewShop={setNewShop} setShowAddShopModal={setShowAddShopModal} setConfirmModal={setConfirmModal} />}
      </div>
      <div className="pb-10"></div>
      <AdminMgmtModals
        showAddModal={showAddModal} setShowAddModal={setShowAddModal}
        editingProduct={editingProduct} setEditingProduct={setEditingProduct}
        newProduct={newProduct} setNewProduct={setNewProduct}
        handleAddProduct={handleAddProduct} handleImageUpload={handleImageUpload}
        shops={shops} showCategoryModal={showCategoryModal} setShowCategoryModal={setShowCategoryModal}
        editingCategory={editingCategory} setEditingCategory={setEditingCategory}
        newCat={newCat} setNewCat={setNewCat}
        handleSaveCategory={handleSaveCategory} showAddShopModal={showAddShopModal}
        setShowAddShopModal={setShowAddShopModal} editingShop={editingShop}
        newShop={newShop} setNewShop={setNewShop} handleSaveShop={handleSaveShop}
        isShopPhoneVerified={isShopPhoneVerified} setIsShopPhoneVerified={setIsShopPhoneVerified}
        shopOtpSent={shopOtpSent} setShopOtpSent={setShopOtpSent} shopOtpLoading={shopOtpLoading}
        handleSendShopOtp={handleSendShopOtp} shopOtpInput={shopOtpInput} setShopOtpInput={setShopOtpInput}
        confirmModal={confirmModal} setConfirmModal={setConfirmModal}
        handleDeleteShop={handleDeleteShop} handleToggleBlockShop={handleToggleBlockShop}
        showAdminProfileModal={showAdminProfileModal} setShowAdminProfileModal={setShowAdminProfileModal}
        adminOwnerPhoto={adminOwnerPhoto} setAdminOwnerPhoto={setAdminOwnerPhoto}
        adminOwnerName={adminOwnerName} setAdminOwnerName={setAdminOwnerName}
        adminOwnerRole={adminOwnerRole} setAdminOwnerRole={setAdminOwnerRole}
        imageSrc={imageSrc} setImageSrc={setImageSrc} crop={crop} setCrop={setCrop}
        zoom={zoom} setZoom={setZoom} onCropComplete={onCropComplete}
        createCroppedImage={createCroppedImage} setCropTarget={setCropTarget as any}
        showRiderModal={showRiderModal} setShowRiderModal={setShowRiderModal}
        editingRider={editingRider} setEditingRider={setEditingRider}
        newRider={newRider} setNewRider={setNewRider} handleSaveRider={handleSaveRider}
      />
      <AdminOfflineModal isOpen={showOfflineModal} onClose={() => setShowOfflineModal(false)} />
      <AnimatePresence>{showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}</AnimatePresence>
      <AnimatePresence>
        {imageSrc && (
          <div className="fixed inset-0 z-[300] bg-black flex flex-col font-sans">
            <div className="flex-1 relative">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
            </div>
            <div className="bg-white p-8 rounded-t-[3rem] sticky bottom-0 flex flex-col items-center">
              <h4 className="text-xl font-black text-gray-800 tracking-tight uppercase mb-6">Crop Photo</h4>
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full mb-8 accent-emerald-600" />
              <div className="flex w-full gap-4">
                <button onClick={() => setImageSrc(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400">Cancel</button>
                <button onClick={createCroppedImage} className="flex-[2] py-4 bg-emerald-600 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 flex items-center justify-center space-x-2"><CropIcon className="w-4 h-4" /><span>Use This Photo</span></button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-lg font-black text-[9.5px] uppercase tracking-wider transition-all cursor-pointer ${
      active 
        ? "bg-emerald-900 text-white border border-emerald-950/35 shadow-xs" 
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent"
    }`}>
      {icon}<span>{label}</span>
    </button>
  );
}
