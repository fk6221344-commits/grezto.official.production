import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../services/supabase";
import { getApiUrl, getAuthHeaders } from "../../../utils/api";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth, secondaryAuth } from "../../../services/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithCustomToken } from "firebase/auth";
import toast from "react-hot-toast";
import { triggerCacheFlush } from "../../../utils/cacheApi";
import { prefetchImage } from "../../../utils/imagePrefetcher";

export function useAdminShops(isAuthenticated: boolean, firebaseAuthReady: boolean, adminSelectedCityFilter: string, localTick: number) {
  const [dbShops, setDbShops] = useState<any[]>([]);
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [newShop, setNewShop] = useState({
    name: "",
    ownerPhone: "",
    ownerName: "",
    category: "",
    defaultCategory: "",
    address: "",
    status: "active",
    type: "grocery",
    imageUrl: "",
    rating: "1.0",
    ratingCount: 0,
    lat: 26.1522,
    lng: 91.7602,
    pinned: false,
  });

  const [isShopPhoneVerified, setIsShopPhoneVerified] = useState(false);
  const [shopOtpSent, setShopOtpSent] = useState(false);
  const [shopOtpInput, setShopOtpInput] = useState("");
  const [shopOtpLoading, setShopOtpLoading] = useState(false);
  const [shopSandboxOtp, setShopSandboxOtp] = useState<string | null>(null);
  const [shopOtpError, setShopOtpError] = useState<string | null>(null);
  const [shopConfirmationResult, setShopConfirmationResult] = useState<any>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "block" | "delete";
    shopId: string;
    shopName: string;
    currentStep: number;
    shopObj?: any;
  }>({
    isOpen: false,
    type: "delete",
    shopId: "",
    shopName: "",
    currentStep: 1,
    shopObj: null,
  });

  useEffect(() => {
    if (!isAuthenticated || !firebaseAuthReady || !supabase) return;

    let sub: any;

    const fetchShops = async () => {
       try {
         const { data } = await supabase.from('shops').select('*');
         if (data) setDbShops(data);

         sub = supabase.channel(`admin_shops_stream_${Math.random()}`)
           .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, async () => {
              const { data: updated } = await supabase.from('shops').select('*');
              if (updated) setDbShops(updated);
           }).subscribe();
       } catch (error) {
         console.warn("Supabase shops stream offline or unconfigured:", error);
         setDbShops([]);
       }
    };
    fetchShops();

    return () => {
       if (sub) sub.unsubscribe();
    };
  }, [isAuthenticated, firebaseAuthReady]);

  const shops = useMemo(() => {
    let finalShops = [...dbShops];

    const uniqueShops: any[] = [];
    const seenIds = new Set();
    finalShops.forEach((s) => {
      if (s && s.id && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueShops.push(s);
      }
    });
    return uniqueShops;
  }, [dbShops, localTick]);

  const filteredShops = useMemo(() => {
    if (adminSelectedCityFilter === "All") return shops;
    return shops.filter((s: any) => {
      if (s.city) return s.city.toLowerCase() === adminSelectedCityFilter.toLowerCase();
      const addressLower = (s.address || "").toLowerCase();
      return addressLower.includes(adminSelectedCityFilter.toLowerCase());
    });
  }, [shops, adminSelectedCityFilter]);

  const [shopCaptchaSolved, setShopCaptchaSolved] = useState(false);

  useEffect(() => {
    if (showAddShopModal) {
      setShopCaptchaSolved(false);
      const initializeShopCaptcha = async () => {
        try {
          // Wait for DOM to render the container
          for (let i = 0; i < 10; i++) {
            if (document.getElementById("recaptcha-container-shop")) break;
            await new Promise(r => setTimeout(r, 100));
          }
          
          if (document.getElementById("recaptcha-container-shop") && !(window as any).recaptchaVerifierShop) {
            const verifier = new RecaptchaVerifier(secondaryAuth, "recaptcha-container-shop", {
              size: "normal",
              callback: () => {
                setShopCaptchaSolved(true);
              },
              "expired-callback": () => {
                setShopCaptchaSolved(false);
              }
            });
            await verifier.render();
            (window as any).recaptchaVerifierShop = verifier;
          }
        } catch (e) {
          console.warn("Shop Recaptcha render failed:", e);
        }
      };
      initializeShopCaptcha();
    } else {
      if ((window as any).recaptchaVerifierShop) {
        try { (window as any).recaptchaVerifierShop.clear(); } catch(e) {}
        (window as any).recaptchaVerifierShop = null;
      }
      setShopCaptchaSolved(false);
    }
  }, [showAddShopModal]);

  const handleSendShopOtp = async () => {
    if (!newShop.ownerPhone || newShop.ownerPhone.length !== 10 || !/^[0-9]+$/.test(newShop.ownerPhone)) {
      toast.error("Please enter a valid 10-digit mobile phone number!");
      return;
    }
    if (!shopCaptchaSolved) {
      toast.error("Please verify that you are not a robot first!");
      return;
    }
    setShopOtpLoading(true);
    try {
      const firebasePromise = (async () => {
        let verifier = (window as any).recaptchaVerifierShop;
        if (!verifier) throw new Error("Captcha not initialized.");
        const confirmation = await signInWithPhoneNumber(secondaryAuth, `+91${newShop.ownerPhone}`, verifier);
        return confirmation;
      })();
      const confirmationResultData = await firebasePromise;
      setShopConfirmationResult(confirmationResultData);
      setShopOtpError(null);
      setShopOtpSent(true);
      toast.success(`Secure OTP sent to +91 ${newShop.ownerPhone} via SMS! 📲`);
    } catch (err: any) {
      console.warn("Real shop Firebase OTP dispatch failed. Generating dynamic audit details:", err);
      toast.error("Standard verification failed. Please try again later.");
    } finally {
      setShopOtpLoading(false);
    }
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.ownerPhone || !newShop.ownerName) {
      toast.error("Name, owner phone and owner name are required!");
      return;
    }
    if (!editingShop && !isShopPhoneVerified) {
      if (!shopOtpSent) {
        toast.error("Please verify phone number with OTP first.");
        return;
      }
      setShopOtpLoading(true);
      try {
        let isVerified = false, clientUid = "", idToken = "";
        if (shopConfirmationResult) {
          try {
            const userCredential = await shopConfirmationResult.confirm(shopOtpInput);
            clientUid = userCredential.user.uid;
            
            // Sign out the secondary instance immediately so we don't leak sessions!
            await secondaryAuth.signOut();
            isVerified = true;
          } catch (err) {
            toast.error("Incorrect OTP! Please enter the correct 6-digit verification code. 🛑");
            setShopOtpLoading(false);
            return;
          }
        }
        const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: newShop.ownerPhone,
            otp: shopOtpInput,
            verificationId: isVerified ? "client-verified" : (shopConfirmationResult?.verificationId || ""),
            clientUid,
            idToken
          })
        });
        const resData = await response.json();
        if (resData.fallbackToken) {
          localStorage.setItem("grezto_fallback_token", resData.fallbackToken);
          console.log("[Fallback Auth] Cryptographic fallback token stored securely (Admin shop verification).");
        }
        if (!response.ok || !resData.success) {
          if (!isVerified) throw new Error(resData.error || "Invalid OTP");
        }
        if (resData.customToken && !isVerified) {
          try {
            if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signInWithCustomToken({ token: resData.customToken });
            else await signInWithCustomToken(auth, resData.customToken);
          } catch (e) {}
        }
        setIsShopPhoneVerified(true);
        toast.success("Shop Phone verified securely! 🔐");
      } catch (err: any) {
        toast.error(err.message || "Invalid OTP Code entered! ❌");
        setShopOtpLoading(false);
        return;
      }
    }

    const targetId = editingShop ? editingShop.id : "s_" + Date.now();
    const shopData = {
      id: targetId,
      ...newShop,
      city: (newShop as any).city || (adminSelectedCityFilter !== "All" ? adminSelectedCityFilter : ""),
      joinedAt: new Date().toISOString(),
    };

    if (shopData.imageUrl) {
      prefetchImage(shopData.imageUrl).catch(() => {});
    }

    try {
      const cachedShops = JSON.parse(localStorage.getItem("grezto_offline_shops") || "[]");
      const idx = cachedShops.findIndex((s: any) => s.id === targetId);
      if (idx !== -1) {
        cachedShops[idx] = { ...cachedShops[idx], ...shopData };
      } else {
        cachedShops.push(shopData);
      }
      localStorage.setItem("grezto_offline_shops", JSON.stringify(cachedShops));
      window.dispatchEvent(new CustomEvent("grezto-products-updated"));
    } catch (e) {
      console.warn("Could not save to local storage", e);
    }

    toast.success(editingShop ? "Shop details updated!" : "New partner shop registered! 🎉");
    setShowAddShopModal(false);
    setEditingShop(null);
    setNewShop({ name: "", ownerPhone: "", ownerName: "", category: "", defaultCategory: "", address: "", status: "active", type: "grocery", imageUrl: "", rating: "1.0", ratingCount: 0, lat: 26.1522, lng: 91.7602, pinned: false });
    setIsShopPhoneVerified(false);
    setShopOtpSent(false);
    setShopOtpInput("");

    try {
      if (supabase) {
         const supaShop = {
            id: targetId,
            name: shopData.name,
            category: shopData.category,
            defaultCategory: shopData.defaultCategory || '',
            type: shopData.type || 'grocery',
            rating: Number(shopData.rating) || 0,
            minTime: Number((shopData as any).minTime) || 15,
            maxTime: Number((shopData as any).maxTime) || 30,
            distance: String((shopData as any).distance || '1 km'),
            promo: String((shopData as any).promo || ''),
            image: shopData.imageUrl || (shopData as any).image,
            status: shopData.status === 'active' ? 'Open' : 'Closed',
            pinned: !!shopData.pinned,
            ownerPhone: shopData.ownerPhone,
            ownerName: shopData.ownerName,
            address: shopData.address,
            lat: shopData.lat,
            lng: shopData.lng
         };

         const response = await fetch(getApiUrl('/api/shops/update'), {
           method: 'POST',
           headers: await getAuthHeaders(),
           body: JSON.stringify({
             shopId: targetId,
             city: adminSelectedCityFilter,
             updateData: supaShop,
             isUpsert: !editingShop
           })
         });
         if (!response.ok) {
           throw new Error('Server returned error status');
         }
      }
    } catch (err: any) {
      console.error("Save shop API failed:", err);
    }
  };

  const handleDeleteShop = async (id: string) => {
    try {
      const deletedShops = JSON.parse(localStorage.getItem("grezto_offline_deleted_shops") || "[]");
      if (!deletedShops.includes(id)) {
        deletedShops.push(id);
        localStorage.setItem("grezto_offline_deleted_shops", JSON.stringify(deletedShops));
      }
      let cachedShops = JSON.parse(localStorage.getItem("grezto_offline_shops") || "[]");
      cachedShops = cachedShops.filter((s: any) => s.id !== id);
      localStorage.setItem("grezto_offline_shops", JSON.stringify(cachedShops));
      window.dispatchEvent(new CustomEvent("grezto-products-updated"));
      toast.success("Shop deleted permanently!");
    } catch (e) {}
    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId: id,
          city: adminSelectedCityFilter,
          isDelete: true
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err: any) {
      console.warn("delete failed:", err);
    }
  };

  const handleToggleBlockShop = async (shop: any) => {
    const nextStatus = shop.status === "blocked" ? "active" : "blocked";
    try {
      const cachedShops = JSON.parse(localStorage.getItem("grezto_offline_shops") || "[]");
      const idx = cachedShops.findIndex((s: any) => s.id === shop.id);
      const updatedShop = { ...shop, status: nextStatus };
      if (idx !== -1) cachedShops[idx] = updatedShop;
      else cachedShops.push(updatedShop);
      localStorage.setItem("grezto_offline_shops", JSON.stringify(cachedShops));
      window.dispatchEvent(new CustomEvent("grezto-products-updated"));
      toast.success(nextStatus === "blocked" ? "Shop blocked successfully! 🚫" : "Shop unblocked successfully! ✅");
    } catch (e) {}
    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId: shop.id,
          city: shop.city || adminSelectedCityFilter,
          updateData: { status: nextStatus === 'active' ? 'Open' : 'Closed' }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err: any) {
      console.warn("Toggle block shop update error:", err);
    }
  };

  const handleTogglePinShop = async (shop: any) => {
    const nextPinnedStatus = !shop.pinned;
    try {
      const cachedShops = JSON.parse(localStorage.getItem("grezto_offline_shops") || "[]");
      const idx = cachedShops.findIndex((s: any) => s.id === shop.id);
      const updatedShop = { ...shop, pinned: nextPinnedStatus };
      if (idx !== -1) cachedShops[idx] = updatedShop; else cachedShops.push(updatedShop);
      localStorage.setItem("grezto_offline_shops", JSON.stringify(cachedShops));
      window.dispatchEvent(new CustomEvent("grezto-products-updated"));
      toast.success(nextPinnedStatus ? "Exclusive Mode enabled for this shop! 🔒" : "Exclusive Mode disabled for this shop! 🔓");
    } catch (e) {}
    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId: shop.id,
          city: shop.city || adminSelectedCityFilter,
          updateData: { pinned: nextPinnedStatus }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err: any) {
      console.warn("Toggle pin shop update error:", err);
    }
  };

  return {
    shops,
    filteredShops,
    dbShops,
    showAddShopModal,
    setShowAddShopModal,
    editingShop,
    setEditingShop,
    newShop,
    setNewShop,
    isShopPhoneVerified,
    setIsShopPhoneVerified,
    shopOtpSent,
    setShopOtpSent,
    shopOtpInput,
    setShopOtpInput,
    shopOtpLoading,
    shopOtpError,
    shopCaptchaSolved,
    confirmModal,
    setConfirmModal,
    handleSendShopOtp,
    handleSaveShop,
    handleDeleteShop,
    handleToggleBlockShop,
    handleTogglePinShop
  };
}
