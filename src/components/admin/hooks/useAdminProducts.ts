import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../services/supabase";
import { compressImage, uploadToR2 } from "../../../lib/utils";
import toast from "react-hot-toast";
import { getApiUrl, getAuthHeaders } from "../../../utils/api";
import { triggerCacheFlush } from "../../../utils/cacheApi";

export function useAdminProducts(
  isAuthenticated: boolean,
  firebaseAuthReady: boolean,
  adminSelectedCityFilter: string,
  localTick: number,
  setLocalTick: React.Dispatch<React.SetStateAction<number>>,
  setAdminOwnerPhoto: React.Dispatch<React.SetStateAction<string>>,
) {
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    category: "",
    imageUrl: "",
    imageUrl2: "",
    imageUrl3: "",
    imageUrl4: "",
    imageUrl5: "",
    description: "",
    unit: "1kg",
    stock: 10,
    shopId: "",
    shopName: "",
    city: "",
  });

  useEffect(() => {
    if (!isAuthenticated || !firebaseAuthReady || !supabase) return;

    const handleLocalUpdate = () => {
      setLocalTick((t) => t + 1);
    };
    window.addEventListener("grezto-products-updated", handleLocalUpdate);

    let sub: any;

    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(getApiUrl('/api/products?category=All'));
        if (res.ok) {
          const resData = await res.json();
          const data = resData.products;
          if (data) {
            const mapped = data.map((p: any) => ({
              ...p,
              stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
            }));
            setDbProducts(mapped);
          }
        }

        sub = supabase
          .channel(`admin_products_stream_${Math.random()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "products" },
            (payload) => {
              console.log("[ADMIN CDC UPDATE] Received product change:", payload);
              const eventType = payload.eventType;
              const newRecord = payload.new as any;
              const oldRecord = payload.old as any;

              setDbProducts((prev) => {
                let updatedList = [...prev];
                const sanitizedRecord = newRecord ? {
                  ...newRecord,
                  stock: newRecord.stock !== undefined ? newRecord.stock : (newRecord.inStock ? 10 : 0)
                } : null;

                if (eventType === "INSERT") {
                  if (sanitizedRecord && !updatedList.some((p) => p.id === sanitizedRecord.id)) {
                    updatedList = [sanitizedRecord, ...updatedList];
                  }
                } else if (eventType === "UPDATE") {
                  if (sanitizedRecord) {
                    const idx = updatedList.findIndex((p) => p.id === sanitizedRecord.id);
                    if (idx !== -1) {
                      updatedList[idx] = { ...updatedList[idx], ...sanitizedRecord };
                    } else {
                      updatedList = [sanitizedRecord, ...updatedList];
                    }
                  }
                } else if (eventType === "DELETE") {
                  updatedList = updatedList.filter((p) => p.id !== oldRecord.id);
                }
                return updatedList;
              });
            },
          )
          .subscribe();
      } catch (error) {
        console.warn(
          "Supabase products stream offline or unconfigured:",
          error,
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();

    return () => {
      if (sub) sub.unsubscribe();
      window.removeEventListener("grezto-products-updated", handleLocalUpdate);
    };
  }, [isAuthenticated, firebaseAuthReady, setLocalTick]);

  const products = useMemo(() => {
    const dbIds = new Set(dbProducts.map((p) => p.id));
    const deletedIds = new Set(
      dbProducts.filter((p) => p.deleted).map((p) => p.id),
    );

    const combined = [...dbProducts.filter((p) => !p.deleted)];

    const productsMap: any[] = [];
    const seenIds = new Set<string>();
    for (const p of combined) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        productsMap.push(p);
      }
    }

    productsMap.sort((a, b) => {
      const aStock = typeof a.stock === "number" ? a.stock : 10;
      const bStock = typeof b.stock === "number" ? b.stock : 10;
      const aInStock = aStock > 0;
      const bInStock = bStock > 0;
      if (aInStock && !bInStock) return -1;
      if (!aInStock && bInStock) return 1;
      return 0;
    });

    return productsMap;
  }, [dbProducts, localTick]);

  const filteredProducts = useMemo(() => {
    if (adminSelectedCityFilter === "All") return products;
    return products.filter((p: any) => {
      if (!p.city) return true;
      return p.city.toLowerCase() === adminSelectedCityFilter.toLowerCase();
    });
  }, [products, adminSelectedCityFilter]);

  const toggleStock = async (productId: string, currentStock: number) => {
    const newStock = currentStock > 0 ? 0 : 10;
    
    // Optimistic local update
    setDbProducts((prev) => 
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock, inStock: newStock > 0 } : p))
    );
    toast.success(newStock > 0 ? "Product is back in stock! 🥦" : "Product marked out of stock 🚫");

    const targetProduct = dbProducts.find(p => p.id === productId);
    const shopId = targetProduct ? targetProduct.shopId : undefined;
    const category = targetProduct ? targetProduct.category : undefined;

    try {
      const response = await fetch(getApiUrl('/api/products/toggle-stock'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productId,
          inStock: newStock > 0,
          shopId,
          category
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (e) {
      console.error(e);
      // Revert if API call fails
      setDbProducts((prev) => 
        prev.map((p) => (p.id === productId ? { ...p, stock: currentStock, inStock: currentStock > 0 } : p))
      );
      toast.error("Failed to update stock status");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingProduct ? editingProduct.id : "p_" + Date.now();
    const loadToast = toast.loading("Saving product details... 💾🌩️");

    try {
      const uploadBase64ToStorage = async (imgUrl: string, index: number) => {
        if (!imgUrl || !imgUrl.startsWith("data:image")) return imgUrl;
        
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        const ext = imgUrl.substring(
          imgUrl.indexOf("/") + 1,
          imgUrl.indexOf(";base64"),
        );
        const cleanName = `p_sync_${targetId}_${index}_${Date.now()}.${ext || "png"}`;

        try {
          return await uploadToR2(blob, "products", cleanName);
        } catch (err: any) {
          console.warn(`Storage upload failed for image ${index}, falling back to local preview:`, err);
          toast.error(`Image ${index} upload failed, saved in local preview mode.`);
          return imgUrl;
        }
      };

      const finalImg1 = await uploadBase64ToStorage(
        newProduct.imageUrl || "",
        1,
      );
      const finalImg2 = await uploadBase64ToStorage(
        newProduct.imageUrl2 || "",
        2,
      );
      const finalImg3 = await uploadBase64ToStorage(
        newProduct.imageUrl3 || "",
        3,
      );
      const finalImg4 = await uploadBase64ToStorage(
        newProduct.imageUrl4 || "",
        4,
      );
      const finalImg5 = await uploadBase64ToStorage(
        newProduct.imageUrl5 || "",
        5,
      );

      const productData = {
        ...newProduct,
        imageUrl: finalImg1,
        imageUrl2: finalImg2,
        imageUrl3: finalImg3,
        imageUrl4: finalImg4,
        imageUrl5: finalImg5,
        price: Number(newProduct.price),
        id: targetId,
        city:
          newProduct.city ||
          (adminSelectedCityFilter !== "All" ? adminSelectedCityFilter : ""),
        updatedAt: new Date().toISOString(),
      };

      try {
        const supaProd = {
          id: targetId,
          shopId: productData.shopId || "direct",
          shopName: productData.shopName || "Grezto VIP",
          name: productData.name,
          description: productData.description || "",
          price: Number(productData.price) || 0,
          originalPrice: Number(productData.price) * 1.1,
          discount: 10,
          image:
            productData.imageUrl && productData.imageUrl.startsWith("data:")
              ? ""
              : productData.imageUrl,
          category: productData.category,
          rating: 5.0,
          isBestSeller: false,
          inStock: productData.stock > 0,
          status: "Active",
        };

        const response = await fetch(getApiUrl('/api/products/upsert'), {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ productData: supaProd })
        });
        if (!response.ok) {
          throw new Error('Server returned error status');
        }
      } catch (e: any) {
        console.warn("Server upsert sync failed", e);
      }

      toast.success("Updated instantly!");
      setShowAddModal(false);
      setEditingProduct(null);
      setNewProduct({
        name: "",
        price: "",
        category: "",
        imageUrl: "",
        imageUrl2: "",
        imageUrl3: "",
        imageUrl4: "",
        imageUrl5: "",
        description: "",
        unit: "1kg",
        stock: 10,
        shopId: "",
        shopName: "",
        city: "",
      });
    } catch (globalErr: any) {
      console.error("Add product global error:", globalErr);
      toast.error(globalErr.message || "An error occurred while saving the product.");
    } finally {
      toast.dismiss(loadToast);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const prevProducts = [...dbProducts];
    
    // Optimistically remove from state
    setDbProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Product deleted permanently!");

    const targetProduct = prevProducts.find(p => p.id === id);
    const shopId = targetProduct ? targetProduct.shopId : undefined;
    const category = targetProduct ? targetProduct.category : undefined;

    try {
      const response = await fetch(getApiUrl('/api/products/delete'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          productId: id,
          shopId,
          category
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (e: any) {
      console.warn("Delete failed", e);
      // Revert state if api fails
      setDbProducts(prevProducts);
      toast.error("Failed to delete product. Please try again.");
    }
  };

  const startAdd = () => {
    setEditingProduct(null);
    setNewProduct({
      name: "",
      price: "",
      category: "",
      imageUrl: "",
      imageUrl2: "",
      imageUrl3: "",
      imageUrl4: "",
      imageUrl5: "",
      description: "",
      unit: "1kg",
      stock: 10,
      shopId: "",
      shopName: "",
      city: "",
    });
    setShowAddModal(true);
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: product.price?.toString() || "",
      category: product.category,
      imageUrl: product.image || product.imageUrl || "",
      imageUrl2: product.imageUrl2 || "",
      imageUrl3: product.imageUrl3 || "",
      imageUrl4: product.imageUrl4 || "",
      imageUrl5: product.imageUrl5 || "",
      description: product.description || "",
      unit: product.unit || "1kg",
      stock: product.stock,
      shopId: product.shopId || "",
      shopName: product.shopName || "",
      city: product.city || "",
    });
    setShowAddModal(true);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target:
      | "product"
      | "product2"
      | "product3"
      | "product4"
      | "product5"
      | "admin" = "product",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImageFormat =
      file.type.match(/^image\//i) ||
      file.name.match(/\.(png|jpeg|jpg|webp|heic)$/i);
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
      if (target === "admin") setAdminOwnerPhoto(base64data);
      else if (target === "product")
        setNewProduct((prev) => ({ ...prev, imageUrl: base64data }));
      else if (target === "product2")
        setNewProduct((prev) => ({ ...prev, imageUrl2: base64data }));
      else if (target === "product3")
        setNewProduct((prev) => ({ ...prev, imageUrl3: base64data }));
      else if (target === "product4")
        setNewProduct((prev) => ({ ...prev, imageUrl4: base64data }));
      else if (target === "product5")
        setNewProduct((prev) => ({ ...prev, imageUrl5: base64data }));
    };
    localReader.readAsDataURL(file);

    const loadToast = toast.loading("Uploading optimized photo to R2... ⚡📸");
    try {
      const ext = "webp";
      const cleanName = `p_${target}_${Date.now()}_optimized.${ext}`;
      const folder = target === "admin" ? "admin" : "products";

      const compressedBlob = await compressImage(file, 2048, 0.95);

      const dlUrl = await uploadToR2(compressedBlob, folder, cleanName);

      if (target === "admin") setAdminOwnerPhoto(dlUrl);
      else if (target === "product")
        setNewProduct((prev) => ({ ...prev, imageUrl: dlUrl }));
      else if (target === "product2")
        setNewProduct((prev) => ({ ...prev, imageUrl2: dlUrl }));
      else if (target === "product3")
        setNewProduct((prev) => ({ ...prev, imageUrl3: dlUrl }));
      else if (target === "product4")
        setNewProduct((prev) => ({ ...prev, imageUrl4: dlUrl }));
      else if (target === "product5")
        setNewProduct((prev) => ({ ...prev, imageUrl5: dlUrl }));
      toast.success("Photo uploaded instantly! ⚡🚀✅");
    } catch (err: any) {
      console.error(err);
      // Fallback: Generate a high quality compressed base64 string to prevent database bloating
      try {
        const compressedBlobForLocal = await compressImage(file, 2048, 0.95);
        const reader = new FileReader();
        reader.onloadend = () => {
          const compBase64 = reader.result as string;
          if (target === "admin") setAdminOwnerPhoto(compBase64);
          else if (target === "product")
            setNewProduct((prev) => ({ ...prev, imageUrl: compBase64 }));
          else if (target === "product2")
            setNewProduct((prev) => ({ ...prev, imageUrl2: compBase64 }));
          else if (target === "product3")
            setNewProduct((prev) => ({ ...prev, imageUrl3: compBase64 }));
          else if (target === "product4")
            setNewProduct((prev) => ({ ...prev, imageUrl4: compBase64 }));
          else if (target === "product5")
            setNewProduct((prev) => ({ ...prev, imageUrl5: compBase64 }));
        };
        reader.readAsDataURL(compressedBlobForLocal);
      } catch (compressErr) {
        console.warn("Could not generate compressed base64 preview, keeping raw", compressErr);
      }
      toast.success("Photo loaded in local/offline mode successfully! 📲✨");
    } finally {
      toast.dismiss(loadToast);
    }
  };

  return {
    products,
    filteredProducts,
    isLoading,
    showAddModal,
    setShowAddModal,
    editingProduct,
    setEditingProduct,
    newProduct,
    setNewProduct,
    toggleStock,
    handleAddProduct,
    handleDeleteProduct,
    startAdd,
    startEdit,
    handleImageUpload,
  };
}
