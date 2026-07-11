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
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { auth } from "../services/firebase";
import { useUser } from "../context/UserContext";
import toast from "react-hot-toast";
import { CartCalculationOverlay, AddressConfirmationSheet } from "./cart/CartDrawer";
import { GoogleMap } from "@capacitor/google-maps";
import { Capacitor } from "@capacitor/core";
import {
  LOCAL_MAP_LANDMARKS,
  findNearestLandmark,
} from "../data/villageCoordinates";
import { calculateDistance } from "../lib/distance";
import { useCheckoutGPS, MORIGAON_CENTER } from "../hooks/useCheckoutGPS";
import { triggerSuccessHapticVibration } from "../services/nativeService";

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

  // Initialize Interactive Google Map (Web + Native Unified)
  useEffect(() => {
    if (!mapContainerRef.current || !googleMapsKey) return;

    let isMounted = true;
    let map: any = null;
    let liveDotMarker: any = null;

    const initMap = async () => {
      try {
        const loadScript = () => {
          return new Promise<any>((resolve, reject) => {
            if ((window as any).google && (window as any).google.maps) {
              resolve((window as any).google);
              return;
            }
            const existingScript = document.getElementById("google-maps-js-sdk");
            if (existingScript) {
              const interval = setInterval(() => {
                if ((window as any).google && (window as any).google.maps) {
                  clearInterval(interval);
                  resolve((window as any).google);
                }
              }, 100);
              return;
            }
            const script = document.createElement("script");
            script.id = "google-maps-js-sdk";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve((window as any).google);
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
          });
        };

        const google = await loadScript();
        if (!isMounted) return;

        // Render the interactive Google Map instance directly in the container
        map = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: coords.lat, lng: coords.lng },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          scaleControl: false,
          rotateControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy", // Essential for super smooth fluid drag on mobile touchscreens
        });

        nativeMapRef.current = map;

        // Place a high-contrast glowing green indicator representing actual GPS current location (hilta dulta button)
        if (gpsCoords && gpsCoords.lat && gpsCoords.lng) {
          liveDotMarker = new google.maps.Marker({
            position: { lat: gpsCoords.lat, lng: gpsCoords.lng },
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#0b7a2d", // Beautiful Grezto Brand Green
              fillOpacity: 1,
              strokeColor: "#FFFFFF", // High-contrast crisp border
              strokeWeight: 3,
            },
            title: "My Live Location",
            zIndex: 999,
          });
          liveDotMarkerRef.current = liveDotMarker;
        }

        // Camera Idle Listener translating drag positions back to coords
        map.addListener("idle", () => {
          const center = map.getCenter();
          if (center) {
            handleCameraChange({
              detail: { center: { lat: center.lat(), lng: center.lng() } },
            });
          }
        });

      } catch (err) {
        console.error("Google Maps JS API Init Failed:", err);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [googleMapsKey]);

  // Center map when coords change manually via search/text input
  useEffect(() => {
    if (nativeMapRef.current && lastInteraction === "text") {
      const map = nativeMapRef.current;
      if (typeof map.setCenter === "function") {
        map.setCenter({ lat: coords.lat, lng: coords.lng });
      }
    }
  }, [coords.lat, coords.lng, lastInteraction]);

  // Sync green live location dot marker when gpsCoords change
  useEffect(() => {
    if (liveDotMarkerRef.current && gpsCoords) {
      liveDotMarkerRef.current.setPosition({ lat: gpsCoords.lat, lng: gpsCoords.lng });
    }
  }, [gpsCoords]);

  const handlePlaceOrder = async () => {
    if (loading) return;

    if (!nameVal.trim()) {
      toast.error("Please enter Name first.");
      return;
    }

    if (!cityVal.trim()) {
      toast.error("Please enter City / Village first.");
      return;
    }

    if (!areaVal.trim()) {
      toast.error("Please enter Nearby Area first.");
      return;
    }

    const finalAddress = `${areaVal.trim()}, ${cityVal.trim()} (GPS Address: ${nominatimAddress || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`})`;

    // Save details to localStorage for future orders and mark details submitted
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "grezto_delivery_details",
          JSON.stringify({
            name: nameVal.trim(),
            city: cityVal.trim(),
            area: areaVal.trim(),
            landmark: landmarkVal.trim(),
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
      MORIGAON_CENTER.lat,
      MORIGAON_CENTER.lng,
    );

    if (isOutOfRange) {
      toast.error("Sorry! We only deliver within 6 KM from our store. You are outside our delivery zone.");
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

  return (
    <div className="w-full h-screen bg-[#f8faf8] flex flex-col justify-between font-sans overflow-hidden select-none relative">
      {/* 1. NATIVE INTEGRATED WHITE HEADER BLOCK */}
      <div className="w-full bg-white border-b border-stone-200/90 px-3.5 py-2.5 shrink-0 z-50 select-none">
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
            onClick={fetchAutomaticGPSDetails}
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
                Sorry! We only deliver within 6 KM from our store. You are outside our delivery zone.
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
        {/* 2. REPOSITIONED IMMERSIVE VISUAL MAP BOX CONTROLLER - Attaching to both side edges with full width look */}
        <div className="w-full bg-white relative flex flex-col flex-1 min-h-0 transition-all duration-300">
          {/* Map container - responsive height that fills available space */}
          <div
            ref={mapContainerRef}
            className="relative w-full flex-1 min-h-[185px] h-[185px] bg-transparent overflow-hidden select-none transition-all duration-300 z-10"
          >
            {/* Native Capacitor Map is injected here */}
            {!googleMapsKey && (
              <div className="w-full h-full bg-stone-100 flex flex-col items-center justify-center gap-2 text-stone-500">
                <span className="w-6 h-6 border-2 border-[#0b7a2d] border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-600">
                  Syncing Secure Map API Key...
                </span>
              </div>
            )}

            {/* Locked screen center red needle map pin */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="relative flex flex-col items-center">
                {/* Ping pulse indicator centered on the actual pin tip location */}
                <span className="absolute w-10 h-10 bg-red-650/15 rounded-full animate-ping border border-red-500/20 -translate-y-1" />

                {/* High-contrast, recognizable 📍 Emoji Pin */}
                <span className="text-[40px] leading-none select-none relative z-10 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.22)] -mt-11 translate-x-1">
                  📍
                </span>

                {/* Ambient drop shadow under the pin's point */}
                <div className="w-3 h-1.5 bg-stone-900/35 rounded-full blur-[1px] translate-y-0.5" />
              </div>
            </div>

            {/* Native "My Location" Floating Action Button */}
            <div className="absolute bottom-4 right-4 z-40">
              <button
                type="button"
                onClick={fetchAutomaticGPSDetails}
                disabled={gpsLoading}
                className={`w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg border border-stone-200 transition-all active:scale-95 ${gpsLoading ? 'opacity-75' : ''}`}
              >
                {gpsLoading ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <LocateFixed className="w-5 h-5 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* 3. Helper Layer - Restored signature yellow color, but styled as an ultra-slim, sleek, and elegant slice bar */}
          <div className="bg-[#fcb316] border-y border-stone-950/10 py-1 px-3.5 flex items-center justify-between text-[9px] font-black uppercase tracking-wider shrink-0 select-none">
            {/* Left side helper guide - extremely clear & slim black label */}
            <span className="text-[9px] text-[#0d140e] font-black flex items-center gap-1 font-sans uppercase tracking-[0.03em]">
              <span>👇 drag map to center doorstep</span>
            </span>
            {/* Right-aligned solid location selector tag - COMPACT & Vivid Green (kept exactly identical per user intent) */}
            <div className="flex items-center gap-1 bg-[#0b7a2d] text-white px-2.5 py-0.75 rounded-lg text-[9.5px] font-black uppercase shadow-xs tracking-wider transition-all cursor-pointer active:scale-95">
              <MapPin className="w-3 h-3 text-red-500 fill-red-500 animate-bounce" />
              <span>SELECT PLACE</span>
            </div>
          </div>

          {/* My Address Details - Auto triggers map coordinates movement upon edits */}
          <div className="pt-2 px-2.5 pb-2.5 bg-white shrink-0">
            {isDetailsSubmitted ? (
              <AddressConfirmationSheet
                nameVal={nameVal}
                areaVal={areaVal}
                cityVal={cityVal}
                lat={coords.lat}
                lng={coords.lng}
                onEdit={() => setIsDetailsSubmitted(false)}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="border-[1.5px] border-stone-400 rounded-[10px] px-2.5 py-1 flex flex-col justify-center bg-white focus-within:bg-emerald-50/10 focus-within:border-emerald-500 transition-colors">
                    <label className="text-[7.5px] font-black uppercase text-stone-600 font-sans tracking-widest mb-0.5 leading-none">
                      Name
                    </label>
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => {
                        setLastInteraction("text");
                        setNameVal(e.target.value);
                      }}
                      className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                    />
                  </div>

                  <div className="border-[1.5px] border-stone-400 rounded-[10px] px-2.5 py-1 flex flex-col justify-center bg-white focus-within:bg-emerald-50/10 focus-within:border-emerald-500 transition-colors">
                    <label className="text-[7.5px] font-black uppercase text-stone-600 font-sans tracking-widest mb-0.5 leading-none">
                      City / Village
                    </label>
                    <input
                      type="text"
                      value={cityVal}
                      onChange={(e) => {
                        setLastInteraction("text");
                        setCityVal(e.target.value);
                      }}
                      className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="border-[1.5px] border-stone-400 rounded-[10px] px-2.5 py-1 flex flex-col justify-center bg-white focus-within:bg-emerald-50/10 focus-within:border-emerald-500 transition-colors">
                    <label className="text-[7.5px] font-black uppercase text-stone-600 font-sans tracking-widest mb-0.5 leading-none">
                      Nearby Area
                    </label>
                    <input
                      type="text"
                      value={areaVal}
                      onChange={(e) => {
                        setLastInteraction("text");
                        setAreaVal(e.target.value);
                      }}
                      className="w-full text-[11px] font-black text-stone-900 bg-transparent outline-none p-0 border-none focus:ring-0 select-text"
                    />
                  </div>

                  <div className="border-[1.5px] border-blue-200 rounded-[10px] px-2.5 py-1 flex flex-col justify-center bg-blue-50/30 select-none cursor-not-allowed">
                    <label className="text-[7.5px] font-black uppercase text-[#1d4ed8]/80 font-sans tracking-widest mb-0.5 leading-none">
                      GPS Location
                    </label>
                    <input
                      type="text"
                      value={nominatimLoading ? "Locating exact address..." : (nominatimAddress || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)}
                      readOnly
                      disabled
                      className="w-full text-[11px] font-black text-[#1d4ed8] bg-transparent outline-none p-0 border-none cursor-not-allowed focus:ring-0 overflow-hidden text-ellipsis whitespace-nowrap"
                    />
                  </div>
                </div>

              </div>
            )}
          </div>
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
              whileTap={!isOutOfRange && !loading && !gpsLoading && nameVal.trim() && cityVal.trim() && areaVal.trim() ? { scale: 0.98 } : undefined}
              disabled={loading || gpsLoading || isOutOfRange}
              onClick={handlePlaceOrder}
              className={`w-full py-4 px-3.5 rounded-xl text-white font-black text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all ${
                isOutOfRange || loading || gpsLoading || !nameVal.trim() || !cityVal.trim() || !areaVal.trim()
                  ? "bg-stone-400 cursor-not-allowed opacity-80"
                  : "bg-[#0e9f6e] hover:bg-[#0b8058] shadow-emerald-700/10 hover:shadow-emerald-700/20 cursor-pointer"
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
                  <span className="truncate">Place Order</span>
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
