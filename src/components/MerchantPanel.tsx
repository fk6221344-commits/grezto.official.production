import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { unlockNotificationAudio } from '../services/notifications';
import ShopAnalytics from './ShopAnalytics';
import { useUser } from '../context/UserContext';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';

// Import split modular hooks
import { useMerchantSettings } from './merchant/useMerchantSettings';
import { useMerchantMenu } from './merchant/useMerchantMenu';
import { useMerchantOrders } from './merchant/useMerchantOrders';

// Import split modular components
import { MerchantOrdersTab } from './merchant/MerchantOrdersTab';
import { MerchantMenuTab } from './merchant/MerchantMenuTab';
import { MerchantSettingsTab } from './merchant/MerchantSettingsTab';
import MerchantSlideHistoryModal from './merchant/MerchantSlideHistoryModal';
import { MerchantAddMenuModal } from './merchant/MerchantAddMenuModal';
import { MerchantPanelHeader } from './merchant/MerchantPanelHeader';
import { MerchantMetricBanner } from './merchant/MerchantMetricBanner';

interface MerchantPanelProps {
  onClose: () => void;
  shop: {
    id: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
    category: string;
    address: string;
    status: string;
    imageUrl?: string;
    imageUrl2?: string;
    imageUrl3?: string;
    imageUrl4?: string;
  };
}

