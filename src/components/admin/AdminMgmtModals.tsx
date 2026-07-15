import React from 'react';
import ProductModal from './modals/ProductModal';
import CategoryModal from './modals/CategoryModal';
import ShopModal from './modals/ShopModal';
import ConfirmationModal from './modals/ConfirmationModal';
import AdminProfileModal from './modals/AdminProfileModal';
import ImageCropperModal from './modals/ImageCropperModal';
import RiderModal from './modals/RiderModal';

interface AdminMgmtModalsProps {
  // Product Modal
  showAddModal: boolean;
  setShowAddModal: (val: boolean) => void;
  editingProduct: any | null;
  setEditingProduct: (val: any | null) => void;
  newProduct: any;
  setNewProduct: React.Dispatch<React.SetStateAction<any>>;
  handleAddProduct: (e: React.FormEvent) => Promise<any> | any;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: any) => Promise<any> | any;
  shops: any[];

  // Category Modal
  showCategoryModal: boolean;
  setShowCategoryModal: (val: boolean) => void;
  editingCategory: any | null;
  setEditingCategory: (val: any | null) => void;
  newCat: any;
  setNewCat: React.Dispatch<React.SetStateAction<any>>;
  handleSaveCategory: () => Promise<any> | any;

  // Shop Modal
  showAddShopModal: boolean;
  setShowAddShopModal: (val: boolean) => void;
  editingShop: any | null;
  newShop: any;
  setNewShop: React.Dispatch<React.SetStateAction<any>>;
  handleSaveShop: (e: React.FormEvent) => Promise<any> | any;
  isShopPhoneVerified: boolean;
  setIsShopPhoneVerified: (val: boolean) => void;
  shopOtpSent: boolean;
  setShopOtpSent: (val: boolean) => void;
  shopOtpLoading: boolean;
  handleSendShopOtp: () => Promise<any> | any;
  shopOtpInput: string;
  setShopOtpInput: (val: string) => void;
  shopCaptchaSolved: boolean;

  // Confirmation Modal
  confirmModal: any;
  setConfirmModal: React.Dispatch<React.SetStateAction<any>>;
  handleDeleteShop: (shopId: string) => Promise<any> | any;
  handleToggleBlockShop: (shopObj: any) => Promise<any> | any;

  // Admin Profile Modal
  showAdminProfileModal: boolean;
  setShowAdminProfileModal: (val: boolean) => void;
  adminOwnerPhoto: string;
  setAdminOwnerPhoto: (val: string) => void;
  adminOwnerName: string;
  setAdminOwnerName: (val: string) => void;
  adminOwnerRole: string;
  setAdminOwnerRole: (val: string) => void;

  // Cropper helper
  imageSrc: string | null;
  setImageSrc: (val: string | null) => void;
  crop: any;
  setCrop: (val: any) => void;
  zoom: number;
  setZoom: (val: number) => void;
  onCropComplete: (croppedArea: any, croppedAreaPixels: any) => void;
  createCroppedImage: () => Promise<any> | any;
  setCropTarget: (val: string) => void;

  // Team Rider Modal
  showRiderModal: boolean;
  setShowRiderModal: (val: boolean) => void;
  editingRider: any | null;
  setEditingRider: (val: any | null) => void;
  newRider: any;
  setNewRider: React.Dispatch<React.SetStateAction<any>>;
  handleSaveRider: (e: React.FormEvent) => Promise<any> | any;
}

export default function AdminMgmtModals({
  showAddModal,
  setShowAddModal,
  editingProduct,
  setEditingProduct,
  newProduct,
  setNewProduct,
  handleAddProduct,
  handleImageUpload,
  shops,

  showCategoryModal,
  setShowCategoryModal,
  editingCategory,
  setEditingCategory,
  newCat,
  setNewCat,
  handleSaveCategory,

  showAddShopModal,
  setShowAddShopModal,
  editingShop,
  newShop,
  setNewShop,
  handleSaveShop,
  isShopPhoneVerified,
  setIsShopPhoneVerified,
  shopOtpSent,
  setShopOtpSent,
  shopOtpLoading,
  handleSendShopOtp,
  shopOtpInput,
  setShopOtpInput,
  shopCaptchaSolved,

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

  imageSrc,
  setImageSrc,
  crop,
  setCrop,
  zoom,
  setZoom,
  onCropComplete,
  createCroppedImage,
  setCropTarget,

  showRiderModal,
  setShowRiderModal,
  editingRider,
  setEditingRider,
  newRider,
  setNewRider,
  handleSaveRider,
}: AdminMgmtModalsProps) {

  return (
    <>
      <ProductModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        handleAddProduct={handleAddProduct}
        handleImageUpload={handleImageUpload}
        shops={shops}
      />

      <CategoryModal
        showCategoryModal={showCategoryModal}
        setShowCategoryModal={setShowCategoryModal}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        newCat={newCat}
        setNewCat={setNewCat}
        handleSaveCategory={handleSaveCategory}
      />

      <ShopModal
        showAddShopModal={showAddShopModal}
        setShowAddShopModal={setShowAddShopModal}
        editingShop={editingShop}
        newShop={newShop}
        setNewShop={setNewShop}
        handleSaveShop={handleSaveShop}
        isShopPhoneVerified={isShopPhoneVerified}
        setIsShopPhoneVerified={setIsShopPhoneVerified}
        shopOtpSent={shopOtpSent}
        setShopOtpSent={setShopOtpSent}
        shopOtpLoading={shopOtpLoading}
        handleSendShopOtp={handleSendShopOtp}
        shopOtpInput={shopOtpInput}
        setShopOtpInput={setShopOtpInput}
        shopCaptchaSolved={shopCaptchaSolved}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        shopName={confirmModal.shopName}
        shopId={confirmModal.shopId}
        shopObj={confirmModal.shopObj}
        currentStep={confirmModal.currentStep}
        setConfirmModal={setConfirmModal}
        handleDeleteShop={handleDeleteShop}
        handleToggleBlockShop={handleToggleBlockShop}
      />

      <AdminProfileModal
        showAdminProfileModal={showAdminProfileModal}
        setShowAdminProfileModal={setShowAdminProfileModal}
        adminOwnerPhoto={adminOwnerPhoto}
        setAdminOwnerPhoto={setAdminOwnerPhoto}
        adminOwnerName={adminOwnerName}
        setAdminOwnerName={setAdminOwnerName}
        adminOwnerRole={adminOwnerRole}
        setAdminOwnerRole={setAdminOwnerRole}
        setCropTarget={setCropTarget}
        setImageSrc={setImageSrc}
      />

      <ImageCropperModal
        imageSrc={imageSrc}
        setImageSrc={setImageSrc}
        crop={crop}
        setCrop={setCrop}
        zoom={zoom}
        setZoom={setZoom}
        onCropComplete={onCropComplete}
        createCroppedImage={createCroppedImage}
      />

      <RiderModal
        showRiderModal={showRiderModal}
        setShowRiderModal={setShowRiderModal}
        editingRider={editingRider}
        setEditingRider={setEditingRider}
        newRider={newRider}
        setNewRider={setNewRider}
        handleSaveRider={handleSaveRider}
      />
    </>
  );
}
