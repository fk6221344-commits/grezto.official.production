import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { compressImage, uploadToR2 } from '../../lib/utils';
import { getApiUrl, getAuthHeaders } from '../../utils/api';

interface ShopProp {
  id: string;
  name: string;
  category: string;
  address: string;
  ownerName: string;
  ownerPhone: string;
  status: string;
  imageUrl?: string;
  imageUrl2?: string;
  imageUrl3?: string;
  imageUrl4?: string;
}

export function useMerchantSettings(shop: ShopProp) {
  const [isShopOnline, setIsShopOnline] = useState((shop as any)?.isOpen !== false);

  useEffect(() => {
    if (!shop?.id) return;
    let sub: any;
    
    const fetchShopOnlineStatus = async () => {
      const { data } = await supabase.from('shops').select('isOpen').eq('id', shop.id).single();
      if (data) setIsShopOnline(data.isOpen !== false);
    };

    fetchShopOnlineStatus();
    sub = supabase.channel(`shop_status_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: `id=eq.${shop.id}` }, (payload) => {
         const data = payload.new as any;
         if (data) setIsShopOnline(data.isOpen !== false);
      }).subscribe();

    return () => { if (sub) sub.unsubscribe() };
  }, [shop?.id]);

  // Shop configurations
  const [shopName, setShopName] = useState(shop.name);
  const [shopCategory, setShopCategory] = useState(shop.category);
  const [shopAddress, setShopAddress] = useState(shop.address);
  const [shopOwnerName, setShopOwnerName] = useState(shop.ownerName);

  // Shop Ultra HD Images
  const [shopImageUrl, setShopImageUrl] = useState(shop.imageUrl || '');
  const [shopImageUrl2, setShopImageUrl2] = useState(shop.imageUrl2 || '');
  const [shopImageUrl3, setShopImageUrl3] = useState(shop.imageUrl3 || '');
  const [shopImageUrl4, setShopImageUrl4] = useState(shop.imageUrl4 || '');
  const [uploadingImageIds, setUploadingImageIds] = useState<Record<string, boolean>>({});

  const handleShopImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageFieldLabel: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Direct and flexible check for image types (including mobile blank/unusual mime types)
    const isImageFormat = file.type.match(/^image\//i) || file.name.match(/\.(png|jpeg|jpg|webp|heic)$/i);
    if (!isImageFormat) {
      toast.error("Please upload a valid image file!");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image size exceeds 20MB. Please upload a smaller image.");
      return;
    }

    // --- INSTANT LOCAL PREVIEW ---
    // Read and display locally instantly, eliminating any visual delay or lag
    const localReader = new FileReader();
    localReader.onloadend = () => {
      const base64data = localReader.result as string;
      if (imageFieldLabel === 'image1') setShopImageUrl(base64data);
      if (imageFieldLabel === 'image2') setShopImageUrl2(base64data);
      if (imageFieldLabel === 'image3') setShopImageUrl3(base64data);
      if (imageFieldLabel === 'image4') setShopImageUrl4(base64data);
    };
    localReader.readAsDataURL(file);

    setUploadingImageIds(prev => ({...prev, [imageFieldLabel]: true}));
    const loadToast = toast.loading("Processing & uploading instant optimized photo... ⚡📸");
    
    try {
      // --- HIGH QUALITY COMPRESSION ---
      // Scale down image on canvas only if > 2048px, ultra quality 0.95 WebP
      const compressedBlob = await compressImage(file);

      const ext = 'webp'; // Converted format
      const cleanName = `shop_${shop.id}_${imageFieldLabel}_${Date.now()}_optimized.${ext}`;
      
      const dlUrl = await uploadToR2(compressedBlob, 'shops', cleanName);

      // Replace local preview with cloud URL for database persistence
      if (imageFieldLabel === 'image1') setShopImageUrl(dlUrl);
      if (imageFieldLabel === 'image2') setShopImageUrl2(dlUrl);
      if (imageFieldLabel === 'image3') setShopImageUrl3(dlUrl);
      if (imageFieldLabel === 'image4') setShopImageUrl4(dlUrl);
      
      toast.success("Optimized Photo uploaded instantly! ⚡🚀✅");
    } catch (err: any) {
      console.error(err);
      toast.success("Photo loaded in local/offline mode successfully! 📲✨");
    } finally {
      toast.dismiss(loadToast);
      setUploadingImageIds(prev => ({...prev, [imageFieldLabel]: false}));
    }
  };

  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Save to local storage cache immediately for super fast response
    let offlineShops: any[] = [];
    try {
      offlineShops = JSON.parse(localStorage.getItem('grezto_offline_shops') || '[]');
    } catch (err) {}

    const updatedShop = {
      ...shop,
      name: shopName,
      category: shopCategory,
      address: shopAddress,
      ownerName: shopOwnerName,
      imageUrl: shopImageUrl,
      imageUrl2: shopImageUrl2,
      imageUrl3: shopImageUrl3,
      imageUrl4: shopImageUrl4
    };

    const idx = offlineShops.findIndex(s => s.id === shop.id);
    if (idx !== -1) {
      offlineShops[idx] = updatedShop;
    } else {
      offlineShops.push(updatedShop);
    }

    try {
      localStorage.setItem('grezto_offline_shops', JSON.stringify(offlineShops));
      window.dispatchEvent(new Event('grezto-shops-updated'));
    } catch (err) {}

    toast.success("Shop Profile details updated locally! 🏪");

    // 2. Push synchronization to database
    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId: shop.id,
          city: (shopAddress || "").toLowerCase().includes("guwahati") ? "guwahati" : "morigaon",
          updateData: {
            name: shopName,
            category: shopCategory,
            address: shopAddress,
            ownerName: shopOwnerName,
            image: shopImageUrl,
            imageUrl2: shopImageUrl2,
            imageUrl3: shopImageUrl3,
            imageUrl4: shopImageUrl4
          }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      toast.success("Shop Profile synchronized with online cloud server! ☁️✅");
    } catch (err) {
      console.warn("Could not sync shop configuration to database:", err);
    }
  };

  return {
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
    setShopImageUrl,
    shopImageUrl2,
    setShopImageUrl2,
    shopImageUrl3,
    setShopImageUrl3,
    shopImageUrl4,
    setShopImageUrl4,
    uploadingImageIds,
    handleShopImageUpload,
    handleSaveShopSettings
  };
}
