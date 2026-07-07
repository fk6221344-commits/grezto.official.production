import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { compressImage, uploadToR2 } from '../../lib/utils';
import { getApiUrl, getAuthHeaders } from '../../utils/api';
import { triggerCacheFlush } from '../../utils/cacheApi';

interface ShopProps {
  id: string;
  name: string;
}

export function useMerchantMenu(shop: ShopProps, firebaseAuthReady: boolean, shopName: string) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: '',
    imageUrl: '',
    description: '',
    unit: '1 serving',
    stock: 15
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // 2. Listen to all products belonging to this shop, merging with offline products seamlessly
  useEffect(() => {
    if (!firebaseAuthReady) return;
    const mergeProducts = (dbProds: any[]) => {
      const dbIds = new Set(dbProds.map(p => p.id));
      const deletedIds = new Set(
        dbProds.filter(p => (p as any).deleted).map(p => p.id)
      );

      const combined = [
        ...dbProds.filter(p => p.shopId === shop.id && !(p as any).deleted && !deletedIds.has(p.id))
      ].map(p => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : (p.inStock ? 15 : 0)
      }));

      setProducts(combined);
    };

    let sub: any;

    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(getApiUrl(`/api/products?shopId=${shop.id}`));
        if (res.ok) {
          const resData = await res.json();
          const data = resData.products;
          if (data) {
            mergeProducts(data);
          } else {
            mergeProducts([]);
          }
        } else {
          mergeProducts([]);
        }
      } catch (e) {
        console.warn("Failed fetching shop products via cache API:", e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
    
    sub = supabase.channel(`shop_products_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `shopId=eq.${shop.id}` }, (payload) => {
        console.log('[MERCHANT CDC UPDATE] Received product change:', payload);
        const eventType = payload.eventType;
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;

        setProducts((prev) => {
          let updatedList = [...prev];
          const sanitizedRecord = newRecord ? {
            ...newRecord,
            stock: newRecord.stock !== undefined ? newRecord.stock : (newRecord.inStock ? 15 : 0)
          } : null;

          if (eventType === "INSERT") {
            if (sanitizedRecord && sanitizedRecord.shopId === shop.id && !sanitizedRecord.deleted && !updatedList.some(p => p.id === sanitizedRecord.id)) {
              updatedList = [sanitizedRecord, ...updatedList];
            }
          } else if (eventType === "UPDATE") {
            if (sanitizedRecord) {
              if (sanitizedRecord.deleted || sanitizedRecord.shopId !== shop.id) {
                updatedList = updatedList.filter(p => p.id !== sanitizedRecord.id);
              } else {
                const idx = updatedList.findIndex(p => p.id === sanitizedRecord.id);
                if (idx !== -1) {
                  updatedList[idx] = { ...updatedList[idx], ...sanitizedRecord };
                } else {
                  updatedList = [sanitizedRecord, ...updatedList];
                }
              }
            }
          } else if (eventType === "DELETE") {
            updatedList = updatedList.filter(p => p.id !== oldRecord.id);
          }
          return updatedList;
        });
      }).subscribe();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [shop.id, firebaseAuthReady]);

  // Toggle item stock state
  const handleToggleStock = async (prodId: string, currentStock: number) => {
    const newStock = currentStock > 0 ? 0 : 15;
    const targetProduct = products.find(p => p.id === prodId);
    const category = targetProduct ? targetProduct.category : undefined;

    setProducts(prev => prev.map(p => p.id === prodId ? { ...p, stock: newStock } : p));
    toast.success(newStock > 0 ? "Product is back in stock! 🥦" : "Product marked out of stock 🚫");

    try {
      const response = await fetch(getApiUrl('/api/products/toggle-stock'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productId: prodId,
          inStock: newStock > 0,
          shopId: shop.id,
          category
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (e) {
      console.warn("Cloud stock updates failed or deferred:", e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImageFormat = file.type.match(/^image\//i) || file.name.match(/\.(png|jpeg|jpg|webp|heic)$/i);
    if (!isImageFormat) {
      toast.error("Please upload a valid image file!");
      return;
    }

    if (file.size > 2.8 * 1024 * 1024) {
      toast.error(
        React.createElement('div', { className: 'text-left font-sans py-1' },
          React.createElement('div', { className: 'font-bold text-red-600 text-sm' }, '🛑 Upload Blocked: File Too Large!'),
          React.createElement('div', { className: 'text-xs text-gray-600 mt-1.5 leading-relaxed' }, 'To keep the experience super fast for your customers, product photos are limited to a maximum of 2.8MB. Please compress your image or choose a smaller file.')
        ),
        { duration: 6000 }
      );
      return;
    }

    const localReader = new FileReader();
    localReader.onloadend = () => {
      const base64data = localReader.result as string;
      setNewItem(prev => ({ ...prev, imageUrl: base64data }));
    };
    localReader.readAsDataURL(file);

    setIsUploadingImage(true);
    const loadToast = toast.loading("Uploading optimized product photo... ⏳✨");
    try {
      const ext = 'webp';
      const cleanName = `prod_${shop.id}_${Date.now()}_optimized.${ext}`;
      
      const compressedBlob = await compressImage(file, 2048, 0.95);
      
      const dlUrl = await uploadToR2(compressedBlob, 'products', cleanName);

      setNewItem(prev => ({ ...prev, imageUrl: dlUrl }));
      toast.success("Product photo updated successfully! 📸✨");
    } catch (err: any) {
      console.error(err);
      // Fallback: Generate a high quality compressed base64 string to prevent database bloating
      try {
        const compressedBlobForLocal = await compressImage(file, 2048, 0.95);
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewItem(prev => ({ ...prev, imageUrl: reader.result as string }));
        };
        reader.readAsDataURL(compressedBlobForLocal);
      } catch (compressErr) {
        console.warn("Could not generate compressed base64 preview, keeping raw", compressErr);
      }
      toast.success("Photo loaded in offline draft mode! 📲✨");
    } finally {
      setIsUploadingImage(false);
      toast.dismiss(loadToast);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) {
      toast.error("Product name & price are required!");
      return;
    }

    if (isUploadingImage) {
      toast.error("Please wait! Image upload is still in progress... ⏳📸");
      return;
    }

    setIsSaving(true);
    const targetId = editingItem ? editingItem.id : 'm_' + Date.now();
    let finalImageUrl = newItem.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
    
    if (finalImageUrl.startsWith("data:image")) {
      try {
        const response = await fetch(finalImageUrl);
        const blob = await response.blob();
        const ext = finalImageUrl.substring(finalImageUrl.indexOf('/') + 1, finalImageUrl.indexOf(';base64')) || 'jpg';
        const cleanName = `prod_sync_${shop.id}_${Date.now()}.${ext}`;
        
        finalImageUrl = await uploadToR2(blob, 'products', cleanName);
      } catch (err) {
        // Base64 sync upload to storage failed, holding locally
      }
    }

    const productData = {
      id: targetId,
      name: newItem.name,
      price: Number(newItem.price),
      originalPrice: Number(newItem.price) * 1.1,
      discount: 10,
      category: newItem.category,
      image: finalImageUrl,
      description: newItem.description,
      inStock: Number(newItem.stock) > 0,
      shopId: shop.id,
      shopName: shopName,
      rating: 5.0,
      isBestSeller: false,
      status: 'Active',
      deleted: false
    };

    // Optimistic Update: Instantly update local state products so it appears on screen without delay
    setProducts(prev => {
      const exists = prev.some(p => p.id === targetId);
      if (exists) {
        return prev.map(p => p.id === targetId ? { ...p, ...productData } : p);
      } else {
        return [productData, ...prev];
      }
    });

    toast.success(editingItem ? "Menu item updated! 📝" : "New product published! ✅🥦");
    setShowAddMenuModal(false);
    setEditingItem(null);
    setNewItem({
      name: '',
      price: '',
      category: '',
      imageUrl: '',
      description: '',
      unit: '1 serving',
      stock: 15
    });

    try {
      const response = await fetch(getApiUrl('/api/products/upsert'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ productData })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err: any) {
      console.warn("Could not sync product data to database:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (prodId: string) => {
    const targetProduct = products.find(p => p.id === prodId);
    const category = targetProduct ? targetProduct.category : undefined;

    setProducts(prev => prev.filter(p => p.id !== prodId));
    toast.success("Menu item removed ✅");

    try {
      const response = await fetch(getApiUrl('/api/products/delete'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productId: prodId,
          shopId: shop.id,
          category
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.warn("Cloud delete failed or deferred:", err);
    }
  };

  return {
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
    isUploadingImage
  };
}
