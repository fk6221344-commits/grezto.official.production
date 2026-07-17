import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import AdminAnalytics from './AdminAnalytics';
import MerchantCalculation from './MerchantCalculation';
import AIChatModal from './AIChatModal';
import ProfileHeader from './profile/ProfileHeader';
import ProfileAddressBook from './profile/ProfileAddressBook';
import ProfileModals from './profile/ProfileModals';
import ProfileImageCropper from './profile/ProfileImageCropper';
import ProfileRewardsModal from './profile/ProfileRewardsModal';
import ProfileReferral from './profile/ProfileReferral';
import ProfileMenuList from './profile/ProfileMenuList';
import ProfileConsoleButtons from './profile/ProfileConsoleButtons';
import ServerConfigModal from './profile/ServerConfigModal';

import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';
import toast from 'react-hot-toast';
import { getApiUrl, getAuthHeaders } from '../utils/api';

import { useProfileStats } from './profile/hooks/useProfileStats';
import { useProfileAuth } from './profile/hooks/useProfileAuth';
import { useProfileAddress } from './profile/hooks/useProfileAddress';

export default function Profile({ 
  onAdminClick, 
  onMerchantClick, 
  onBack,
  onOpenAnalytics,
  onOpenCalculation,
  onRiderClick,
  onRiderManagementClick,
  onlyModals = false
}: { 
  onAdminClick: () => void; 
  onMerchantClick: (shop: any) => void; 
  onBack?: () => void;
  onOpenAnalytics?: () => void;
  onOpenCalculation?: () => void;
  onRiderClick?: () => void;
  onRiderManagementClick?: () => void;
  onlyModals?: boolean;
}) {
  const { user, logout, updateProfile, userShop, redeemVoucher } = useUser();
  const { language, setLanguage } = useLanguage();

  // Load Custom Hooks for Refactored Logic Modules
  const { statsOrdersCount, statsDeliveredCount, statsTotalSpent } = useProfileStats();
  
  const {
    showLoginModal,
    setShowLoginModal,
    loginPhone,
    setLoginPhone,
    loginName,
    setLoginName,
    otpCode,
    setOtpCode,
    authLoading,
    setAuthLoading,
    authMode,
    setAuthMode,
    isOtpSent,
    setIsOtpSent,
    resendTimer,
    handleSendOtpInline,
    handleVerifyAndLogin
  } = useProfileAuth();

  const {
    isEditingAddress,
    setIsEditingAddress,
    addrState,
    setAddrState,
    addrCity,
    setAddrCity,
    addrStreetArea,
    setAddrStreetArea,
    savedAddresses,
    showAddNewAddress,
    setShowAddNewAddress,
    handleSaveAddress,
    handleSelectAddress,
    handleDeleteAddress
  } = useProfileAddress();

  // Local Profile UI States
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showMerchantCalculationModal, setShowMerchantCalculationModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showServerConfigModal, setShowServerConfigModal] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Back Key Interceptor
  useRegisterBackHandler(() => {
    if (showServerConfigModal) {
      setShowServerConfigModal(false);
      return true;
    }
    if (showAIChat) {
      setShowAIChat(false);
      return true;
    }
    if (cropImageSrc) {
      setCropImageSrc(null);
      return true;
    }
    if (showRewardsModal) {
      setShowRewardsModal(false);
      return true;
    }
    if (showAboutModal) {
      setShowAboutModal(false);
      return true;
    }
    if (showSignOutConfirm) {
      setShowSignOutConfirm(false);
      return true;
    }
    if (showPinModal) {
      setShowPinModal(false);
      return true;
    }
    if (showLoginModal) {
      setShowLoginModal(false);
      return true;
    }
    if (showAddNewAddress) {
      setShowAddNewAddress(false);
      return true;
    }
    if (isEditingAddress) {
      setIsEditingAddress(false);
      return true;
    }
    if (isEditing) {
      setIsEditing(false);
      return true;
    }
    return false;
  }, 30, [
    showServerConfigModal,
    showAIChat,
    cropImageSrc,
    showRewardsModal,
    showAboutModal,
    showSignOutConfirm,
    showPinModal,
    showLoginModal,
    showAddNewAddress,
    isEditingAddress,
    isEditing
  ]);

  // Avatar upload / scale handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImageFormat = file.type.match(/^image\//i) || file.name.match(/\.(png|jpeg|jpg|webp|heic)$/i);
      if (!isImageFormat) {
        return toast.error("Please upload a valid image file!");
      }
      if (file.size > 20 * 1024 * 1024) {
        return toast.error("Image size exceeds 20MB. Please upload a smaller image.");
      }

      toast.loading("Processing image...", { id: "image-processing" });
      const reader = new FileReader();

      reader.onloadend = () => {
        const originalBase64 = reader.result as string;
        
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = w;
          tempCanvas.height = h;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0, w, h);
            try {
              const downscaledBase64 = tempCanvas.toDataURL('image/jpeg', 0.85);
              setCropImageSrc(downscaledBase64);
            } catch (err) {
              setCropImageSrc(originalBase64);
            }
          } else {
            setCropImageSrc(originalBase64);
          }

          toast.dismiss("image-processing");
        };

        img.onerror = () => {
          setCropImageSrc(originalBase64);
          toast.dismiss("image-processing");
        };

        img.src = originalBase64;
      };

      reader.onerror = () => {
        toast.error("Failed to load image file.");
        toast.dismiss("image-processing");
      };

      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleSaveName = () => {
    updateProfile({ name: editName });
    setIsEditing(false);
    toast.success("Profile Updated");
  };

  const handlePinSubmit = async () => {
    if (pinInput.length !== 4) {
      toast.error("Please enter a 4-digit PIN!");
      return;
    }
    
    if (isSettingNewPin) {
      try {
        const response = await fetch(getApiUrl('/api/shops/update'), {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            shopId: userShop.id,
            city: userShop.city,
            updateData: { pin: pinInput }
          })
        });
        if (!response.ok) {
          throw new Error('Server returned error status');
        }
        toast.dismiss();
        toast.success("Security PIN Saved Successfully! 🔒✅", { duration: 1500 });
        setShowPinModal(false);
        onMerchantClick({ ...userShop, pin: pinInput });
      } catch (err: any) {
        toast.error("Failed to set PIN: " + err.message);
      }
    } else {
      if (pinInput === userShop?.pin) {
        toast.dismiss();
        toast.success("Identity Verified! Opening Merchant Panel... 🔓", { duration: 1500 });
        setShowPinModal(false);
        onMerchantClick(userShop);
      } else {
        toast.error("Invalid Security PIN Code! ❌ Please recheck.");
        setPinInput('');
      }
    }
  };

  if (onlyModals) {
    return (
      <ProfileModals
        showLoginModal={showLoginModal}
        setShowLoginModal={setShowLoginModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginName={loginName}
        setLoginName={setLoginName}
        loginPhone={loginPhone}
        setLoginPhone={setLoginPhone}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        authLoading={authLoading}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        resendTimer={resendTimer}
        handleSendOtpInline={handleSendOtpInline}
        handleVerifyAndLogin={handleVerifyAndLogin}
        showAboutModal={showAboutModal}
        setShowAboutModal={setShowAboutModal}
        showSignOutConfirm={showSignOutConfirm}
        setShowSignOutConfirm={setShowSignOutConfirm}
        logout={logout}
        showPinModal={showPinModal}
        setShowPinModal={setShowPinModal}
        isSettingNewPin={isSettingNewPin}
        pinInput={pinInput}
        setPinInput={setPinInput}
        userShop={userShop}
        handlePinSubmit={handlePinSubmit}
      />
    );
  }

  return (
    <div className="bg-white font-sans overflow-visible">
      <ProfileHeader
        onBack={onBack}
        language={language}
        setLanguage={setLanguage}
        user={user}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        editName={editName}
        setEditName={setEditName}
        handleSaveName={handleSaveName}
        handleAvatarChange={handleAvatarChange}
        setAuthMode={setAuthMode}
        setLoginName={setLoginName}
        setLoginPhone={setLoginPhone}
        setOtpCode={setOtpCode}
        setIsOtpSent={setIsOtpSent}
        setShowLoginModal={setShowLoginModal}
        statsOrdersCount={statsOrdersCount}
        statsDeliveredCount={statsDeliveredCount}
        statsTotalSpent={statsTotalSpent}
      />

      <div className="space-y-3 pb-6">
        <ProfileReferral user={user} />

        <div className="px-1 py-1 space-y-3">
          <ProfileMenuList
            user={user}
            showAddNewAddress={showAddNewAddress}
            setShowAddNewAddress={setShowAddNewAddress}
            setIsEditingAddress={setIsEditingAddress}
            setShowAIChat={setShowAIChat}
            setShowSignOutConfirm={setShowSignOutConfirm}
            setShowAboutModal={setShowAboutModal}
            onServerConfigClick={() => setShowServerConfigModal(true)}
          />

          <ProfileConsoleButtons
            user={user}
            userShop={userShop}
            onAdminClick={onAdminClick}
            onOpenAnalytics={onOpenAnalytics}
            setShowAnalyticsModal={setShowAnalyticsModal}
            onRiderManagementClick={onRiderManagementClick}
            onMerchantClick={onMerchantClick}
            onOpenCalculation={onOpenCalculation}
            setShowMerchantCalculationModal={setShowMerchantCalculationModal}
            onRiderClick={onRiderClick}
          />
        </div>
      </div>

      <ProfileAddressBook
        user={user}
        isEditingAddress={isEditingAddress}
        setIsEditingAddress={setIsEditingAddress}
        savedAddresses={savedAddresses}
        handleSelectAddress={handleSelectAddress}
        handleDeleteAddress={handleDeleteAddress}
        showAddNewAddress={showAddNewAddress}
        setShowAddNewAddress={setShowAddNewAddress}
        addrState={addrState}
        setAddrState={setAddrState}
        addrCity={addrCity}
        setAddrCity={setAddrCity}
        addrStreetArea={addrStreetArea}
        setAddrStreetArea={setAddrStreetArea}
        handleSaveAddress={handleSaveAddress}
      />

      {/* Footer */}
      <div className="flex flex-col items-center pt-1.5 pb-0">
         <p className="text-[8px] text-gray-400 font-extrabold uppercase tracking-widest">Grezto v1.0.0 — Delivering happiness 🌿</p>
      </div>

      <ProfileModals
        showLoginModal={showLoginModal}
        setShowLoginModal={setShowLoginModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginName={loginName}
        setLoginName={setLoginName}
        loginPhone={loginPhone}
        setLoginPhone={setLoginPhone}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        authLoading={authLoading}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        resendTimer={resendTimer}
        handleSendOtpInline={handleSendOtpInline}
        handleVerifyAndLogin={handleVerifyAndLogin}
        showAboutModal={showAboutModal}
        setShowAboutModal={setShowAboutModal}
        showSignOutConfirm={showSignOutConfirm}
        setShowSignOutConfirm={setShowSignOutConfirm}
        logout={logout}
        showPinModal={showPinModal}
        setShowPinModal={setShowPinModal}
        isSettingNewPin={isSettingNewPin}
        pinInput={pinInput}
        setPinInput={setPinInput}
        userShop={userShop}
        handlePinSubmit={handlePinSubmit}
      />

      <ProfileImageCropper
        cropImageSrc={cropImageSrc}
        setCropImageSrc={setCropImageSrc}
        user={user}
        updateProfile={updateProfile}
      />
      
      {/* Admin Analytics Modal */}
      <AnimatePresence>
        {showAnalyticsModal && (
          <AdminAnalytics onClose={() => setShowAnalyticsModal(false)} />
        )}
      </AnimatePresence>

      {/* Merchant Calculation Modal */}
      <AnimatePresence>
        {showMerchantCalculationModal && userShop && (
          <MerchantCalculation shop={userShop} onClose={() => setShowMerchantCalculationModal(false)} />
        )}
      </AnimatePresence>

      {/* Rewards Modal */}
      <AnimatePresence>
        {showRewardsModal && (
          <ProfileRewardsModal 
            isOpen={showRewardsModal} 
            onClose={() => setShowRewardsModal(false)} 
            user={user} 
            redeemVoucher={redeemVoucher} 
          />
        )}
      </AnimatePresence>

      {/* Help & Support Modal */}
      <AIChatModal 
        isOpen={showAIChat} 
        onClose={() => setShowAIChat(false)} 
      />

      {/* Developer Server Config Modal */}
      <AnimatePresence>
        {showServerConfigModal && (
          <ServerConfigModal 
            isOpen={showServerConfigModal} 
            onClose={() => setShowServerConfigModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
