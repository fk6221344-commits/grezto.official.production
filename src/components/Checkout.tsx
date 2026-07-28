import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Clock,
  User,
  Phone,
  Check,
  ShoppingBag,
  Truck,
  Wallet,
  ArrowRight,
  Compass,
  Coins,
  Banknote,
  RotateCw,
  AlertTriangle,
  Lock,
  Globe,
  Grid,
  Landmark,
  X,
  LocateFixed,
  Pencil,
  Plus,
  Leaf,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { auth } from "../services/firebase";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import { CartCalculationOverlay, AddressConfirmationSheet } from "./cart/CartDrawer";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { getUnifiedHighSpeedLocation } from "../lib/geocoder";
import {
  LOCAL_MAP_LANDMARKS,
  findNearestLandmark,
} from "../data/villageCoordinates";
import { calculateDistance } from "../lib/distance";
import { useCheckoutGPS, BURABURI_CENTER } from "../hooks/useCheckoutGPS";
import { triggerSuccessHapticVibration } from "../services/nativeService";

interface SavedAddress {
  id: string;
  name: string;
  state: string;
  pincode: string;
  city: string;
  houseNo: string;
  area: string;
  landmark: string;
  lat: number;
  lng: number;
}

export default function Checkout({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (details: any) => void;
}) {
  const { items, subtotal, clearCart } = useCart();
  const { user, updateProfile, addPoints, consumeVoucher } = useUser();
  const [loading, setLoading] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [shopsData, setShopsData] = useState<any[]>([]);
  const [isPreorder, setIsPreorder] = useState(false);

  // Saved addresses list initialized from localStorage (or legacy address migration)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => {
    try {
      const saved = localStorage.getItem("grezto_saved_addresses");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    try {
      const legacy = localStorage.getItem("grezto_delivery_details");
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.name && parsed.city) {
          const migrated: SavedAddress = {
            id: "addr_migrated_" + Date.now(),
            name: parsed.name,
            state: "Assam",
            pincode: parsed.pincode || "782411",
            city: parsed.city,
            houseNo: parsed.houseNo || "",
            area: parsed.area || "",
            landmark: parsed.landmark || "",
            lat: user.lat || 26.243455,
            lng: user.lng || 92.1306235
          };
          return [migrated];
        }
      }
    } catch (e) {}
    return [];
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem("grezto_saved_addresses");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch (e) {}
    const legacy = localStorage.getItem("grezto_delivery_details");
    if (legacy) {
      return "addr_migrated_"; // Falls back to first active migrated address
    }
    return null;
  });

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [isCreatingNewAddress, setIsCreatingNewAddress] = useState<boolean>(() => {
    return savedAddresses.length === 0;
  });

  // Form inputs matching the 2x4 layout
  const [stateInput, setStateInput] = useState("Assam");
  const [pincodeInput, setPincodeInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [houseNoInput, setHouseNoInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [landmarkInput, setLandmarkInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    let isMounted = true;
    let sub: any;
    import('../services/supabase').then(({ supabase }) => {
       if (!supabase) return;
       supabase.from('shops').select('*').then(({ data }) => {
          if (data && isMounted) setShopsData(data);
       });
       if (isMounted) {
           sub = supabase.channel(`checkout_shops_${Math.random()}`)
             .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, async () => {
                 if (!isMounted) return;
                 const { data } = await supabase.from('shops').select('*');
                 if (data && isMounted) setShopsData(data);
             }).subscribe();
       }
    });
    return () => { 
        isMounted = false;
        if (sub) {
            import('../services/supabase').then(({ supabase }) => {
                if (supabase) supabase.removeChannel(sub);
            });
        }
    };
  }, []);

  useEffect(() => {
    // Check if any item in the cart belongs to an offline shop
    let preorderRequired = false;
    for (const item of items) {
      const sId = (item as any).shopId || (item as any).productShopId;
      if (sId) {
        const matchingShop = shopsData.find((s) => s.id === sId);
        if (matchingShop && matchingShop.isOpen === false) {
          preorderRequired = true;
          break;
        }
      }
    }
    setIsPreorder(preorderRequired);
  }, [items, shopsData]);

  // Auto-clear voucher if subtotal drops below minimum required
  useEffect(() => {
    if (
      selectedVoucher &&
      selectedVoucher.minSubtotal &&
      subtotal < selectedVoucher.minSubtotal
    ) {
      setSelectedVoucher(null);
      toast.error(
        `Voucher removed: requires minimum ₹${selectedVoucher.minSubtotal} subtotal.`,
      );
    }
  }, [subtotal, selectedVoucher]);

  // Recipient info retrieved directly from user profile context with custom fallback
  const {
    coords,
    setCoords,
    nameVal,
    setNameVal,
    cityVal,
    setCityVal,
    areaVal,
    setAreaVal,
    landmarkVal,
    setLandmarkVal,
    isDetailsSubmitted,
    setIsDetailsSubmitted,
    lastInteraction,
    setLastInteraction,
    googleMapsKey,
    gpsLoading,
    gpsCoords,
    gpsAddress,
    distanceToHub,
    fetchAutomaticGPSDetails,
    handleCameraChange,
    calcDeliveryFee,
    adjustedTotal,
    currentDistance,
    isOutOfRange,
  } = useCheckoutGPS({ user, updateProfile, subtotal, items });

  // Find currently active selected address
  const activeAddress = useMemo(() => {
    return savedAddresses.find((addr) => addr.id === selectedAddressId) || null;
  }, [savedAddresses, selectedAddressId]);

  // Sync state between activeAddress / form inputs and useCheckoutGPS hook variables
  useEffect(() => {
    if (isCreatingNewAddress || editingAddressId) {
      // In Form View: Sync inputs to useCheckoutGPS
      setNameVal(nameInput);
      setCityVal(cityInput);
      setAreaVal(areaInput);
      setLandmarkVal(landmarkInput);
    } else if (activeAddress) {
      // In Saved Address View: Sync activeAddress to useCheckoutGPS
      setNameVal(activeAddress.name);
      setCityVal(activeAddress.city);
      setAreaVal(activeAddress.area);
      setLandmarkVal(activeAddress.landmark);
      setCoords({ lat: activeAddress.lat, lng: activeAddress.lng });
    }
  }, [
    isCreatingNewAddress,
    editingAddressId,
    activeAddress,
    nameInput,
    cityInput,
    areaInput,
    landmarkInput,
    setNameVal,
    setCityVal,
    setAreaVal,
    setLandmarkVal,
    setCoords
  ]);

  const [nominatimAddress, setNominatimAddress] = useState<string>("");
  const [nominatimLoading, setNominatimLoading] = useState<boolean>(false);

  // Synchronize landmarkVal to exact Nominatim OSM reverse geocoded address for ₹0 billing
  useEffect(() => {
    if (coords && coords.lat && coords.lng) {
      setNominatimLoading(true);
      import('../lib/geocoder').then(({ fetchNominatimAddress }) => {
        fetchNominatimAddress(coords.lat, coords.lng)
          .then((addr) => {
            setNominatimAddress(addr);
            setLandmarkVal(addr);
          })
          .catch((err) => {
            console.error("Failed to reverse geocode:", err);
            const fallbackAddr = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            setNominatimAddress(fallbackAddr);
            setLandmarkVal(fallbackAddr);
          })
          .finally(() => {
            setNominatimLoading(false);
          });
      });
    }
  }, [coords, setLandmarkVal]);

  const recipientName = nameVal || user.name || "Jjbuu";
  const recipientPhone = user.phone || "7577950272";

  const finalDeliveryFee =
    selectedVoucher?.type === "freedelivery" ? 0 : calcDeliveryFee;
  const voucherDiscount =
    selectedVoucher?.type === "amount" ? selectedVoucher.value : 0;
  const finalTotal = Math.max(0, subtotal + finalDeliveryFee - voucherDiscount);

  const [showOutOfRangeModal, setShowOutOfRangeModal] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const nativeMapRef = useRef<any>(null);
  const liveDotMarkerRef = useRef<any>(null);

  // Google Maps interactive initialization is removed per user request to provide a clean, 100% stable layout without map loading errors.
  // All native GPS satellite locking, reverse geocoding, and zone distance calculations are fully preserved.

  // Pre-fill landmarkInput and cityInput from nominatim geocoder results during creation/editing
  useEffect(() => {
    if ((isCreatingNewAddress || editingAddressId) && nominatimAddress) {
      if (!landmarkInput) {
        setLandmarkInput(nominatimAddress);
      }
    }
  }, [nominatimAddress, isCreatingNewAddress, editingAddressId]);

  const handleEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setNameInput(addr.name);
    setStateInput(addr.state);
    setPincodeInput(addr.pincode);
    setCityInput(addr.city);
    setHouseNoInput(addr.houseNo);
    setAreaInput(addr.area);
    setLandmarkInput(addr.landmark);
    setCoords({ lat: addr.lat, lng: addr.lng });
    setIsCreatingNewAddress(false);
  };

  const handleCreateNewAddress = () => {
    setNameInput(user.name || "");
    setStateInput("Assam");
    setPincodeInput("");
    setCityInput("");
    setHouseNoInput("");
    setAreaInput("");
    setLandmarkInput("");
    setIsCreatingNewAddress(true);
    setEditingAddressId(null);
    fetchAutomaticGPSDetails(); // Trigger GPS sync for the new address coords
  };

  const handleSyncCurrentLocation = async () => {
    await fetchAutomaticGPSDetails();
    if (activeAddress) {
      const updated = savedAddresses.map(addr => 
        addr.id === selectedAddressId 
          ? { ...addr, lat: coords.lat, lng: coords.lng } 
          : addr
      );
      setSavedAddresses(updated);
      localStorage.setItem("grezto_saved_addresses", JSON.stringify(updated));
      toast.success("Synced coordinates to active address!");
    }
  };

  const handleFormBack = () => {
    if (savedAddresses.length > 0) {
      setEditingAddressId(null);
      setIsCreatingNewAddress(false);
    } else {
      onBack();
    }
  };

  const handleSaveAndPlaceOrder = async () => {
    if (!nameInput.trim()) {
      toast.error("Please enter Your Name first.");
      return;
    }
    if (!cityInput.trim()) {
      toast.error("Please enter City / Village first.");
      return;
    }
    if (!pincodeInput.trim()) {
      toast.error("Please enter Pincode first.");
      return;
    }
    if (pincodeInput.trim().length !== 6) {
      toast.error("Pincode must be exactly 6 digits.");
      return;
    }

    const newAddress: SavedAddress = {
      id: editingAddressId || "addr_" + Date.now(),
      name: nameInput.trim(),
      state: stateInput.trim(),
      pincode: pincodeInput.trim(),
      city: cityInput.trim(),
      houseNo: "",
      area: "",
      landmark: "",
      lat: coords.lat,
      lng: coords.lng,
    };

    let updatedList: SavedAddress[] = [];
    if (editingAddressId) {
      updatedList = savedAddresses.map(addr => addr.id === editingAddressId ? newAddress : addr);
      toast.success("Address updated and selected!");
    } else {
      updatedList = [newAddress, ...savedAddresses];
      toast.success("Address saved and selected!");
    }

    setSavedAddresses(updatedList);
    localStorage.setItem("grezto_saved_addresses", JSON.stringify(updatedList));
    setSelectedAddressId(newAddress.id);
    
    // Clear editing/creating states
    setEditingAddressId(null);
    setIsCreatingNewAddress(false);

    // Call place order with small delay to allow synced states
    setTimeout(() => {
      handlePlaceOrder();
    }, 100);
  };

  const handlePlaceOrder = async () => {
    if (loading) return;
    
    if (subtotal > 1000) {
      toast.error("1000 Rs se jyada ka order ek baar mein nahi kar sakte. Please reduce items ya phir alag order place karein.");
      return;
    }

    if (!nameVal.trim()) {
      toast.error("Please enter Name first.");
      return;
    }

    if (!cityVal.trim()) {
      toast.error("Please enter City / Village first.");
      return;
    }

    const finalAddress = activeAddress && !isCreatingNewAddress && !editingAddressId
      ? `${activeAddress.city.trim()} - ${activeAddress.pincode.trim()} (GPS: ${activeAddress.lat.toFixed(6)}, ${activeAddress.lng.toFixed(6)})`
      : `${cityVal.trim()} (GPS Address: ${nominatimAddress || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`})`;

    // Save details to localStorage for future orders and mark details submitted
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "grezto_delivery_details",
          JSON.stringify({
            name: nameVal.trim(),
            city: cityVal.trim(),
            area: "",
            landmark: "",
          })
        );
        setIsDetailsSubmitted(true);
      } catch (e) {
        console.warn("Failed to save delivery details:", e);
      }
    }

    if (!recipientPhone.trim() || recipientPhone.trim().length < 8) {
      toast.error("Please configure a valid Mobile Contact.");
      return;
    }

    if (!finalAddress || !finalAddress.trim()) {
      toast.error(
        "Please synchronize or drag your pin to select delivery point.",
      );
      return;
    }

    const computedLat = gpsCoords.lat;
    const computedLng = gpsCoords.lng;
    const distance = calculateDistance(
      computedLat,
      computedLng,
      BURABURI_CENTER.lat,
      BURABURI_CENTER.lng,
    );

    if (isOutOfRange) {
      toast.error("Sorry! We only deliver within 5 KM from our store. You are outside our delivery zone.");
      return;
    }

    setLoading(true);

    try {
      let isSystemOnline = true;
      try {
        const { supabase } = await import('../services/supabase');
        if (supabase) {
           const { data } = await supabase.from('system_config').select('isSystemOnline').eq('id','config').single();
           if (data && data.isSystemOnline === false) isSystemOnline = false;
        }
      } catch(e) {}

      if (!isSystemOnline) {
        toast.error(
          "Market is currently closed! Orders are suspended. Please wait until market opens.",
          { duration: 5000 },
        );
        setLoading(false);
        return;
      }

      // Live verification of stock and deletion status of all items in the cart
      try {
        const { supabase } = await import('../services/supabase');
        if (supabase && items.length > 0) {
          const productIds = items.map(item => item.id);
          const { data: dbProds, error: dbErr } = await supabase
            .from('products')
            .select('*')
            .in('id', productIds);

          if (!dbErr && dbProds) {
            const dbProdsMap = new Map<string, { name: string; stock: number; deleted: boolean }>();
            dbProds.forEach((p: any) => {
              const stockVal = p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0);
              dbProdsMap.set(p.id, {
                name: p.name,
                stock: stockVal,
                deleted: p.deleted === true
              });
            });

            const problematicItems: string[] = [];
            items.forEach(item => {
              const dbProd = dbProdsMap.get(item.id);
              if (!dbProd || dbProd.deleted || dbProd.stock <= 0) {
                problematicItems.push(item.name);
              }
            });

            if (problematicItems.length > 0) {
              toast.error(
                `Aapke cart mein kuch products (${problematicItems.join(', ')}) out of stock ya store se delete ho chuke hain. Please unhe check karke remove karein.`,
                { duration: 6000 }
              );
              setLoading(false);
              return;
            }
          }
        }
      } catch (valErr) {
        console.error("Stock validation failed, bypass for offline mode safely:", valErr);
      }

      const uid = auth.currentUser?.uid || "anonymous_user";

      // 1. Log Location Registry
      const locationData = {
        userId: uid,
        customerName: recipientName.trim(),
        phone: recipientPhone.trim(),
        lat: computedLat,
        lng: computedLng,
        address: finalAddress,
        tag: "Automatic GPS Sync 12KM Validation",
        updatedAt: new Date().toISOString(),
      };
      
      try {
        const { supabase } = await import('../services/supabase');
        if (supabase) {
           await supabase.from('users_location').upsert([locationData]);
        }
      } catch(e) {}

      updateProfile({
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
        address: finalAddress,
        lat: computedLat,
        lng: computedLng,
        isLoggedIn: true,
      });

      // 2. Group items by shop to guarantee absolute vendor privacy and resolve canonical UUIDs
      const groups: { [shopId: string]: any[] } = {};
      
      const resolveCanonicalShop = (rawId: string, rawName: string, shops: any[]) => {
        if (!rawId) return { id: "admin", name: "Admin" };
        const trimmedId = String(rawId).trim();
        const lowerId = trimmedId.toLowerCase();
        
        if (lowerId === "admin" || lowerId === "direct" || !trimmedId) {
          return { id: "admin", name: "Admin" };
        }

        // 1. Try to match by ID exactly
        let found = shops.find(s => String(s.id).trim() === trimmedId);
        if (found) {
          return { id: found.id, name: found.name };
        }

        // 2. Try to match by ID case-insensitively
        found = shops.find(s => String(s.id).trim().toLowerCase() === lowerId);
        if (found) {
          return { id: found.id, name: found.name };
        }

        // 3. Try to match by Name case-insensitively
        found = shops.find(s => s.name && s.name.trim().toLowerCase() === lowerId);
        if (found) {
          return { id: found.id, name: found.name };
        }

        // 4. Try to match by item's rawName if provided
        if (rawName) {
          const trimmedName = String(rawName).trim();
          const lowerName = trimmedName.toLowerCase();
          found = shops.find(s => s.name && s.name.trim().toLowerCase() === lowerName);
          if (found) {
            return { id: found.id, name: found.name };
          }
        }

        return { id: trimmedId, name: rawName || trimmedId };
      };

      items.forEach((item) => {
        const rawId = (item as any).shopId || (item as any).productShopId || "admin";
        const rawName = (item as any).shopName || "";
        const canonical = resolveCanonicalShop(rawId, rawName, shopsData);
        
        const normId = canonical.id;
        if (!groups[normId]) {
          groups[normId] = [];
        }
        
        // Update item fields to be fully canonical
        const canonicalItem = {
          ...item,
          shopId: normId === "admin" ? "" : normId,
          productShopId: normId === "admin" ? "" : normId,
          shopName: normId === "admin" ? "" : canonical.name
        };
        groups[normId].push(canonicalItem);
      });

      const shopKeys = Object.keys(groups);
      const checkoutGroupId = "c_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

      // Place all multi-vendor orders in parallel (Promise.all) for instant checkout loading speeds (no sequential bottleneck)!
      await Promise.all(shopKeys.map(async (currentShopId, i) => {
        const groupItems = groups[currentShopId];

        const groupSubtotal = groupItems.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0,
        );
        const groupDeliveryFee = i === 0 ? finalDeliveryFee : 0;
        const groupAmount = Math.max(
          0,
          groupSubtotal + groupDeliveryFee - (i === 0 ? voucherDiscount : 0),
        );

        const cid = `${checkoutGroupId}_${i}`;
        const groupShopIds = currentShopId === "admin" ? [] : [currentShopId];

        const orderPayloadData = {
          clientOrderId: cid,
          userId: uid,
          customerName: recipientName.trim(),
          phone: recipientPhone.trim(),
          address: finalAddress,
          lat: computedLat,
          lng: computedLng,
          locationTag: "Automatic GPS Sync Coordinates",
          items: groupItems.map((item) => item.name),
          fullItems: groupItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            shopId: currentShopId === "admin" ? null : currentShopId,
            shopName: currentShopId === "admin" ? null : item.shopName || null,
          })),
          shopIds: groupShopIds,
          amount: groupAmount,
          subtotal: groupSubtotal,
          deliveryFee: groupDeliveryFee,
          discountAmount: i === 0 ? voucherDiscount : 0,
          appliedVoucherCode: i === 0 ? selectedVoucher?.code || null : null,
          status: "Received",
          isPreorder: isPreorder,
          scheduledFor: isPreorder ? "Tomorrow Morning" : null,
          createdAt: new Date().toISOString(),
        };

        // Cache local backup
        try {
          const localHistoryStr =
            localStorage.getItem("grezto_local_order_history") || "[]";
          let localHistory: any[] = [];
          try {
            localHistory = JSON.parse(localHistoryStr);
            if (!Array.isArray(localHistory)) {
              localHistory = [];
            }
          } catch (pe) {
            localHistory = [];
          }
          localHistory.push({
            ...orderPayloadData,
            id: "local_" + cid,
            clientOrderId: cid,
            createdAt: new Date().toISOString(),
          });
          localStorage.setItem(
            "grezto_local_order_history",
            JSON.stringify(localHistory),
          );
        } catch (localErr) {
          console.error(
            "Local history backup failed, proceeding with online payload creation safely:",
            localErr,
          );
        }

        // Firebase write removed in Phase 2
        
        const supaOrder = {
          id: cid, // Now Supabase is the primary, we use clientOrderId
          userId: uid,
          customerName: recipientName.trim(),
          customerPhone: recipientPhone.trim(),
          partnerName: null,
          partnerPhone: null,
          shopIds: groupShopIds,
          items: orderPayloadData.fullItems,
          totalAmount: groupSubtotal,
          deliveryCharge: groupDeliveryFee,
          platformFee: 0,
          finalAmount: groupAmount,
          address: {
            address: finalAddress,
            lat: computedLat,
            lng: computedLng
          },
          status: "Received",
          paymentMethod: "COD",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Supabase write (Phase 2 primary database via secure gateway)
        try {
          const { callSecureGateway } = await import('../services/supabase');
          
          const payload = {
            p_customer_phone: supaOrder.customerPhone,
            p_customer_name: supaOrder.customerName,
            p_items: supaOrder.items,
            p_total_amount: supaOrder.totalAmount,
            p_delivery_address: supaOrder.address.address,
            p_coordinates: { lat: supaOrder.address.lat, lng: supaOrder.address.lng },
            p_shop_ids: supaOrder.shopIds,
            p_user_id: supaOrder.userId || null,
            p_delivery_charge: supaOrder.deliveryCharge || 0.00,
            p_platform_fee: supaOrder.platformFee || 0.00,
            p_final_amount: supaOrder.finalAmount,
            p_payment_method: supaOrder.paymentMethod || 'COD',
            p_status: supaOrder.status || 'Received',
            p_order_id: supaOrder.id || null
          };

          const orderId = await callSecureGateway('place_order', payload);
          console.log('[SUPABASE VIA GATEWAY] Order securely placed! ID:', orderId);
        } catch(e: any) {
          console.warn('[SUPABASE VIA GATEWAY] Order creation in Supabase failed.', e);
          toast.error(`Order failed: ${e.message || 'Unknown database error'}`);
          throw e; // throw so outer catch handles it
        }
      }));

      // Update loyal reward points and mark voucher as used
      if (selectedVoucher) {
        consumeVoucher(selectedVoucher.id);
      }
      const earnedPoints = Math.max(1, Math.floor(subtotal / 10));
      addPoints(earnedPoints);

      toast.success(
        `🎉 Order Placed! Earned 🪙 ${earnedPoints} Grezto Loyalty Points!`,
        { duration: 5000 },
      );

      onComplete({
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
        address: finalAddress,
        lat: computedLat,
        lng: computedLng,
        tag: "GPS Synced Form",
      });
      triggerSuccessHapticVibration();
      clearCart();
      
      // Post-Checkout First Order Update
      if (user.hasPlacedFirstOrder === false) {
        try {
          const { supabase } = await import('../services/supabase');
          if (supabase) {
            supabase.from('profiles').update({ has_placed_first_order: true }).eq('phone', user.phone).then(() => {});
          }
          updateProfile({ hasPlacedFirstOrder: true });
        } catch (updateErr) {
          console.warn("Could not update first order flag", updateErr);
        }
      }

    } catch (err: any) {
      console.warn("Database offline cache used:", err);
      toast.error(`Error: ${err.message || 'Unknown error during order setup'}`);
    } finally {
      setLoading(false);
    }
  };

  // Active floating label dynamically resolved under map center pointer (no Kawarhagi static restriction)
  const nearestLandmarkName = useMemo(() => {
    if (cityVal && cityVal !== "Kawarhagi") {
      return `${areaVal ? `${areaVal}, ` : ""}${cityVal}`;
    }
    const morigaonLat = 26.243455;
    const morigaonLng = 92.1306235;
    const distanceDegrees = Math.sqrt(
      (coords.lat - morigaonLat) ** 2 + (coords.lng - morigaonLng) ** 2,
    );
    if (distanceDegrees < 0.25) {
      return findNearestLandmark(coords.lat, coords.lng).name;
    }
    return nominatimAddress || `Location coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  }, [coords.lat, coords.lng, cityVal, areaVal, nominatimAddress]);

  const handleSaveDetails = () => {
     if (!nameVal.trim() || !cityVal.trim() || !areaVal.trim() || !landmarkVal.trim()) {
        toast.error("Please fill in all delivery details.");
        return;
     }
     localStorage.setItem('grezto_delivery_details', JSON.stringify({
         name: nameVal.trim(),
         city: cityVal.trim(),
         area: areaVal.trim(),
         landmark: landmarkVal.trim()
     }));
     setIsDetailsSubmitted(true);
     toast.success("Delivery details saved!");
  };

  const isFormValid = !!(nameInput.trim() && cityInput.trim() && pincodeInput.trim());

  return (
    <div className="w-full h-screen bg-[#f8faf8] flex flex-col justify-between font-sans overflow-hidden select-none relative">
      {/* 1. NATIVE INTEGRATED WHITE HEADER BLOCK */}
      <div className={`w-full bg-white border-b border-stone-200/90 px-3.5 ${Capacitor.isNativePlatform() ? 'pt-[max(env(safe-area-inset-top),52px)] pb-3.5' : 'pt-11 pb-2.5'} shrink-0 z-50 select-none`}>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="w-8.5 h-8.5 bg-stone-100/80 hover:bg-stone-150/70 text-stone-800 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer border border-stone-200/90 shadow-2xs"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4 text-stone-800 stroke-[3]" />
          </button>

          {/* Highlighted Professional English Title Layer Centered seamlessly inside the space */}
          <div className="flex-grow flex justify-center items-center px-1">
            <div className="flex items-center gap-1.2 bg-stone-100/60 px-2.5 py-1 rounded-full border border-stone-200/70 max-w-[220px]">
              <Clock className="w-3.5 h-3.5 text-[#00c853] shrink-0 animate-pulse" />
              <span className="text-[10px] font-black text-stone-750 tracking-wide font-sans truncate leading-none">
                Arriving within 10-25 Mins
              </span>
            </div>
          </div>

          {/* Refresh button with solid crimson/red styling inside the premium white top bar */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => fetchAutomaticGPSDetails(true)}
            disabled={gpsLoading}
            className="flex items-center bg-[#ea2027]/90 hover:bg-[#ea2027] border-none px-3.5 py-1 text-white font-extrabold text-[9px] uppercase tracking-wider gap-1 rounded-full transition-all cursor-pointer shadow-xs disabled:opacity-55"
          >
            <RotateCw
              className={`w-3 h-3 text-white ${gpsLoading ? "animate-spin" : ""}`}
            />
            <span className="font-black">REFRESH</span>
          </motion.button>
        </div>
      </div>

      {/* DYNAMIC OUT OF RANGE ALARM BAR - SHIFTED TO TOP DIRECTLY UNDER WHITE HEADER AS A SLIM INTEGRATED SECTION */}
      {isOutOfRange && (
        <div className="w-full bg-[#fff5f5] border-b border-red-200/50 px-3.5 py-2.5 shrink-0 z-40 select-none">
          <div className="max-w-sm mx-auto flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-grow select-text">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-700 leading-none">
                DELIVERY ZONE RESTRICTION
              </p>
              <p className="text-[11px] font-extrabold leading-normal text-red-600 mt-1">
                Sorry! We only deliver within 5 KM from our store. You are outside our delivery zone.
              </p>
              <p className="text-[9px] font-medium text-stone-500 mt-1">
                Current road distance: <span className="font-extrabold text-red-700">{currentDistance.toFixed(2)} KM</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPACT SCROLL VIEW BODY */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto pb-1 scroll-smooth">
        
        {/* CONDITIONAL SUB-HEADER FOR ADDRESS FORM GRID */}
        {(isCreatingNewAddress || editingAddressId) && (
          <div className="w-full bg-white px-4 py-3 border-b border-stone-100 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleFormBack}
              className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center cursor-pointer hover:bg-stone-100 border border-stone-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-stone-700 stroke-[3]" />
            </button>
            <span className="text-[12px] font-black uppercase tracking-wider text-stone-850">
              {editingAddressId ? "EDIT ADDRESS DETAILS" : "ADDRESS DETAILS"}
            </span>
          </div>
        )}

        {/* SCREEN FLOW 1: 2x4 ADDRESS DETAILS INPUT FORM */}
        {(isCreatingNewAddress || editingAddressId) ? (
          <div className="p-3.5 bg-white shrink-0">
            <div className="grid grid-cols-2 gap-3">
              
              {/* 1. STATE */}
              <div className="border-[1.5px] border-stone-200 rounded-2xl px-4 py-2.5 flex flex-col bg-stone-50 select-none">
                <label className="text-[8px] font-black uppercase text-stone-400 tracking-widest mb-1 leading-none">
                  STATE
                </label>
                <input
                  type="text"
                  value={stateInput}
                  readOnly
                  disabled
                  className="w-full text-[11px] font-black text-stone-850 bg-transparent outline-none p-0 border-none cursor-not-allowed focus:ring-0"
                />
              </div>

              {/* 2. EXACT GPS LOCATION */}
              <div
                onClick={() => fetchAutomaticGPSDetails(true)}
                className="border-[1.5px] border-blue-200 rounded-2xl px-4 py-2 flex flex-col bg-blue-50/10 hover:bg-blue-50/20 transition-all cursor-pointer select-none relative group"
              >
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-[8.5px] font-black uppercase text-blue-600 tracking-widest">
                    📍 EXACT GPS
                  </span>
                  <button
                    type="button"
                    className="text-[7.5px] font-black text-blue-500 hover:underline uppercase"
                  >
                    {gpsLoading ? 'SYNCING...' : 'SYNC'}
                  </button>
                </div>
                <span className="text-[11px] font-mono font-black text-blue-700 mt-1.5 leading-none truncate">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </div>

              {/* 3. PINCODE */}
              <div className={`border-[1.5px] rounded-2xl px-4 py-2.5 flex flex-col bg-white transition-all ${
                pincodeInput.length === 0 ? 'border-stone-200 focus-within:border-[#0b7a2d]' : (pincodeInput.length === 6 ? 'border-green-500' : 'border-red-500')
              }`}>
                <label className="text-[8px] font-black uppercase text-stone-400 tracking-widest mb-1 leading-none">
                  PINCODE
                </label>
                <input
                  type="number"
                  pattern="[0-9]*"
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                />
              </div>

              {/* 4. CITY / VILLAGE */}
              <div className="border-[1.5px] border-stone-200 focus-within:border-[#0b7a2d] rounded-2xl px-4 py-2.5 flex flex-col bg-white transition-all">
                <label className="text-[8px] font-black uppercase text-stone-400 tracking-widest mb-1 leading-none">
                  CITY / VILLAGE
                </label>
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                />
              </div>

              {/* 5. YOUR NAME */}
              <div className="border-[1.5px] border-stone-200 focus-within:border-[#0b7a2d] rounded-2xl px-4 py-2.5 flex flex-col bg-white transition-all">
                <label className="text-[8px] font-black uppercase text-stone-400 tracking-widest mb-1 leading-none">
                  YOUR NAME
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                />
              </div>

            </div>

          </div>
        ) : (
          /* SCREEN FLOW 2: LIST OF SAVED ADDRESSES FOR SUBSEQUENT USERS */
          <div className="pt-3 px-3.5 pb-2 shrink-0 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                SELECT DELIVERY ADDRESS
              </span>
              <span className="text-[10px] bg-emerald-50 text-[#0b7a2d] px-2.5 py-0.5 rounded-full font-extrabold border border-emerald-100">
                {savedAddresses.length} Saved
              </span>
            </div>

            {/* Saved Address list (Render all saved addresses so they can select or edit) */}
            <div className="flex flex-col gap-3">
              {savedAddresses.map((addr) => {
                const isSelected = addr.id === selectedAddressId;
                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`bg-white rounded-[20px] border-2 p-4 flex items-start justify-between min-w-0 w-full relative transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0b7a2d] border-l-[8px] border-l-[#0b7a2d] shadow-sm'
                        : 'border-stone-200/80 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 items-start text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-[#e2f3e7] text-[#0b7a2d] text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full leading-none">
                          HOME
                        </span>
                        <span className="text-[13px] font-black text-stone-900 leading-none">
                          {addr.name}
                        </span>
                      </div>
                      
                      <div className="text-[11px] tracking-tight leading-normal mt-1.5 flex flex-col gap-0.5">
                        <span className="font-extrabold text-stone-800">
                          {addr.city}
                        </span>
                        <span className="text-stone-500 text-[10px] font-semibold">
                          {addr.pincode}
                        </span>
                      </div>

                      <div className="mt-2.5 px-2.5 py-1 bg-blue-50/60 rounded-lg border border-blue-100/50 flex items-center gap-1 self-start select-none">
                        <span className="text-[#1d4ed8] text-[9.5px] font-black tracking-wide uppercase font-mono">
                          GPS: {addr.lat.toFixed(5)}, {addr.lng.toFixed(5)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAddress(addr);
                      }}
                      className="flex items-center gap-1 bg-white border border-stone-200 hover:border-stone-300 shadow-3xs rounded-full text-stone-700 text-[9px] font-black px-3 py-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 text-stone-600" />
                      <span>EDIT</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick helper control buttons */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={handleCreateNewAddress}
                className="w-full bg-white border-2 border-dashed border-emerald-200 hover:border-emerald-300 text-[#0b7a2d] py-3.5 px-3 rounded-2xl flex items-center justify-center space-x-1.5 text-[10.5px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-3xs"
              >
                <Plus className="w-4 h-4 stroke-[3] text-[#0b7a2d]" />
                <span>NEW ADDRESS</span>
              </button>

              <button
                type="button"
                onClick={handleSyncCurrentLocation}
                disabled={gpsLoading}
                className="w-full bg-white border border-blue-200 hover:border-blue-300 text-blue-600 py-3.5 px-3 rounded-2xl flex items-center justify-center space-x-1.5 text-[10.5px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-3xs disabled:opacity-60"
              >
                <LocateFixed className={`w-4 h-4 text-blue-600 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{gpsLoading ? 'SYNCING...' : 'SYNC GPS'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Cohesive Tagline Banner */}
        <div className="flex flex-col items-center justify-center my-6 py-4 opacity-75">
          <div className="w-12 h-12 rounded-full bg-emerald-500/5 flex items-center justify-center mb-2">
            <Leaf className="w-6 h-6 text-[#0b7a2d]" />
          </div>
          <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase">
            100% FRESH • DIRECT FROM FARM
          </span>
        </div>

        {/* 6. Itemized Cost Calculations Box */}
        <div id="itemized-cost-summary" className="px-3.5 mt-2">
          <CartCalculationOverlay
            subtotal={subtotal}
            deliveryFee={finalDeliveryFee}
            total={finalTotal}

            isMultiShop={items.reduce((acc, item) => {
              const rawId = (item as any).shopId || (item as any).productShopId || "admin";
              acc.add(rawId);
              return acc;
            }, new Set<string>()).size > 1}
          />
        </div>

        {/* Promotional Delivery Offers Banner */}
        <div className="mt-5 mb-1 px-3.5 flex items-center justify-between gap-3">
          <div className="flex-1 bg-amber-50 border-2 border-amber-400/80 p-3 rounded-[1.25rem] flex flex-col items-center justify-center relative shadow-[0_4px_12px_rgba(251,191,36,0.15)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 leading-tight">ORDER ABOVE ₹499</span>
            <span className="text-[12px] font-black text-amber-700 mt-1.5 flex items-center gap-1.5">🛵 50% OFF Delivery</span>
          </div>
          <div className="flex-1 bg-emerald-50 border-2 border-emerald-400/80 p-3 rounded-[1.25rem] flex flex-col items-center justify-center relative shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900 leading-tight">ORDER ABOVE ₹999</span>
            <span className="text-[12px] font-black text-emerald-700 mt-1.5 flex items-center gap-1.5">🎉 100% FREE</span>
          </div>
        </div>
      </div>

      {/* 8. COMPACT COHESIVE CHECKOUT FOOTER FLOATING ACTION BAR */}
      <div className="bg-white border-t border-stone-200 shrink-0 select-none flex flex-col justify-center z-50">
        {/* Pre-order banner */}
        <AnimatePresence>
          {isPreorder && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="bg-amber-100 text-amber-900 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5 overflow-hidden"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1 animate-pulse" />
              <div>
                <p className="text-[9.5px] font-black uppercase tracking-widest leading-none mb-1">
                  Shop Closed - Pre-order Active
                </p>
                <p className="text-[10px] font-medium leading-snug">
                  The selected shop is currently offline. Your order corresponds
                  to a pre-order and will be scheduled for delivery{" "}
                  <strong className="font-extrabold pb-0.5 border-b border-amber-900/40">
                    tomorrow morning
                  </strong>
                  .
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-sm mx-auto flex items-center justify-between gap-4 px-4.5 py-3">
          {/* Leftside: Total Cost Display */}
          <div className="flex flex-col space-y-0.5 shrink-0">
            <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest leading-none">
              Grand Total
            </span>
            <span className="text-[19px] font-black text-[#0e9f6e] leading-none tracking-tight font-sans">
              ₹{finalTotal}
            </span>
            <span className="text-[7.5px] bg-[#ecfdf5] text-emerald-700/90 border border-emerald-100 font-black tracking-widest px-1.5 py-0.5 rounded-md uppercase mt-1 self-start leading-none">
              Cash On Delivery
            </span>
          </div>

          {/* Rightside: Click To Place Order CTA */}
          <div className="flex-1 min-w-0">
            <motion.button
              whileTap={!isOutOfRange && !loading && !gpsLoading && !((isCreatingNewAddress || editingAddressId) && !isFormValid) ? { scale: 0.98 } : undefined}
              disabled={loading || gpsLoading || isOutOfRange || ((isCreatingNewAddress || editingAddressId) && !isFormValid)}
              onClick={(isCreatingNewAddress || editingAddressId) ? handleSaveAndPlaceOrder : handlePlaceOrder}
              className={`w-full py-4 px-3.5 rounded-xl text-white font-black text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all ${
                isOutOfRange || loading || gpsLoading || ((isCreatingNewAddress || editingAddressId) && !isFormValid)
                  ? "bg-stone-400 cursor-not-allowed opacity-80"
                  : "bg-[#0b7a2d] hover:bg-[#0a6c28] shadow-[#0b7a2d]/20 hover:shadow-[#0b7a2d]/30 cursor-pointer"
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>Configuring Route...</span>
                </div>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-white shrink-0" />
                  <span className="truncate">
                    {(isCreatingNewAddress || editingAddressId) ? "Save & Place Order" : "Place Order"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white stroke-[3] shrink-0" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