export default function MerchantPanel({ onClose, shop }: MerchantPanelProps) {
  const { firebaseAuthReady } = useUser();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'settings' | 'analytics'>('orders');
  const [showMerchantInfoMenu, setShowMerchantInfoMenu] = useState(false);
  const [showMerchantHistoryModal, setShowMerchantHistoryModal] = useState(false);

  // Modular custom hooks for state & actions

  const {
    isShopOnline,
    setIsShopOnline,
    shopName,
    setShopName,
    shopCategory,
    setShopCategory,
    shopAddress,
    setShopAddress,
    shopOwnerName,
    setShopOwnerName,
    shopImageUrl,
    shopImageUrl2,
    shopImageUrl3,
    shopImageUrl4,
    uploadingImageIds,
    handleShopImageUpload,
    handleSaveShopSettings
  } = useMerchantSettings(shop);

  const {
    products,
    isLoading,
    showAddMenuModal,
    setShowAddMenuModal,
    editingItem,
    setEditingItem,
    newItem,
    setNewItem,
    handleToggleStock,
    handleImageUpload,
    handleSaveMenuItem,
    handleDeleteItem,
    isSaving,
    isUploadingImage,
    isUpdatingStock
  } = useMerchantMenu(shop, firebaseAuthReady, shopName);

  const {
    orders,
    riders,
    busyRiders,
    mapsAuthError,
    handleUpdateStatus,
    loading
  } = useMerchantOrders(shop, firebaseAuthReady);

  // Catch native back button to dismiss any active merchant overlays cleanly
  useRegisterBackHandler(() => {
    if (showAddMenuModal) {
      setShowAddMenuModal(false);
      return true;
    }
    if (editingItem) {
      setEditingItem(null);
      return true;
    }
    if (showMerchantHistoryModal) {
      setShowMerchantHistoryModal(false);
      return true;
    }
    if (showMerchantInfoMenu) {
      setShowMerchantInfoMenu(false);
      return true;
    }
    return false;
  }, 35, [
    showAddMenuModal,
    editingItem,
    showMerchantHistoryModal,
    showMerchantInfoMenu
  ]);

  // Pre-emptive browser/Capacitor webview gesture unlock mechanism to guarantee 100% audio ringtone reliability
  useEffect(() => {
    const unlockChime = () => {
      try {
        unlockNotificationAudio();
        console.log("🏪 [Merchant Panel] User interaction detected, unlocked notification audio contexts!");
      } catch (e) {}
    };
    window.addEventListener('click', unlockChime, { passive: true });
    window.addEventListener('touchstart', unlockChime, { passive: true });
    return () => {
      window.removeEventListener('click', unlockChime);
      window.removeEventListener('touchstart', unlockChime);
    };
  }, []);

  // Instantly clear any trailing/lingering welcome or access toasts upon entering the Merchant Panel
  useEffect(() => {
    const timer = setTimeout(() => {
      toast.dismiss();
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  if (shop.status === 'blocked') {
    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 flex items-center justify-center rounded-3xl text-rose-600 mb-6 border border-rose-200 shadow-md">
          <X size={44} strokeWidth={3} />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Dashboard Blocked</h2>
        <p className="text-gray-500 font-semibold text-xs mt-3 max-w-sm leading-relaxed">
          Your shop/restaurant has been blocked by the Grezto Super Admin. Please contact support to resolve or re-activate!
        </p>
        <button 
          onClick={onClose}
          className="mt-8 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase py-4 px-8 rounded-2xl cursor-pointer shadow-lg outline-none border-0 hover:bg-slate-800"
        >
          Back to Profile
        </button>
      </div>
    );
  }

  // Calculate sum counts for active states vs history states
  const ordersActive = useMemo(() => {
    return orders.filter(o => {
       const status = String(o.status || '').toLowerCase().trim();
       return status !== 'delivered' && status !== 'cancelled';
    });
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders.filter(o => {
       const status = String(o.status || '').toLowerCase().trim();
       return status === 'delivered' || status === 'cancelled';
    });
  }, [orders]);

  // Calculate sum counts for widget previews (O(1) offline direct read!)
  const shopRevenue = Number((shop as any).totalRevenue || 0);

  return (
    <div className="w-full bg-slate-50 flex flex-col text-slate-800 pb-24">
      <MerchantPanelHeader 
        onClose={onClose}
        shopName={shopName}
        showMerchantInfoMenu={showMerchantInfoMenu}
        setShowMerchantInfoMenu={setShowMerchantInfoMenu}
        setShowMerchantHistoryModal={setShowMerchantHistoryModal}
      />

      <div className="max-w-xl mx-auto w-full px-5 pt-6 space-y-6">
        
        {/* Metric Cards Banner - Emerald Green & Organic Theme */}
        <MerchantMetricBanner 
          ordersActive={ordersActive}
          products={products}
          historyOrders={historyOrders}
          isShopOnline={isShopOnline}
          setIsShopOnline={setIsShopOnline}
          shop={shop}
        />

        {/* Tab Selection */}
        <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-250 shadow-inner gap-1">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 text-[9.5px] font-black text-center rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
              activeTab === 'orders' 
                ? 'bg-slate-900 text-white border-slate-950/35 shadow-xs' 
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            Orders ({ordersActive.length})
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2.5 text-[9.5px] font-black text-center rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
              activeTab === 'menu' 
                ? 'bg-slate-900 text-white border-slate-950/35 shadow-xs' 
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            Menu
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 text-[9.5px] font-black text-center rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-slate-900 text-white border-slate-950/35 shadow-xs' 
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            Profile
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-2.5 text-[9.5px] font-black text-center rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
              activeTab === 'analytics' 
                ? 'bg-slate-900 text-white border-slate-950/35 shadow-xs' 
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Tab Contents: ACTIVE Orders */}
        {activeTab === 'orders' && (
          <MerchantOrdersTab 
            orders={ordersActive}
            shop={shop}
            riders={riders}
            handleUpdateStatus={handleUpdateStatus}
            mapsAuthError={mapsAuthError}
            busyRiders={busyRiders}
            isHistory={false}
            isLoading={loading}
          />
        )}

        {/* Tab Contents: Shop PRODUCT Menu Inventory */}
        {activeTab === 'menu' && (
          <MerchantMenuTab 
            products={products}
            isLoading={isLoading}
            setEditingItem={setEditingItem}
            setNewItem={setNewItem}
            setShowAddMenuModal={setShowAddMenuModal}
            handleToggleStock={handleToggleStock}
            handleDeleteItem={handleDeleteItem}
            isUpdatingStock={isUpdatingStock}
          />
        )}

        {/* Tab Contents: Analytics */}
        {activeTab === 'analytics' && (
          <ShopAnalytics orders={historyOrders} shopId={shop.id} />
        )}

        {/* Tab Contents: Shop Settings PROFILE */}
        {activeTab === 'settings' && (
          <MerchantSettingsTab 
            handleSaveShopSettings={handleSaveShopSettings}
            shopName={shopName}
            setShopName={setShopName}
            shopCategory={shopCategory}
            setShopCategory={setShopCategory}
            shopOwnerName={shopOwnerName}
            setShopOwnerName={setShopOwnerName}
            shopAddress={shopAddress}
            setShopAddress={setShopAddress}
            shopImageUrl={shopImageUrl}
            handleShopImageUpload={handleShopImageUpload}
            shop={shop}
          />
        )}
      </div>

      {/* Add / Edit Menu Item FORM MODAL */}
      <MerchantAddMenuModal
        showAddMenuModal={showAddMenuModal}
        setShowAddMenuModal={setShowAddMenuModal}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        newItem={newItem}
        setNewItem={setNewItem}
        handleSaveMenuItem={handleSaveMenuItem}
        handleImageUpload={handleImageUpload}
        isSaving={isSaving}
        isUploadingImage={isUploadingImage}
      />

      {/* Merchant History Slide Up Modal */}
      <MerchantSlideHistoryModal
        showMerchantHistoryModal={showMerchantHistoryModal}
        setShowMerchantHistoryModal={setShowMerchantHistoryModal}
        historyOrders={historyOrders}
        shop={shop}
        riders={riders}
        handleUpdateStatus={handleUpdateStatus}
        mapsAuthError={mapsAuthError}
        busyRiders={busyRiders}
      />
    </div>
  );
}
