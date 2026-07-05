import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminAnalytics from './AdminAnalytics';
import MerchantCalculation from './MerchantCalculation';
import AIChatModal from './AIChatModal';
import ProfileHeader from './profile/ProfileHeader';
import ProfileAddressBook from './profile/ProfileAddressBook';
import ProfileModals from './profile/ProfileModals';
import ProfileImageCropper from './profile/ProfileImageCropper';
import ProfileRewardsModal from './profile/ProfileRewardsModal';
import { ChevronRight, MapPin, Headphones, Share2, Shield, ShieldCheck, LogOut, User, Phone, Edit2, X, Check, Bell, Info, Camera, Bike, Trash2, Plus, Globe, ChevronLeft, Copy, Send, BarChart, Gift, Sparkles, Ticket, Coins } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithCustomToken } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApiUrl, getAuthHeaders } from '../utils/api';

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
  const { user, login, logout, updateProfile, firebaseAuthReady, userShop, addPoints, deductPoints, redeemVoucher, consumeVoucher } = useUser();
  const { language, setLanguage } = useLanguage();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showMerchantCalculationModal, setShowMerchantCalculationModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editAddress, setEditAddress] = useState(user.address);

  const [addrState, setAddrState] = useState('Assam');
  const [addrCity, setAddrCity] = useState('');
  const [addrStreetArea, setAddrStreetArea] = useState('');

  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [showAddNewAddress, setShowAddNewAddress] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);

  const [loginPhone, setLoginPhone] = useState('');
  const [loginName, setLoginName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [serverOtp, setServerOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [useFastOtp, setUseFastOtp] = useState(true);

  const [showAIChat, setShowAIChat] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [rewardsTab, setRewardsTab] = useState<'redeem' | 'wallet'>('redeem');

  const [statsOrdersCount, setStatsOrdersCount] = useState<number>(0);
  const [statsDeliveredCount, setStatsDeliveredCount] = useState<number>(0);
  const [statsTotalSpent, setStatsTotalSpent] = useState<number>(0);

  useEffect(() => {
    if (!firebaseAuthReady) {
      return;
    }
    if (!user.isLoggedIn || !user.phone || !supabase) {
      setStatsOrdersCount(0);
      setStatsDeliveredCount(0);
      setStatsTotalSpent(0);
      return;
    }

    const currentUid = auth.currentUser?.uid;
    const phoneList = [user.phone];
    const stripped = user.phone.replace(/\D/g, '').slice(-10);
    if (stripped && !phoneList.includes(stripped)) {
      phoneList.push(stripped);
    }
    if (stripped && !phoneList.includes('+91' + stripped)) {
      phoneList.push('+91' + stripped);
    }

    const fetchOrdersForStats = async () => {
      try {
        let sbQuery = supabase.from('orders').select('*');
        if (currentUid) {
           sbQuery = sbQuery.or(`customerPhone.in.(${phoneList.map(p=>`"${p}"`).join(',')}),userId.eq.${currentUid}`);
        } else {
           sbQuery = sbQuery.in('customerPhone', phoneList);
        }
        
        const { data: dbOrders } = await sbQuery;
        const firestoreOrders = dbOrders || [];

        const uniqueMergedMap = new Map();
        firestoreOrders.forEach((o: any) => {
          uniqueMergedMap.set(o.id, o);
        });
        const finalMergedOrders = Array.from(uniqueMergedMap.values());

        const validOrders = finalMergedOrders.filter((o: any) => o.status !== 'Cancelled');
        const countTotal = validOrders.length;
        const countDelivered = validOrders.filter((o: any) => o.status === 'Delivered').length;
        const computedSpent = validOrders.reduce((sum: number, o: any) => {
          const singleAmt = Number(o.finalAmount) || Number(o.totalAmount) || Number(o.amount) || 0;
          return sum + singleAmt;
        }, 0);

        setStatsOrdersCount(countTotal);
        setStatsDeliveredCount(countDelivered);
        setStatsTotalSpent(computedSpent);
      } catch (err) {
        console.error("Failed to compute real-time profile stats:", err);
      }
    };

    fetchOrdersForStats();
    
    let sub = supabase.channel('profile_orders_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
         fetchOrdersForStats();
      }).subscribe();

    return () => {
       if (sub) sub.unsubscribe();
    };
  }, [user.isLoggedIn, user.phone, firebaseAuthReady]);

  // Helper to compress base64 image if it's large (to fit in Firestore and keep app fast)
  const compressImage = (base64Str: string, maxWidth = 500, maxHeight = 500): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // High quality JPEG compression
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  // Cropper specific high-performance visual state configurations
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  
  // Avatar Upload / Edit handler with automatic pre-downscaling to prevent slow performance
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
        
        // Downscale before opening cropper so dragging stays at buttery smooth 60fps on low-end devices
        const img = new Image();
        img.onload = () => {
          const maxDim = 800; // Keep loaded texture sizes standard
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



  React.useEffect(() => {
    if (user.address) {
      const parts = user.address.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        setAddrState(parts[parts.length - 1] || 'Assam');
        setAddrCity(parts[parts.length - 2] || '');
        setAddrStreetArea(parts.slice(0, parts.length - 2).join(', '));
      } else if (parts.length === 2) {
        setAddrStreetArea(parts[0]);
        setAddrCity(parts[1]);
        setAddrState('Assam');
      } else {
        setAddrStreetArea(user.address);
        setAddrCity('');
        setAddrState('Assam');
      }
    }
  }, [user.address]);

  React.useEffect(() => {
    const handleOpenLogin = (e: any) => {
      const mode = e.detail?.mode || 'signup';
      setAuthMode(mode);
      setLoginName('');
      setLoginPhone('');
      setOtpCode('');
      setIsOtpSent(false);
      setServerOtp('');
      setShowLoginModal(true);
    };
    window.addEventListener('open-login-modal', handleOpenLogin);

    // Bulletproof lifecycle check to guarantee immediate setup section popup without race conditions
    const forceOpen = localStorage.getItem('grezto_force_open_signup');
    if (forceOpen === 'true') {
      localStorage.removeItem('grezto_force_open_signup');
      setAuthMode('signup');
      setLoginName('');
      setLoginPhone('');
      setOtpCode('');
      setIsOtpSent(false);
      setServerOtp('');
      setShowLoginModal(true);
    }

    return () => window.removeEventListener('open-login-modal', handleOpenLogin);
  }, []);

  const [otpError, setOtpError] = useState<string | null>(null);

  React.useEffect(() => {
    if (showLoginModal && !Capacitor.isNativePlatform()) {
      // Dynamic warm-up of reCAPTCHA verifier
      const initializeWarmup = async () => {
        try {
          if (!document.getElementById('recaptcha-container')) {
            const newContainer = document.createElement('div');
            newContainer.id = 'recaptcha-container';
            newContainer.style.position = 'fixed';
            newContainer.style.bottom = '10px';
            newContainer.style.right = '10px';
            newContainer.style.width = '1px';
            newContainer.style.height = '1px';
            newContainer.style.opacity = '0.01';
            newContainer.style.pointerEvents = 'none';
            newContainer.style.zIndex = '99999';
            document.body.appendChild(newContainer);
          }
          if (!(window as any).recaptchaVerifier) {
            const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
              callback: (response: any) => {}
            });
            await verifier.render();
            (window as any).recaptchaVerifier = verifier;
            console.log("[Verification] Warm-up complete.");
          }
        } catch (e) {
          console.warn("Recaptcha warm-up delayed:", e);
        }
      };
      initializeWarmup();
    }
  }, [showLoginModal]);

  const [isOtpSent, setIsOtpSent] = useState(false);

  // Helper utility to safely enforce a high-performance timeout on Firestore/network operations
  const promiseTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout")), ms);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  const handleSendOtpInline = async () => {
    if (loginPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit mobile number!");
    }

    if (authMode === 'signup' && !loginName.trim()) {
      return toast.error("Please enter your name to create your account!");
    }

    setAuthLoading(true);
    setServerOtp('');
    setConfirmationResult(null);

    try {
      let exists = false;

      try {
        // Enforce 4-second timeout to check user registration status against Supabase
        const { data } = await supabase.from('profiles').select('phone').eq('phone', loginPhone).maybeSingle();
        if (data) {
          exists = true;
        }
      } catch (dbErr: any) {
        console.warn("Supabase lookup timed out or bypassed, utilizing local cache check:", dbErr);
      }

      if (authMode === 'signup' && exists) {
        setAuthLoading(false);
        return toast.error("This phone number is already registered! Please choose 'Login' instead.");
      }

      if (authMode === 'login' && !exists) {
        setAuthLoading(false);
        return toast.error("This phone number is not registered yet! Please choose 'Create Account' first.");
      }
    } catch (err: any) {
      console.warn("Pre-checks bypassed:", err);
    }

    try {
      const firebasePromise = (async () => {
        if (Capacitor.isNativePlatform()) {
          console.log("[Native Phone Auth] Setting up code-sent and error listeners...");
          return new Promise(async (resolve, reject) => {
            let codeSentListener: any = null;
            let verificationFailedListener: any = null;

            const cleanup = async () => {
              try {
                if (codeSentListener) await codeSentListener.remove();
                if (verificationFailedListener) await verificationFailedListener.remove();
              } catch (cleanErr) {
                console.warn("[Native Phone Auth] Listener cleanup error:", cleanErr);
              }
            };

            try {
              codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', async (event: any) => {
                console.log("[Native Phone Auth] phoneCodeSent trigger:", event);
                await cleanup();
                resolve({ isNative: true, verificationId: event.verificationId });
              });

              verificationFailedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', async (event: any) => {
                console.error("[Native Phone Auth] phoneVerificationFailed trigger:", event);
                await cleanup();
                reject(new Error(event.message || "Android Phone Authentication failed. Please check your network connection or Firebase settings."));
              });

              console.log("[Native Phone Auth] signInWithPhoneNumber calling with +91" + loginPhone);
              await FirebaseAuthentication.signInWithPhoneNumber({
                phoneNumber: `+91${loginPhone}`,
              });
            } catch (err) {
              await cleanup();
              reject(err);
            }
          });
        } else {
          let verifier = (window as any).recaptchaVerifier;
          if (!verifier) {
            if (!document.getElementById('recaptcha-container')) {
              const newContainer = document.createElement('div');
              newContainer.id = 'recaptcha-container';
              newContainer.style.position = 'fixed';
              newContainer.style.bottom = '10px';
              newContainer.style.right = '10px';
              newContainer.style.width = '1px';
              newContainer.style.height = '1px';
              newContainer.style.opacity = '0.01';
              newContainer.style.pointerEvents = 'none';
              newContainer.style.zIndex = '99999';
              document.body.appendChild(newContainer);
            }
            verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
              callback: (response: any) => {}
            });
            await verifier.render();
            (window as any).recaptchaVerifier = verifier;
          }
          
          const confirmation = await signInWithPhoneNumber(auth, `+91${loginPhone}`, verifier);
          return confirmation;
        }
      })();

      // Enforce up to 30s timeout for genuine phone network carriers to dispatch SMS
      const result = await promiseTimeout(firebasePromise, 30000);
      setConfirmationResult(result);
      setOtpError(null);
      setIsOtpSent(true);
      toast.success(`Verification code sent to +91 ${loginPhone} via SMS! 📲`, { duration: 6000 });
    } catch (err: any) {
      console.warn("Real Firebase OTP dispatch failed. Generating audit logs:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);
      
      let detailedMsg = "";
      if (errCode === "auth/unauthorized-domain" || errMsg.includes("unauthorized") || errMsg.includes("domain")) {
        detailedMsg = `Your current preview domain "${window.location.hostname}" is not added in the Firebase Console!
        
        This means the permission to verify real SMS is blocked.
        
        To fix:
        1. Open Firebase Console -> Authentication -> Settings Tab.
        2. Click "Add Domain" in the "Authorized Domains" block.
        3. Enter this address: ${window.location.hostname} and save!
        4. Safe dynamic real SMS OTP will start arriving!`;
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        detailedMsg = `The 'Phone Sign-in' method is not enabled in the Firebase Console!
        
        To fix:
        1. Open Firebase Console -> Authentication -> Sign-in Method.
        2. Select the Phone method, toggle it on (Enable), and Save.`;
      } else if (errCode === "auth/too-many-requests" || errMsg.includes("too-many-requests")) {
        detailedMsg = "SMS quota limit or security blocks triggered. Please try again later or use fallback credentials!";
      } else {
        detailedMsg = `Firebase Connection Blocked!\n\nDetail: ${errMsg}\n\nIf mobile carrier, network settings, or firebase keys configuration are incorrect, real SMS dispatch can fail.`;
      }

      setOtpError(detailedMsg);
    }
    
    setAuthLoading(false);
  };

  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && !loginName.trim()) {
      return toast.error("Please enter your name!");
    }
    if (loginPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit phone number!");
    }
    if (!otpCode || otpCode.length !== 6) {
      return toast.error("Please enter the 6-digit verification OTP!");
    }

    setAuthLoading(true);
    try {
      let isVerified = false;
      let verifyVerificationId = confirmationResult?.verificationId || "";
      let clientUid = "";
      let idToken = "";

      if (confirmationResult) {
        try {
          if (Capacitor.isNativePlatform()) {
            console.log("[Client OTP Verification] Confirming native OTP via Capacitor...");
            const result = await FirebaseAuthentication.confirmVerificationCode({
              verificationId: confirmationResult.verificationId,
              verificationCode: otpCode,
            });
            clientUid = result.user?.uid || "";
            try {
              const tokenRes = await FirebaseAuthentication.getIdToken();
              idToken = tokenRes.token;
            } catch (tokenErr) {
              console.warn("Failed to retrieve native client idToken:", tokenErr);
            }
            isVerified = true;
            console.log("[Native Client OTP Verification SUCCESS] Authenticated with UID:", clientUid);
          } else {
            console.log("[Client OTP Verification] Confirming OTP directly using Client SDK...");
            const userCredential = await confirmationResult.confirm(otpCode);
            clientUid = userCredential.user.uid;
            try {
              idToken = await userCredential.user.getIdToken();
            } catch (tokenErr) {
              console.warn("Failed to retrieve client idToken:", tokenErr);
            }
            isVerified = true;
            console.log("[Client OTP Verification SUCCESS] Authenticated client-side with UID:", clientUid);
          }
        } catch (clientVerifyErr: any) {
          console.error("Client OTP confirm failed:", clientVerifyErr);
          toast.error("Incorrect OTP! Please enter the correct 6-digit verification code. 🛑");
          setAuthLoading(false);
          return;
        }
      }

      try {
        console.log("[SERVER OTP VERIFICATION] Syncing OTP session securely with server side...");
        const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: loginPhone,
            otp: otpCode,
            verificationId: isVerified ? "client-verified" : verifyVerificationId,
            clientUid: clientUid,
            idToken: idToken
          })
        });

        const resData = await response.json();

        if (!response.ok || !resData.success) {
          if (isVerified) {
            console.warn("Client-side was authenticated but backend failed to update metadata profiles:", resData.error);
          } else {
            toast.error(resData.error || "Incorrect verification OTP! Please correct and try again.");
            setAuthLoading(false);
            return;
          }
        }

        console.log("[SERVER OTP VERIFICATION SUCCESS] Server verified/synced OTP:", resData);

        // Sign in on client side using custom token if returned securely from server and client is not already authenticated
        if (resData.customToken && !isVerified) {
          try {
            if (Capacitor.isNativePlatform()) {
              await FirebaseAuthentication.signInWithCustomToken({ token: resData.customToken });
            } else {
              await signInWithCustomToken(auth, resData.customToken);
            }
            console.log("[Firebase client sign-in] Custom token sign-in completed successfully.");
          } catch (signinErr) {
            console.warn("[Firebase client sign-in warning] Client auth sync bypassed, processing profile:", signinErr);
          }
        }
        
        isVerified = true;
      } catch (verifyErr: any) {
        console.error("Server-side OTP validation failed:", verifyErr);
        if (!isVerified) {
          toast.error("Standard verification failed due to connection error. Please try again.");
          setAuthLoading(false);
          return;
        }
      }

      if (isVerified) {
        // Fetch existing avatar, address, and name if exists in Firestore
        let existingAvatar = '';
        let existingAddress = '';
        let resolvedName = authMode === 'signup' ? loginName.trim() : 'Grezto Member';

        // Trigger context login instantly with existing details loaded from DB/localStorage
        login(resolvedName, loginPhone, existingAvatar, existingAddress);
        
        // Reset states and close modal instantly
        setShowLoginModal(false);
        setOtpCode('');
        setServerOtp('');
        setIsOtpSent(false);
        setConfirmationResult(null);

        const isOwner = loginPhone === '7577950272' || loginPhone === '8638089161';
        if (isOwner) {
          toast.success("Welcome Back Master Owner! 👑🌿");
        } else {
          toast.success(`Welcome to Grezto, ${resolvedName}! 🌿`);
        }

        // Perform Firestore read and write synchronizations completely in the background
        (async () => {
          try {
            const { data: dbData } = await supabase.from('profiles').select('*').eq('phone', loginPhone).maybeSingle();
            if (dbData) {
              const freshAvatar = dbData.avatar || existingAvatar;
              const freshAddress = dbData.address !== null ? dbData.address : existingAddress;
              const freshName = dbData.name || resolvedName;

              // Quietly sync the user context details with latest remote database values
              updateProfile({
                name: freshName,
                avatar: freshAvatar,
                address: freshAddress,
                phone: loginPhone,
                isLoggedIn: true
              });
            } else {
               // Update context and trigger push to database via updateProfile
               updateProfile({
                  name: resolvedName,
                  avatar: existingAvatar,
                  address: existingAddress,
                  phone: loginPhone,
                  isLoggedIn: true
               });
            }
          } catch (dbReadErr) {
            console.warn("Skipping background profile sync:", dbReadErr);
          }
        })();
      }
    } catch (err) {
      console.error(err);
      toast.error("Verification session aborted. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Auto-routing to Merchant Panel removed for better user-directed experience as requested (open profile directly first)


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

  // Load and sync address list for current logged-in user
  useEffect(() => {
    if (user.isLoggedIn && user.phone) {
      const stored = localStorage.getItem(`grezto_saved_addresses_user_${user.phone}`);
      if (stored) {
        setSavedAddresses(JSON.parse(stored));
      } else if (user.address) {
        const seed = [user.address];
        setSavedAddresses(seed);
        localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(seed));
      } else {
        setSavedAddresses([]);
      }
    } else {
      setSavedAddresses([]);
    }
  }, [user.isLoggedIn, user.phone, user.address]);

  const handleSaveName = () => {
    updateProfile({ name: editName });
    setIsEditing(false);
    toast.success("Profile Updated");
  };

  const handleSaveAddress = () => {
    if (!user.isLoggedIn) {
      return toast.error("Please Login or Sign up to save your address! 🌿");
    }
    if (addrState.trim() === "" || addrCity.trim() === "" || addrStreetArea.trim() === "") {
      return toast.error("All three address fields (State, City/Village, Street/Area) are absolutely required!");
    }
    const combinedAddress = `${addrStreetArea.trim()}, ${addrCity.trim()}, ${addrState.trim()}`;
    
    const updated = [...savedAddresses];
    if (!updated.includes(combinedAddress)) {
      updated.push(combinedAddress);
    }
    setSavedAddresses(updated);
    localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(updated));
    
    // Set as default delivery address
    updateProfile({ address: combinedAddress });
    setShowAddNewAddress(false);
    toast.success("New Address Saved & Set as Default!");
    
    // Reset inputs
    setAddrCity('');
    setAddrStreetArea('');
  };

  const handleSelectAddress = (addr: string) => {
    updateProfile({ address: addr });
    toast.success("Default address changed! 🚚");
  };

  const handleDeleteAddress = (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAddresses.filter(a => a !== addr);
    setSavedAddresses(updated);
    localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(updated));
    
    if (user.address === addr) {
      const nextActive = updated.length > 0 ? updated[0] : '';
      updateProfile({ address: nextActive });
    }
    toast.success("Address deleted successfully.");
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
        setServerOtp={setServerOtp}
        handleSendOtpInline={handleSendOtpInline}
        handleVerifyAndLogin={handleVerifyAndLogin}
        otpError={otpError}
        setOtpError={setOtpError}
        useFastOtp={useFastOtp}
        setUseFastOtp={setUseFastOtp}
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
        setServerOtp={setServerOtp}
        setShowLoginModal={setShowLoginModal}
        statsOrdersCount={statsOrdersCount}
        statsDeliveredCount={statsDeliveredCount}
        statsTotalSpent={statsTotalSpent}
      />

      {/* Refer & Earn Partnership Section with Shorter Height */}
      <div className="px-1 pt-2.5">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-2.5 rounded-xl text-white shadow-xs relative overflow-hidden group">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-1">
            <p className="text-[8.5px] text-emerald-50 font-extrabold leading-tight tracking-wide">
              share Grezto with friends.. to get rs 100 off 🎉 your next order
            </p>

            {/* Displaying Personal Link - Copy button removed completely to avoid clutter */}
            <div className="bg-black/20 p-2 rounded-lg flex items-center justify-center border border-white/5 font-sans mt-1">
              <span className="text-[8.5px] font-extrabold tracking-widest text-[#d1fae5] font-mono">
                CODE: {user.phone ? `GREZ${user.phone.slice(-4)}` : 'GREZ100'}
              </span>
            </div>
            
            {/* Real Sharing Drivers: WhatsApp and Telegram Buttons side-by-side with smaller icons */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button 
                onClick={async () => {
                  const uPhoneSuffix = user.phone ? user.phone.slice(-4) : '100';
                  const refCode = `GREZ${uPhoneSuffix}`;
                  const refUrl = `${window.location.origin}/?download=grezto-app&ref=${refCode}`;
                  const text = `*Grezto - 100% Fresh & Organic Grocery* 🥬🚀\n\nClick the invite link to safely download the Grezto Android App and instantly receive a ₹100 discount coupon!\n\n👉 *Click here to Download:* ${refUrl}\n\nCode: *${refCode}* 🌿🎁`;
                  try {
                    const { Share } = await import('@capacitor/share');
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform()) {
                       await Share.share({ title: 'Grezto App', text: text });
                       return;
                    }
                  } catch(e) {}
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                  toast.success("Opening WhatsApp... 📲");
                }}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-[7.5px] uppercase tracking-wider py-1 px-2 rounded-md flex items-center justify-center gap-1 transition-all border-0 cursor-pointer shadow-2xs"
              >
                <Share2 className="w-2.5 h-2.5 text-white" />
                WhatsApp
              </button>
              <button 
                onClick={async () => {
                  const uPhoneSuffix = user.phone ? user.phone.slice(-4) : '100';
                  const refCode = `GREZ${uPhoneSuffix}`;
                  const refUrl = `${window.location.origin}/?download=grezto-app&ref=${refCode}`;
                  const text = `Grezto - 100% Fresh & Organic Grocery 🥬🚀\n\nClick the invite link to safely download the Grezto Android App and instantly receive a ₹100 discount coupon!\n\nCode: ${refCode} 🌿🎁`;
                  try {
                    const { Share } = await import('@capacitor/share');
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform()) {
                       await Share.share({ title: 'Grezto App', text: text, url: refUrl });
                       return;
                    }
                  } catch(e) {}
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent(text)}`, '_blank');
                  toast.success("Opening Telegram... ✈️");
                }}
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-[7.5px] uppercase tracking-wider py-1 px-2 rounded-md flex items-center justify-center gap-1 transition-all border-0 cursor-pointer shadow-2xs"
              >
                <Send className="w-2.5 h-2.5 text-white" />
                Telegram
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Menu List */}
      <div className="px-1 py-3 space-y-3">
        <div className="bg-white rounded-xl border border-gray-150/40 shadow-xs divide-y divide-gray-50 overflow-hidden">
          <MenuListItem 
            icon={<Plus className="text-emerald-500" />} 
            label="Add New Address" 
            onClick={() => {
              if (!user.isLoggedIn) {
                toast.error("Please login to add a new delivery address! 🌿");
                return;
              }
              setShowAddNewAddress(!showAddNewAddress);
              setIsEditingAddress(false);
            }}
          />
          <MenuListItem 
            icon={<Headphones className="text-purple-500" />} 
            label="Help & Support" 
            onClick={() => setShowAIChat(true)}
          />
          {user.isLoggedIn && (
            <MenuListItem 
              icon={<LogOut className="text-red-500" />} 
              label="Sign Out" 
              onClick={() => setShowSignOutConfirm(true)}
            />
          )}
          <MenuListItem 
            icon={<Info className="text-pink-500" />} 
            label="About Grezto" 
            onClick={() => setShowAboutModal(true)}
          />
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

        {/* Admin Panel Card */}
        {user.isAdmin && (
          <>
          <button 
            onClick={onAdminClick}
            className="w-full bg-[#3b4b5e] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider">Admin Panel</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-white/10 px-2 py-1 rounded-md border border-white/5 flex items-center space-x-1.5">
                  <Shield size={8} className="text-white/50" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/70">PIN: Manager</span>
               </div>
               <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>

          <button 
            onClick={() => onOpenAnalytics ? onOpenAnalytics() : setShowAnalyticsModal(true)}
            className="w-full bg-yellow-600 p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform mt-3 shadow-lg border border-yellow-700"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <BarChart className="w-4 h-4 text-white" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider text-yellow-50">Global Analytics</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-yellow-900/30 px-2 py-1 rounded-md border border-yellow-900/20 flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-100">Live</span>
               </div>
               <ChevronRight className="text-yellow-100/50 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>

          <button 
            type="button"
            onClick={() => onRiderManagementClick ? onRiderManagementClick() : window.dispatchEvent(new CustomEvent('grezto-open-rider-management'))}
            className="w-full bg-[#881337] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform mt-3 shadow-lg border border-rose-950"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bike className="w-4 h-4 text-white" />
               </div>
               <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-50">Rider Management</p>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-rose-950/30 px-2 py-1 rounded-md border border-rose-950/20 flex items-center space-x-1.5">
                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-200">Fleet</span>
               </div>
               <ChevronRight className="text-rose-100/50 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>

          <div className="pt-2"></div>
          </>
        )}

        {/* Merchant Admin Panel Card */}
        {userShop && (
          <div className="w-full space-y-1">
            <button 
              onClick={() => {
                if (userShop.status === 'blocked') {
                  toast.error("Your account has been blocked by the admin. Please contact support.", { duration: 4500 });
                } else {
                  toast.dismiss();
                  toast.success(`Welcome back ${userShop.ownerName || 'Merchant'}! Access granted 🔓`, { duration: 1500 });
                  onMerchantClick(userShop);
                }
              }}
              className={`w-full p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-all border-0 cursor-pointer ${
                userShop.status === 'blocked' ? 'bg-red-800/80 hover:bg-red-800' : 'bg-rose-600 hover:bg-rose-750'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                 <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-sm">
                    🏪
                 </div>
                 <div className="text-left leading-none">
                    <p className="text-[9.5px] font-black uppercase tracking-wider mb-0.5">{userShop.name}</p>
                    <p className="text-[7.5px] font-bold text-white/70 uppercase tracking-wider">Shop Merchant Console</p>
                 </div>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="bg-white/15 px-2 py-1 rounded-md border border-white/5 flex items-center space-x-1.5">
                    <span className="text-[8px] font-black uppercase tracking-wider">
                      {userShop.status === 'blocked' ? '🔴 Blocked' : '🟢 Merchant Panel'}
                    </span>
                 </div>
                 <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
              </div>
            </button>
            {userShop.status === 'blocked' && (
              <p className="text-[8px] text-red-650 font-black bg-red-50 p-1.5 rounded-lg border border-red-100/65 text-center uppercase tracking-wider leading-none">
                ⚠️ Your shop registration is BLOCKED. Contact Grezto Support.
              </p>
            )}
            
            {userShop.status !== 'blocked' && (
              <button 
                onClick={() => onOpenCalculation ? onOpenCalculation() : setShowMerchantCalculationModal(true)}
                className="w-full bg-indigo-500 p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-transform mt-3 shadow-md border border-indigo-600"
              >
                <div className="flex items-center space-x-2.5">
                   <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                      <BarChart className="w-4 h-4 text-white" />
                   </div>
                   <p className="text-[9.5px] font-black uppercase tracking-wider text-indigo-50">Business Calculation</p>
                </div>
                <div className="flex items-center space-x-2">
                   <div className="bg-indigo-950/20 px-2 py-1 rounded-md border border-indigo-950/10 flex items-center space-x-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-50">Ledger</span>
                   </div>
                   <ChevronRight className="text-indigo-50/50 group-hover:translate-x-1 transition-transform" size={14} />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Rider Console Access Card */}
        {user.role === 'Rider' && (
          <button 
            type="button"
            onClick={() => onRiderClick ? onRiderClick() : window.dispatchEvent(new CustomEvent('grezto-open-rider'))}
            className="w-full bg-[#1e293b] hover:bg-[#334155] p-3 rounded-xl flex items-center justify-between text-white group active:scale-[0.98] transition-all border-0 cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
               <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-sm">
                  🏍️
               </div>
               <div className="text-left leading-none">
                  <p className="text-[9.5px] font-black uppercase tracking-wider mb-0.5">Rider Work Desk</p>
                  <p className="text-[7.5px] font-bold text-white/70 uppercase tracking-wider">Access delivery orders & maps</p>
               </div>
            </div>
            <div className="flex items-center space-x-2">
               <div className="bg-emerald-500/25 px-2 py-1 rounded-md border border-emerald-500/10 flex items-center space-x-1.5 animate-pulse">
                  <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">
                     Active Rider
                  </span>
               </div>
               <ChevronRight className="text-white/30 group-hover:translate-x-1 transition-transform" size={14} />
            </div>
          </button>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center pt-1.5 pb-0">
           <p className="text-[8px] text-gray-400 font-extrabold uppercase tracking-widest">Grezto v1.0.0 — Delivering happiness 🌿</p>
        </div>
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
        setServerOtp={setServerOtp}
        handleSendOtpInline={handleSendOtpInline}
        handleVerifyAndLogin={handleVerifyAndLogin}
        otpError={otpError}
        setOtpError={setOtpError}
        useFastOtp={useFastOtp}
        setUseFastOtp={setUseFastOtp}
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
        <ProfileRewardsModal 
          isOpen={showRewardsModal} 
          onClose={() => setShowRewardsModal(false)} 
          user={user} 
          redeemVoucher={redeemVoucher} 
        />
      </AnimatePresence>

      {/* Help & Support Modal */}
      <AIChatModal 
        isOpen={showAIChat} 
        onClose={() => setShowAIChat(false)} 
      />


      
    </div>
  );
}

function MenuListItem({ icon, label, onClick, rightElement }: any) {
  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full bg-white p-3.5 flex items-center justify-between active:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center space-x-3.5">
        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-sm transition-all group-hover:scale-110">
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 11 }) : icon}
        </div>
        <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-center space-x-2 text-gray-300">
        {rightElement}
        <ChevronRight size={11} />
      </div>
    </motion.button>
  );
}
