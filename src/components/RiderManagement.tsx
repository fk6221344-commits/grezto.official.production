import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Bike, DollarSign, Wallet, Check, AlertCircle, X, Phone, Shield, Circle, Edit2, Trash2, Calendar, MoreVertical, Eye, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { auth } from '../services/firebase';
import { Dialog } from '@capacitor/dialog';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithCustomToken } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApiUrl } from '../utils/api';
import toast from 'react-hot-toast';
import RiderFormModal from './rider/RiderFormModal';
import RiderCollectModal from './rider/RiderCollectModal';
import RiderSettlementModals from './rider/RiderSettlementModals';
import RiderHistoryModal from './rider/RiderHistoryModal';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  codBalance?: number;
  codBalanceInit?: number;
  totalCollectedCash?: number;
  lastSettledDate?: string;
  rating?: string;
  unregistered?: boolean;
  dailySettlements?: Record<string, 'PAID' | 'UNPAID'>;
  totalOrdersDelivered?: number;
  liveEarnings?: number;
  totalInvoicedAmount?: number;
  totalGeneratedCod?: number;
}

export default function RiderManagement({ onClose }: { onClose: () => void }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals / Form overlays
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [showCollectModal, setShowCollectModal] = useState<Rider | null>(null);
  const [showSettleModal, setShowSettleModal] = useState<Rider | null>(null);

  // Context Menu and Interactive Daily Ledger States
  const [openMenuRiderId, setOpenMenuRiderId] = useState<string | null>(null);
  const [activeLedgerRider, setActiveLedgerRider] = useState<Rider | null>(null);
  const [selectedLedgerDate, setSelectedLedgerDate] = useState<{ dayName: string; dateLabel: string; label: string; dateKey: string } | null>(null);

  // Premium Custom Flows State
  const [selectedDayPerRider, setSelectedDayPerRider] = useState<Record<string, { dayName: string; dateLabel: string; label: string; dateKey: string }>>({});
  const [fullDaySelectActive, setFullDaySelectActive] = useState(false);
  const [collectSubMode, setCollectSubMode] = useState<'PAID' | 'UNPAID' | null>(null);

  // Custom 2-step confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    step: 1 | 2;
    title: string;
    messageStep1: string;
    messageStep2: string;
    onConfirmed: () => Promise<void> | void;
  } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Electric Scooter');
  const [status, setStatus] = useState('Online');
  const [codBalanceInit, setCodBalanceInit] = useState('0');

  // OTP Verification States
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [riderOtpError, setRiderOtpError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Collect Cash State
  const [collectAmount, setCollectAmount] = useState('');
  
  // Settle Earnings State
  const [settlePayAmount, setSettlePayAmount] = useState('');
  
  // Rider Orders Detail View (Eye Icon)
  const [selectedRiderForOrders, setSelectedRiderForOrders] = useState<Rider | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchRiders = useCallback(async () => {
    const { data } = await supabase.from('team').select('*').eq('role', 'Rider');
    if (data) {
       setRiders(data as Rider[]);
    }
    setLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('createdAt', { ascending: false }).limit(3000);
    if (data) setGlobalOrders(data);
  }, []);

  // 1. Sync Riders Fleet Real-Time
  useEffect(() => {
    let sub: any;
    fetchRiders();

    // Native App Background/Foreground State Reload
    let appStateListener: any;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log("[Native RiderManagement] App resumed to foreground, ensuring real-time Rider sync...");
          fetchRiders();
        }
      }).then(listener => { appStateListener = listener; });
    }

    sub = supabase.channel('console_riders_fleet')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: 'role=eq.Rider' }, () => {
          fetchRiders();
       }).subscribe();

    return () => { 
      if (sub) sub.unsubscribe(); 
      if (appStateListener) appStateListener.remove();
    };
  }, [fetchRiders]);

  // 2. Global live snapshot of Orders for offline metrics recalculation 
  const [globalOrders, setGlobalOrders] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    fetchOrders();

    sub = supabase.channel('console_global_orders')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
       }).subscribe();
    return () => { if (sub) sub.unsubscribe(); };
  }, [fetchOrders]);

  // 3. Operations
  // OTP Verification Operations
  const handleSendOtp = async () => {
    const formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit mobile number!");
    }

    setIsSendingOtp(true);
    setOtpInput('');
    setIsOtpVerified(false);

    try {
      if (Capacitor.isNativePlatform()) {
        console.log("[Firebase Auth] Native Capacitor Phone OTP initialization...");
        const nativeWaitPromise = new Promise(async (resolve, reject) => {
          let codeSentListener: any = null;
          let verificationFailedListener: any = null;

          const cleanup = async () => {
            try {
              if (codeSentListener) await codeSentListener.remove();
              if (verificationFailedListener) await verificationFailedListener.remove();
            } catch (cleanErr) {
              console.warn("[Rider Native Auth] Listener cleanup error:", cleanErr);
            }
          };

          try {
            codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', async (event: any) => {
              console.log("[Rider Native Auth] phoneCodeSent trigger:", event);
              await cleanup();
              resolve(event.verificationId);
            });

            verificationFailedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', async (event: any) => {
              console.error("[Rider Native Auth] phoneVerificationFailed trigger:", event);
              await cleanup();
              reject(new Error(event.message || "Failed to send OTP on Native Android device."));
            });

            console.log("[Rider Native Auth] Calling signInWithPhoneNumber...");
            await FirebaseAuthentication.signInWithPhoneNumber({
              phoneNumber: `+91${formattedPhone}`,
            });
          } catch (err) {
            await cleanup();
            reject(err);
          }
        });

        const verificationId = await nativeWaitPromise as any;
        setConfirmationResult({ isNative: true, verificationId });
        setIsOtpSent(true);
        toast.success(`Verification OTP has been sent to +91 ${formattedPhone}! 📲`);
      } else {
        console.log("[Firebase Auth] Web Phone OTP initialization...");
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
            callback: (response: any) => {
              console.log("[Firebase Recaptcha] Callback triggered.");
            }
          });
          await verifier.render();
          (window as any).recaptchaVerifier = verifier;
        }

        const confirmation = await signInWithPhoneNumber(auth, `+91${formattedPhone}`, verifier);
        setConfirmationResult(confirmation);
        setRiderOtpError(null);
        setIsOtpSent(true);
        toast.success(`Verification OTP has been sent to +91 ${formattedPhone}! 📲`);
      }
    } catch (err: any) {
      console.warn("Real Firebase OTP dispatch failed. Fallback active:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);
      
      let detailedMsg = "";
      if (errCode === "auth/unauthorized-domain" || errMsg.includes("unauthorized") || errMsg.includes("domain")) {
        detailedMsg = `Your current preview domain "${window.location.hostname}" is not added in the Firebase Console!
        
        This means Firebase is preventing real text message sending requests.
        
        To send SMS without issues:
        1. Open Firebase Console -> Authentication -> Settings tab.
        2. In "Authorized Domains" settings, click 'Add Domain'.
        3. Enter domain address: ${window.location.hostname} and save!
        4. Real SMS will dynamically start working!`;
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        detailedMsg = `Phone Sign-in toggle is disabled in Firebase Project settings.
        
        Solution step:
        1. Open Firebase Console -> Authentication -> Sign-in Method.
        2. Enable the Phone method and save settings!`;
      } else if (errCode === "auth/api-key-expired" || errMsg.includes("api-key-expired")) {
        detailedMsg = `Aapka Firebase Web API Key expire ho chuka hai.
        
        THEEK KAISE KAREIN:
        1. Firebase Console -> Project Settings -> General me jayein.
        2. Web API Key ko check karein. Agar expired hai, toh 'Google Cloud Console -> APIs & Services -> Credentials' me jaake naya key generate karein.`;
      } else {
        detailedMsg = `Firebase Auth Connection Error!\n\nReason: ${errMsg}\n\nPlease verify your real settings.`;
      }

      setRiderOtpError(detailedMsg);

    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput.length !== 6) {
      return toast.error("Please enter a 6-digit OTP code!");
    }

    setIsVerifyingOtp(true);

    try {
      let verifyVerificationId = confirmationResult?.verificationId || "";
      let isVerified = false;
      let clientUid = "";
      let idToken = "";

      if (confirmationResult) {
        try {
          if (Capacitor.isNativePlatform()) {
            console.log("[Client OTP Verification] Confirming rider native OTP via Capacitor...");
            const result = await FirebaseAuthentication.confirmVerificationCode({
              verificationId: confirmationResult.verificationId,
              verificationCode: otpInput,
            });
            clientUid = result.user?.uid || "";
            try {
              const tokenRes = await FirebaseAuthentication.getIdToken();
              idToken = tokenRes.token;
            } catch (tokenErr) {
              console.warn("Failed to retrieve native rider client idToken:", tokenErr);
            }
            isVerified = true;
            console.log("[Native Rider OTP Verification SUCCESS] Verified client-side for rider UID:", clientUid);
          } else {
            console.log("[Client OTP Verification] Confirming rider OTP directly using Client SDK...");
            const userCredential = await confirmationResult.confirm(otpInput);
            clientUid = userCredential.user.uid;
            try {
              idToken = await userCredential.user.getIdToken();
            } catch (tokenErr) {
              console.warn("Failed to retrieve rider client idToken:", tokenErr);
            }
            isVerified = true;
            console.log("[Client OTP Verification SUCCESS] Verified client-side for rider UID:", clientUid);
          }
        } catch (clientVerifyErr: any) {
          console.error("Client confirm failed for rider identification:", clientVerifyErr);
          toast.error("Incorrect OTP! Please enter the correct 6-digit verification code. 🛑");
          setIsVerifyingOtp(false);
          return;
        }
      }

      const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""), // Rider's phone
          otp: otpInput,
          verificationId: isVerified ? "client-verified" : verifyVerificationId,
          clientUid: clientUid,
          idToken: idToken
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        if (isVerified) {
          console.warn("Client was verified but server sync profile failed:", resData.error);
        } else {
          throw new Error(resData.error || "Incorrect OTP");
        }
      }

      console.log("[SERVER RIDER OTP VERIFICATION SUCCESS]", resData);

      // Support native client session association if desired
      if (resData.customToken && !isVerified) {
        try {
          if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signInWithCustomToken({ token: resData.customToken });
          } else {
            await signInWithCustomToken(auth, resData.customToken);
          }
        } catch (signinErr) {
          console.warn("Client auth sync bypassed:", signinErr);
        }
      }

      setIsOtpVerified(true);
      toast.success("Rider's mobile number verified successfully! ✓ 🟢");
    } catch (err: any) {
      console.error("OTP verification error:", err);
      toast.error(err.message || "Incorrect OTP entered! Please check the correct code. ❌");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return toast.error("Please fill Name and Phone number.");
    }
    const formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit phone number.");
    }

    // New rider must verify phone number first
    if (!editingRider && !isOtpVerified) {
      return toast.error("Please verify the Rider's phone number before registering!");
    }

    const riderId = editingRider ? editingRider.id : `rider_${Date.now()}`;
    const riderData: any = {
      id: riderId,
      name: name.trim(),
      phone: formattedPhone,
      vehicle,
      status,
      role: 'Rider',
      updatedAt: new Date().toISOString()
    };

    if (editingRider) {
      riderData.codBalanceInit = editingRider.codBalanceInit || 0;
      riderData.totalCollectedCash = editingRider.totalCollectedCash || 0;
      riderData.codBalance = editingRider.codBalance || 0;
    } else {
      riderData.codBalanceInit = Number(codBalanceInit || 0);
      riderData.totalCollectedCash = 0;
      riderData.codBalance = Number(codBalanceInit || 0);
    }

    try {
      const { error: upsertError } = await supabase.from('team').upsert(riderData);
      
      if (upsertError) {
        console.error("[Supabase Error] Upsert failed for team table:", upsertError);
        toast.error(`Error saving Rider: ${upsertError.message || 'Failed to save rider. Sync issue.'}`);
        return;
      }
      
      if (!editingRider) {
        // Send a 100% congratulatory message through Firebase Firestore trigger trigger_sms rules
        try {
          const smsPayload = {
            to: `+91${formattedPhone}`,
            body: `Congratulations ${name.trim()}! You are successfully registered as a Grezto Delivery Partner. Welcome to our family! 🛵✨`,
            createdAt: new Date().toISOString(),
            status: 'pending',
            riderId
          };
          await supabase.from('sms_notifications').insert(smsPayload);
          console.log("[Supabase] Congratulatory SMS written successfully:", smsPayload);
          toast.success("Congratulatory welcome SMS has been sent! 📱🌟");
        } catch (smsErr) {
          console.warn("SMS collection trigger write failed, simulated success:", smsErr);
        }
      }

      toast.success(editingRider ? "Rider updated successfully! 🛵" : "New Delivery Partner Registered! 🚀");
      fetchRiders();
      setShowAddForm(false);
      resetForm();
    } catch (err: any) {
      toast.error("Cloud synchronisation failed.");
    }
  };

  const resetForm = () => {
    setEditingRider(null);
    setName('');
    setPhone('');
    setVehicle('Electric Scooter');
    setStatus('Online');
    setCodBalanceInit('0');
    setIsSendingOtp(false);
    setIsOtpSent(false);
    setOtpInput('');
    setIsVerifyingOtp(false);
    setIsOtpVerified(false);
    setConfirmationResult(null);
  };

  const handleCleanRiderConsole = async (rider: Rider) => {
    const { value: isConfirmed } = await Dialog.confirm({ title: 'Confirmation', message: `Are you sure you want to clear all active/stuck orders for Delivery Partner / Rider "${rider.name}"? This will clean up their active Console and reset the cash balance to zero initially in our system.` });
    if (!isConfirmed) return;

    setOpenMenuRiderId(null);
    const loadToast = toast.loading(`Cleaning ${rider.name}'s active assignments...`);
    try {
      // 1. Reset COD balance & cash collection back to initial in the 'team' collection doc
      const initBal = Number(rider.codBalanceInit || 0);
      await supabase.from('team').update({
        codBalance: initBal,
        totalCollectedCash: 0,
        updatedAt: new Date().toISOString()
      }).eq('id', rider.id);

      setRiders(prev => prev.map(r => 
        r.id === rider.id ? { ...r, codBalance: initBal, totalCollectedCash: 0 } : r
      ));
      fetchRiders();

      // 2. Query all active orders assigned to this rider's phone that are not Delivered or Cancelled
      const { data: getOrders } = await supabase.from('orders').select('*').eq('partnerPhone', rider.phone);
      const ordersToCancel = (getOrders || []).filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');

      let cleanedCount = 0;
      for (const o of ordersToCancel) {
        await supabase.from('orders').update({
          status: 'Cancelled',
          updatedAt: new Date().toISOString()
        }).eq('id', o.id);
        cleanedCount++;
      }

      toast.success(`${rider.name}'s Console successfully cleaned! ${cleanedCount} stuck assignments cleared. 🛵⚡🎉`, { id: loadToast });
      fetchOrders();
    } catch (err: any) {
      console.error(err);
      toast.error(`Clearance failed: ${err.message || 'Error occurred'}`, { id: loadToast });
    }
  };

  // 1/2-Step Confirmations & Database Operations
  const handleUnregisterRider = async (rider: Rider) => {
    setOpenMenuRiderId(null);
    setConfirmModal({
      step: 1,
      title: "Suspend Partner",
      messageStep1: `Are you sure you want to suspend / unregister ${rider.name} from the active fleet?`,
      messageStep2: `Confirm unregistration of ${rider.name}? Their status will instantly transition to Suspended.`,
      onConfirmed: async () => {
        try {
          await supabase.from('team').update({
            status: 'Offline',
            unregistered: true,
            updatedAt: new Date().toISOString()
          }).eq('id', rider.id);
          
          setRiders(prev => prev.map(r => 
            r.id === rider.id ? { ...r, status: 'Offline', unregistered: true } : r
          ));
          fetchRiders();

          toast.success(`${rider.name} suspended from Active Fleets. 🚫`);
        } catch (err) {
          toast.error("Failed to suspend rider.");
        }
      }
    });
  };

  const handleDeleteRiderTwoStep = async (rider: Rider) => {
    setOpenMenuRiderId(null);
    setConfirmModal({
      step: 1,
      title: "Terminate Profile",
      messageStep1: `Are you absolutely sure you want to permanently delete ${rider.name}'s profile? All registries will vanish.`,
      messageStep2: `Last warning! Do you confirm complete termination of ${rider.name} from cloud databases?`,
      onConfirmed: async () => {
        try {
          await supabase.from('team').delete().eq('id', rider.id);
          setRiders(prev => prev.filter(r => r.id !== rider.id));
          fetchRiders();
          toast.success(`${rider.name} deleted permanently.`);
        } catch (err) {
          toast.error("Failed to delete rider registry.");
        }
      }
    });
  };

  // React state auto-refresh whenever DB data updates
  useEffect(() => {
    if (activeLedgerRider) {
      const freshDoc = riders.find(r => r.id === activeLedgerRider.id);
      if (freshDoc) {
        setActiveLedgerRider(freshDoc);
      }
    }
  }, [riders]);

  // Helper to extract YYYY-MM-DD from order timestamp fields
  const getOrderDateKey = (o: any) => {
    const timestampField = o.createdAt || o.updatedAt;
    if (!timestampField) return '';
    let d: Date;
    if (timestampField.seconds) {
      d = new Date(timestampField.seconds * 1000);
    } else if (timestampField.toDate && typeof timestampField.toDate === 'function') {
      try { d = timestampField.toDate(); } catch (e) { d = new Date(timestampField); }
    } else {
      d = new Date(timestampField);
    }
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };



  // Generates last 7 days of dynamic ledger entries with beautiful representations
  const getLast7Days = () => {
    const list = [];
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const dayName = daysOfWeek[d.getDay()];
      const dateNum = d.getDate();
      const monthName = months[d.getMonth()];
      const yearNum = d.getFullYear();
      
      const label = `${dayName}, ${dateNum} ${monthName} ${yyyyToShort(yearNum)}`;
      const dateLabel = `${dateNum} ${monthName} ${yearNum}`;
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      
      list.push({
        dayName,
        dateLabel,
        label,
        dateKey
      });
    }
    return list;
  };

  const yyyyToShort = (y: number) => y; // helper inline

  const handleToggleDayStatus = async (status: 'PAID' | 'UNPAID') => {
    if (!activeLedgerRider || !selectedLedgerDate) return;
    
    const dayLabel = selectedLedgerDate.dateLabel;
    const riderName = activeLedgerRider.name;

    setConfirmModal({
      step: 1,
      title: "Set Day Status",
      messageStep1: `Mark ${dayLabel} as ${status} for ${riderName}?`,
      messageStep2: `Are you 100% sure that cash for ${dayLabel} is completely ${status === 'PAID' ? 'received & accounted at counter' : 'marked pending'}?`,
      onConfirmed: async () => {
        try {
          const currentSettlements = activeLedgerRider.dailySettlements || {};
          const updatedSettlements = {
            ...currentSettlements,
            [selectedLedgerDate.dateKey]: status
          };

          await supabase.from('team').update({
            dailySettlements: updatedSettlements,
            updatedAt: new Date().toISOString()
          }).eq('id', activeLedgerRider.id);

          // Instantly refresh local active element
          setActiveLedgerRider(prev => prev ? {
            ...prev,
            dailySettlements: updatedSettlements
          } : null);

          setRiders(prev => prev.map(r => 
            r.id === activeLedgerRider.id ? { ...r, dailySettlements: updatedSettlements } : r
          ));
          fetchRiders();

          toast.success(`Day ${dayLabel} status marked ${status}! 🏆`);
        } catch (err) {
          toast.error("Failed to write to settlement records.");
        }
      }
    });
  };

  const handleDeleteRider = async (id: string) => {
    setConfirmModal({
      step: 1,
      title: "Terminate Agreement",
      messageStep1: "Are you absolutely sure you want to terminate this Rider's association with your fleet? This deactivates their active profile.",
      messageStep2: "Final warning: This action is permanent and deletes their registry from the database. Proceed?",
      onConfirmed: async () => {
        try {
          await supabase.from('team').delete().eq('id', id);
          toast.success("Rider removed successfully.");
          setShowAddForm(false);
          resetForm();
        } catch (err) {
          toast.error("Failed to delete rider profile.");
        }
      }
    });
  };

  const getSelectedDayForRider = (riderId: string) => {
    return selectedDayPerRider[riderId] || getLast7Days()[0];
  };

  const handleUnpaidCollectVerification = async () => {
    if (!showCollectModal) return;
    const day = getSelectedDayForRider(showCollectModal.id);

    setConfirmModal({
      step: 1,
      title: "Set Unpaid Status",
      messageStep1: `Are you sure you want to mark ${day.dayName} (${day.dateLabel}) as UNPAID for ${showCollectModal.name}?`,
      messageStep2: `Re-confirm: Are you absolutely sure ${showCollectModal.name} has NOT deposited the cash for ${day.dayName}?`,
      onConfirmed: async () => {
        try {
          const currentSettlements = showCollectModal.dailySettlements || {};
          const updatedSettlements = {
            ...currentSettlements,
            [day.dateKey]: 'UNPAID' as const
          };

          // Optimistic update FIRST
          setRiders(prev => prev.map(r => 
            r.id === showCollectModal.id ? { 
              ...r, 
              dailySettlements: updatedSettlements,
              updatedAt: new Date().toISOString()
            } : r
          ));
          
          toast.success(`${day.dayName} marked UNPAID for ${showCollectModal.name}. 🔴`);
          const modalId = showCollectModal.id;
          setShowCollectModal(null);
          setCollectSubMode(null);

          await supabase.from('team').update({
            dailySettlements: updatedSettlements,
            updatedAt: new Date().toISOString()
          }).eq('id', modalId);

          fetchRiders();

        } catch (err) {
          toast.error("Failed to mark status.");
        }
      }
    });
  };

  const executePaidCollection = async (amountToCollect: number, currentBal: number) => {
    if (!showCollectModal) return;
    const day = getSelectedDayForRider(showCollectModal.id);
    try {
      const prevCollected = Number(showCollectModal.totalCollectedCash || 0);
      const newCollectedTotal = prevCollected + amountToCollect;

      const finalBal = Math.max(0, currentBal - amountToCollect);
      const currentSettlements = showCollectModal.dailySettlements || {};
      const updatedSettlements = {
        ...currentSettlements,
        [day.dateKey]: 'PAID' as const
      };

      // Optimistic update FIRST, before DB call
      setRiders(prev => prev.map(r => 
        r.id === showCollectModal.id ? { 
          ...r, 
          totalCollectedCash: newCollectedTotal,
          codBalance: finalBal,
          dailySettlements: updatedSettlements,
          updatedAt: new Date().toISOString()
        } : r
      ));
      
      toast.success(`Collected ₹${amountToCollect}! ${day.dayName} marked PAID successfully! 🟢`);
      const modalId = showCollectModal.id;
      setShowCollectModal(null);
      setCollectSubMode(null);
      setCollectAmount('');

      await supabase.from('team').update({
        totalCollectedCash: newCollectedTotal,
        codBalance: finalBal,
        dailySettlements: updatedSettlements,
        updatedAt: new Date().toISOString()
      }).eq('id', modalId);

      fetchRiders();

    } catch (err) {
      toast.error("Collection failed. Try again.");
    }
  };

  const handlePaidCollectAndSetStatus = async () => {
    if (!showCollectModal) return;
    const amountToCollect = Number(collectAmount);
    if (isNaN(amountToCollect) || amountToCollect <= 0) {
      return toast.error("Please enter a valid cash amount to collect.");
    }

    const metrics = getRiderMetrics(showCollectModal);
    const currentBal = metrics.liveCodBalance;
    if (amountToCollect > currentBal) {
      setConfirmModal({
        step: 1,
        title: "Over-collection Warning",
        messageStep1: `Rider only holds ₹${currentBal} unsettled cash. Collect ₹${amountToCollect} anyway?`,
        messageStep2: `Are you absolutely sure you want to collect more cash (₹${amountToCollect}) than their unsettled wallet balance?`,
        onConfirmed: async () => {
          await executePaidCollection(amountToCollect, currentBal);
        }
      });
      return;
    }

    await executePaidCollection(amountToCollect, currentBal);
  };

  // Cash collection from Rider
  const handleCollectMoney = async () => {
    if (!showCollectModal) return;
    const amountToCollect = Number(collectAmount);
    if (isNaN(amountToCollect) || amountToCollect <= 0) {
      return toast.error("Please enter a valid cash amount to collect.");
    }
    const metrics = getRiderMetrics(showCollectModal);
    const currentBal = metrics.liveCodBalance;
    if (amountToCollect > currentBal) {
      setConfirmModal({
        step: 1,
        title: "Over-collection Warning",
        messageStep1: `Rider only has ₹${currentBal} unsettled cash. Collect ₹${amountToCollect} anyway?`,
        messageStep2: `Are you absolutely sure you want to collect more cash (₹${amountToCollect}) than their unsettled wallet balance?`,
        onConfirmed: async () => {
          try {
            const newBalance = Math.max(0, currentBal - amountToCollect);
            const prevCollected = Number(showCollectModal.totalCollectedCash || 0);
            
            // Optimistic update FIRST
            setRiders(prev => prev.map(r => 
              r.id === showCollectModal.id ? { 
                ...r, 
                totalCollectedCash: prevCollected + amountToCollect,
                codBalance: newBalance,
              } : r
            ));
            
            toast.success(`Success! Collected ₹${amountToCollect} from ${showCollectModal.name}. 💰`);
            const modalId = showCollectModal.id;
            setShowCollectModal(null);
            setCollectAmount('');

            await supabase.from('team').update({
              totalCollectedCash: prevCollected + amountToCollect,
              codBalance: newBalance,
            }).eq('id', modalId);

            fetchRiders();

          } catch (err) {
            toast.error("Collection failed. Try again.");
          }
        }
      });
      return;
    }

    try {
      const newBalance = Math.max(0, currentBal - amountToCollect);
      const prevCollected = Number(showCollectModal.totalCollectedCash || 0);
      
      // Optimistic update FIRST
      setRiders(prev => prev.map(r => 
        r.id === showCollectModal.id ? { 
          ...r, 
          totalCollectedCash: prevCollected + amountToCollect,
          codBalance: newBalance,
        } : r
      ));
      
      toast.success(`Success! Collected ₹${amountToCollect} from ${showCollectModal.name}. 💰`);
      const modalId = showCollectModal.id;
      setShowCollectModal(null);
      setCollectAmount('');

      await supabase.from('team').update({
        totalCollectedCash: prevCollected + amountToCollect,
        codBalance: newBalance,
      }).eq('id', modalId);

      fetchRiders();

    } catch (err) {
      toast.error("Collection failed. Try again.");
    }
  };

  // Rider payout/settlement trigger
  const handleSettleEarnings = async () => {
    if (!showSettleModal) return;
    const amountToSettle = Number(settlePayAmount);
    if (isNaN(amountToSettle) || amountToSettle <= 0) {
      return toast.error("Please enter a valid amount.");
    }

    try {
      const currentLiveEarnings = Number(showSettleModal.liveEarnings || 0);
      
      // Optimistic update FIRST
      setRiders(prev => prev.map(r => 
        r.id === showSettleModal.id ? { 
          ...r, 
          liveEarnings: currentLiveEarnings - amountToSettle,
          lastSettledDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          updatedAt: new Date().toISOString()
        } : r
      ));
      
      toast.success(`Settlement of ₹${amountToSettle} recorded for ${showSettleModal.name}! 🤝`);
      const modalId = showSettleModal.id;
      setShowSettleModal(null);
      setSettlePayAmount('');

      await supabase.from('team').update({
        liveEarnings: currentLiveEarnings - amountToSettle,
        lastSettledDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        updatedAt: new Date().toISOString()
      }).eq('id', modalId);

      fetchRiders();

    } catch (err) {
      toast.error("Failed to record settlement.");
    }
  };

  // Calculations for specific Rider
  const getRiderMetrics = (rider: Rider) => {
    let deliveredCount = 0;
    let liveEarnings = 0;
    let totalInvoicedAmount = 0;
    let totalGeneratedCod = 0;
    let totalDeliveryCharges = 0;

    globalOrders.forEach(order => {
      if (order.partnerPhone === rider.phone && (order.status === 'Delivered' || order.status === 'delivered')) {
        deliveredCount++;
        const bill = Number(order.finalAmount || order.amount || order.billTotal || order.totalAmount || 0);
        totalInvoicedAmount += bill;
        const codAmt = order.paymentMethod === 'Cash on Delivery' || order.paymentMethod === 'COD' ? bill : 0;
        totalGeneratedCod += codAmt;
        liveEarnings += Number(order.riderFee || 25);
        totalDeliveryCharges += Number(order.deliveryCharge || 0);
      }
    });

    const settled = Number(rider.totalCollectedCash || 0);
    // Calculated liveCodBalance logic based on older snapshots
    const liveCodBalance = Math.max(0, totalGeneratedCod - settled);

    return {
      deliveredCount,
      liveEarnings,
      totalInvoicedAmount,
      totalGeneratedCod,
      liveCodBalance, // Calculated on the fly from globalOrders
      totalDeliveryCharges,
      remainingDeliveryCharges: totalDeliveryCharges - liveEarnings
    };
  };

  // Fleet Overall Summary metrics
  const totalRiders = riders.length;
  const activeRiders = riders.filter(r => r.status === 'Online').length;
  const totalUncollectedMoney = riders.reduce((sum, r) => sum + getRiderMetrics(r).liveCodBalance, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* 1. Single Cohesive Dark Red Section for Header & Cute Metrics boxes */}
      <div className="bg-gradient-to-br from-[#3b0712] via-[#4c0519] to-[#700d23] text-white pt-10 pb-6 px-2.5 shrink-0 shadow-xl rounded-b-[1.8rem] relative overflow-hidden border-b border-rose-950/30">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-rose-950/40 rounded-full blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/5 active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="text-left">
              <h1 className="text-[13px] font-black uppercase tracking-wider text-rose-50 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-white" /> Rider Management
              </h1>
              <p className="text-[7.5px] font-bold uppercase tracking-widest text-rose-300">Control Panel & Settlements</p>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider py-2 px-3.5 rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-1.5 active:scale-95 transition-all outline-none border-0 cursor-pointer"
          >
            <Plus size={11} strokeWidth={3} /> Add Rider
          </button>
        </div>

        {/* Cohesive, Cute Metrics Summary boxes directly underneath with premium, custom non-basic color palettes */}
        <div className="flex items-center justify-between gap-2.5 mt-5">
          {/* Total Riders Box - Velvet Plum */}
          <div className="flex-1 text-center bg-rose-950/50 p-2.5 rounded-[1.1rem] border border-rose-500/20 shadow-inner">
            <p className="text-[6.5px] font-black uppercase tracking-widest text-rose-350">Total Rider</p>
            <h3 className="text-[13px] font-black mt-0.5 tracking-tight font-mono text-rose-100">
              {totalRiders < 10 ? `0${totalRiders}` : totalRiders}
            </h3>
          </div>

          {/* Active Riders Box - Sage Teal */}
          <div className="flex-1 text-center bg-[#064e3b]/45 p-2.5 rounded-[1.1rem] border border-emerald-500/20 shadow-inner">
            <p className="text-[6.5px] font-black uppercase tracking-widest text-emerald-300">Active Rider</p>
            <div className="flex items-center justify-center gap-1.5 mt-0.5 font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              <h3 className="text-[13px] font-black tracking-tight text-white">{activeRiders}</h3>
            </div>
          </div>

          {/* Total Money Box - Antique Amber */}
          <div className="flex-1 text-center bg-amber-950/45 p-2.5 rounded-[1.1rem] border border-amber-500/20 shadow-inner">
            <p className="text-[6.5px] font-black uppercase tracking-widest text-amber-200">Total Money</p>
            <h3 className="text-[13px] font-black mt-0.5 tracking-tight font-mono text-amber-100">
              ₹{totalUncollectedMoney}
            </h3>
          </div>
        </div>
      </div>

      {/* 2. Riders Profiles List */}
      <div className="px-3 py-4 flex-1 space-y-4 overflow-y-auto [webkit-overflow-scrolling:touch] touch-pan-y pb-24">
        <div className="flex items-center justify-between px-1.5">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fleets Status</h2>
          <span className="text-[8px] font-extrabold bg-slate-250/60 px-2 py-0.5 rounded-full text-slate-500 uppercase tracking-wider">
            {riders.length} Registered
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-slate-400">
            <div className="w-7 h-7 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[9.5px] font-bold uppercase tracking-widest">Syncing Fleet Status...</p>
          </div>
        ) : riders.length === 0 ? (
          <div className="py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 text-center px-6">
            <Bike className="w-10 h-10 mx-auto text-rose-500 opacity-20 mb-3" />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">No Delivery Riders Registered</p>
            <p className="text-[9px] text-slate-400/80 mt-1 max-w-xs mx-auto">Use the "+ Add Rider" button in the upper right header to create your logistical delivery fleet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {riders.map((rider) => {
              const metrics = getRiderMetrics(rider);
              const isSuspended = !!rider.unregistered;
              const isSelectedMenu = openMenuRiderId === rider.id;
              
              return (
                <motion.div 
                  layout
                  key={rider.id}
                  style={{ zIndex: isSelectedMenu ? 40 : 1 }}
                  className={`p-4 py-4.5 rounded-[2.2rem] border relative overflow-visible transition-all duration-300 ${
                    isSuspended 
                      ? 'bg-slate-50/70 border-slate-200/60 opacity-80 shadow-none' 
                      : 'bg-white border-slate-150 shadow-xs hover:shadow-md'
                  }`}
                >
                  {/* Decorative faint bike icon in card background */}
                  <div className="absolute right-3 top-3 opacity-[0.02] text-rose-950 pointer-events-none scale-[2.2]">
                    <Bike size={48} />
                  </div>

                  {/* Profile section with name & three-dot menu trigger */}
                  <div className="flex items-start justify-between relative">
                    <div className="flex items-center gap-2.5">
                      {/* Left icon box: visual bike / scooter representation - super cute & small */}
                      <div className="w-9 h-9 bg-rose-50 border border-rose-100/70 rounded-full flex items-center justify-center shadow-xs flex-shrink-0">
                        {rider.vehicle === 'Electric Scooter' ? (
                          <span className="text-sm">🛵</span>
                        ) : (
                          <span className="text-sm">🏍️</span>
                        )}
                      </div>

                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[11.5px] font-black uppercase text-slate-800 tracking-tight leading-none">
                            {rider.name}
                          </h3>
                          {isSuspended ? (
                            <span className="text-[6.5px] font-extrabold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-100">
                              Suspended
                            </span>
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${rider.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          )}
                        </div>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase mt-1 tracking-wider leading-none">
                          +91 {rider.phone} • {rider.vehicle || 'Rider'}
                        </p>
                      </div>
                    </div>

                    {/* Three-dot vertical context menu with View Orders Eye button */}
                    <div className="flex items-center gap-1.5 relative">
                      <button 
                        type="button"
                        onClick={() => setSelectedRiderForOrders(rider)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl transition-all border border-slate-200/60 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-[0.95] duration-200"
                        title="View Delivered Orders"
                      >
                        <Eye size={13.5} className="stroke-[2.5]" />
                      </button>

                      <button 
                        type="button"
                        onClick={() => setOpenMenuRiderId(openMenuRiderId === rider.id ? null : rider.id)}
                        className="p-1.5 px-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition-all border-0 cursor-pointer"
                        title="More actions"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {openMenuRiderId === rider.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setOpenMenuRiderId(null)} />
                          <div className="absolute right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-150 p-1.5 min-w-[155px] z-40 space-y-0.5 text-left text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150">
                            
                            {/* Option 2: Call partner */}
                            <a 
                              href={`tel:${rider.phone}`}
                              onClick={() => setOpenMenuRiderId(null)}
                              className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors no-underline text-slate-700 font-bold"
                            >
                              <Phone size={13} className="text-emerald-500 shrink-0" />
                              <span>Call Partner</span>
                            </a>

                            {/* Option 2.5: Clean Console & Reset Cash */}
                            <button
                              type="button"
                              onClick={() => handleCleanRiderConsole(rider)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-sky-50 text-sky-750 hover:text-sky-850 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                            >
                              <RefreshCw size={13} className="text-sky-500 shrink-0" />
                              <span>Clean Console</span>
                            </button>

                            {/* Separation line */}
                            <div className="border-t border-slate-100 my-1"></div>

                            {/* Option 3: Suspend/Unregister */}
                            <button
                              type="button"
                              onClick={() => handleUnregisterRider(rider)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50 text-amber-750 hover:text-amber-800 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                            >
                              <AlertCircle size={13} className="text-amber-500 shrink-0" />
                              <span>Suspend Rider</span>
                            </button>

                            {/* Option 4: Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRiderTwoStep(rider)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-rose-50 text-rose-650 hover:text-rose-700 rounded-xl text-left font-bold border-0 bg-transparent cursor-pointer"
                            >
                              <Trash2 size={13} className="text-rose-600 shrink-0" />
                              <span>Delete Profile</span>
                            </button>

                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cute rows detail section replacing the big boxes */}
                  <div className="mt-3.5 bg-slate-50/70 px-4 py-3 rounded-2xl border border-slate-100 text-left space-y-2.5">
                    {/* Row 1: COD */}
                    <div className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
                        <span>Total Money (Holding Cash)</span>
                        <span>💰</span>
                      </div>
                      <div className="text-slate-850 font-black font-mono text-[11px] flex items-center gap-1.5">
                        <span className="text-emerald-700 animate-pulse font-black">₹{metrics.liveCodBalance}</span>
                        <span className="text-[6px] text-slate-400 font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 uppercase tracking-widest scale-90">Auto</span>
                      </div>
                    </div>

                    {/* Cute dotted separation line */}
                    <div className="border-t border-dashed border-slate-200 my-0.5"></div>

                    {/* Row 1.5: Delivery Charge */}
                    <div className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
                        <span>Delivery Charge</span>
                        <span>🛵</span>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-650 font-black font-mono text-[11px]">
                          ₹{(metrics as any).remainingDeliveryCharges || 0}
                        </div>
                        <p className="text-[6.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 leading-none">
                          ₹{(metrics as any).totalDeliveryCharges || 0} Total Collected
                        </p>
                      </div>
                    </div>

                    {/* Cute dotted separation line */}
                    <div className="border-t border-dashed border-slate-200 my-0.5"></div>

                    {/* Row 2: Rider Earning */}
                    <div className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
                        <span>Rider Earning</span>
                        <span>💵</span>
                      </div>
                      <div className="text-right">
                        <div className="text-indigo-650 font-black font-mono text-[11px]">
                          ₹{metrics.liveEarnings}
                        </div>
                        <p className="text-[6.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 leading-none">
                          {metrics.deliveredCount} Delivered • {rider.lastSettledDate ? `Last: ${rider.lastSettledDate}` : 'No settler'}
                        </p>
                      </div>
                    </div>

                    {/* Cute dotted separation line */}
                    <div className="border-t border-dashed border-slate-200 my-0.5"></div>

                    {/* Row 3: Current Selected Day Action */}
                    <div className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1 text-slate-550 font-black uppercase tracking-wider">
                        <span>Selected Day</span>
                        <span>🗓️</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-rose-850 uppercase tracking-tight">
                          {getSelectedDayForRider(rider.id).dayName}
                        </span>
                        <span className={`ml-1.5 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider select-none transition-all duration-300 ${
                          (rider.dailySettlements?.[getSelectedDayForRider(rider.id).dateKey] || 'UNPAID') === 'PAID'
                            ? 'bg-emerald-500 text-white border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                            : 'bg-rose-500 text-white border border-rose-450 shadow-[0_0_10px_rgba(244,63,94,0.7)]'
                        }`}>
                          {(rider.dailySettlements?.[getSelectedDayForRider(rider.id).dateKey] || 'UNPAID') === 'PAID' ? 'PAID ✓' : 'UNPAID'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Bottom Action buttons: Settlement & Collect cash */}
                  <div className="mt-3.5 grid grid-cols-2 gap-3 pb-0.5">
                    {/* Left button: Settlement */}
                    <button 
                      type="button"
                      onClick={() => {
                        setActiveLedgerRider(rider);
                        setFullDaySelectActive(true);
                      }}
                      className="bg-slate-100 hover:bg-slate-150 text-slate-800 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200/50 cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-1 shadow-2xs"
                    >
                      🤝 Settlement
                    </button>

                    {/* Right button: Collect Cash */}
                    <button 
                      type="button"
                      onClick={() => {
                        setShowCollectModal(rider);
                        setCollectAmount(String(metrics.liveCodBalance));
                        setCollectSubMode(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-1 shadow-xs shadow-emerald-650/15"
                    >
                      💵 Collect Cash
                    </button>
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Add/Edit Rider Form Panel */}
      <RiderFormModal
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        editingRider={editingRider}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        isOtpVerified={isOtpVerified}
        setIsOtpVerified={setIsOtpVerified}
        isSendingOtp={isSendingOtp}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        otpInput={otpInput}
        setOtpInput={setOtpInput}
        vehicle={vehicle}
        setVehicle={setVehicle}
        status={status}
        setStatus={setStatus}
        codBalanceInit={codBalanceInit}
        setCodBalanceInit={setCodBalanceInit}
        handleSendOtp={handleSendOtp}
        handleVerifyOtp={handleVerifyOtp}
        isVerifyingOtp={isVerifyingOtp}
        handleSaveRider={handleSaveRider}
        handleDeleteRider={handleDeleteRider}
        riderOtpError={riderOtpError}
        setRiderOtpError={setRiderOtpError}
      />

      {/* MODAL 2: Collect cash balance modal with Interactive Paid/Unpaid Selection */}
      <RiderCollectModal
        showCollectModal={showCollectModal}
        setShowCollectModal={setShowCollectModal}
        getSelectedDayForRider={getSelectedDayForRider}
        getRiderMetrics={getRiderMetrics}
        collectSubMode={collectSubMode}
        setCollectSubMode={setCollectSubMode}
        collectAmount={collectAmount}
        setCollectAmount={setCollectAmount}
        handleUnpaidCollectVerification={handleUnpaidCollectVerification}
        handlePaidCollectAndSetStatus={handlePaidCollectAndSetStatus}
        isMounted={isMounted}
      />

      {/* MODAL 3: Settlement modal & MODAL 4: Full Screen Settlement Day Picker */}
      <RiderSettlementModals
        showSettleModal={showSettleModal}
        setShowSettleModal={setShowSettleModal}
        settlePayAmount={settlePayAmount}
        setSettlePayAmount={setSettlePayAmount}
        handleSettleEarnings={handleSettleEarnings}
        getRiderMetrics={getRiderMetrics}
        fullDaySelectActive={fullDaySelectActive}
        setFullDaySelectActive={setFullDaySelectActive}
        activeLedgerRider={activeLedgerRider}
        setActiveLedgerRider={setActiveLedgerRider}
        getLast7Days={getLast7Days}
        getSelectedDayForRider={getSelectedDayForRider}
        setSelectedDayPerRider={setSelectedDayPerRider}
        isMounted={isMounted}
      />

      {/* GORGEOUS CUSTOM 2-STEP CONFIRMATION MODAL */}
      {isMounted && createPortal(
        <AnimatePresence>
          {confirmModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-5 bg-slate-900/65 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-sm rounded-[1.8rem] shadow-2xl border border-rose-100 overflow-hidden text-left"
            >
              {/* Cute Header based on step */}
              <div className={`p-4 text-white flex items-center justify-between ${
                confirmModal.step === 1 
                  ? 'bg-gradient-to-r from-rose-800 to-rose-900' 
                  : 'bg-gradient-to-r from-red-850 to-red-950'
              }`}>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚠️</span> {confirmModal.title}
                  </h3>
                  <p className="text-[7.5px] text-rose-200 font-extrabold uppercase tracking-widest mt-0.5">
                    {confirmModal.step === 1 ? 'Step 1 of 2: Verification' : 'Step 2 of 2: Final Confirmation'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border-0 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Message Content */}
              <div className="p-5.5 space-y-4">
                <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/60 relative overflow-hidden flex gap-3 text-left">
                  <div className="text-sm shrink-0">
                    {confirmModal.step === 1 ? '✨' : '🚨'}
                  </div>
                  <p className="text-[11px] font-black text-slate-705 leading-relaxed">
                    {confirmModal.step === 1 ? confirmModal.messageStep1 : confirmModal.messageStep2}
                  </p>
                </div>

                {/* Progress dot indicators */}
                <div className="flex justify-center gap-1.5 py-1">
                  <span className={`w-2 h-2 rounded-full transition-all duration-300 ${confirmModal.step === 1 ? 'bg-rose-600 scale-120' : 'bg-slate-250'}`}></span>
                  <span className={`w-2 h-2 rounded-full transition-all duration-300 ${confirmModal.step === 2 ? 'bg-red-650 scale-120' : 'bg-slate-250'}`}></span>
                </div>

                {/* Confirm / Cancel Buttons */}
                <div className="flex gap-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider border border-slate-200/40 cursor-pointer transition active:scale-95"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirmModal.step === 1) {
                        setConfirmModal(prev => prev ? { ...prev, step: 2 } : null);
                        toast.success("Step 1 Clear! Please provide final approval.");
                      } else {
                        const action = confirmModal.onConfirmed;
                        setConfirmModal(null);
                        await action();
                      }
                    }}
                    className={`flex-1 text-white py-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider border-0 cursor-pointer transition active:scale-95 ${
                      confirmModal.step === 1
                        ? 'bg-rose-700 hover:bg-rose-850 shadow-sm shadow-rose-900/30'
                        : 'bg-red-800 hover:bg-red-900 shadow-sm shadow-red-950/40'
                    }`}
                  >
                    {confirmModal.step === 1 ? 'Confirm' : 'Yes, Confirm!'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* MODAL 5: Rider Delivered Orders History Details */}
      <RiderHistoryModal
        selectedRiderForOrders={selectedRiderForOrders}
        setSelectedRiderForOrders={setSelectedRiderForOrders}
        expandedOrders={expandedOrders}
        setExpandedOrders={setExpandedOrders}
        isMounted={isMounted}
      />

    </div>
  );
}
