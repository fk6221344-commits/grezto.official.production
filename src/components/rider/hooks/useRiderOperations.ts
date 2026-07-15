import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../services/supabase";
import { auth } from "../../../services/firebase";
import { Dialog } from "@capacitor/dialog";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { getApiUrl } from "../../../utils/api";
import toast from "react-hot-toast";

export interface Rider {
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
  dailySettlements?: Record<string, "PAID" | "UNPAID">;
  totalOrdersDelivered?: number;
  liveEarnings?: number;
  totalInvoicedAmount?: number;
  totalGeneratedCod?: number;
}

export function useRiderOperations() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals / Form overlays
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [showCollectModal, setShowCollectModal] = useState<Rider | null>(null);
  const [showSettleModal, setShowSettleModal] = useState<Rider | null>(null);

  // Context Menu and Interactive Daily Ledger States
  const [openMenuRiderId, setOpenMenuRiderId] = useState<string | null>(null);
  const [activeLedgerRider, setActiveLedgerRider] = useState<Rider | null>(
    null,
  );
  const [selectedLedgerDate, setSelectedLedgerDate] = useState<{
    dayName: string;
    dateLabel: string;
    label: string;
    dateKey: string;
  } | null>(null);

  // Premium Custom Flows State
  const [selectedDayPerRider, setSelectedDayPerRider] = useState<
    Record<
      string,
      { dayName: string; dateLabel: string; label: string; dateKey: string }
    >
  >({});
  const [fullDaySelectActive, setFullDaySelectActive] = useState(false);
  const [collectSubMode, setCollectSubMode] = useState<
    "PAID" | "UNPAID" | null
  >(null);

  // Custom 2-step confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    step: 1 | 2;
    title: string;
    messageStep1: string;
    messageStep2: string;
    onConfirmed: () => Promise<void> | void;
  } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("Electric Scooter");
  const [status, setStatus] = useState("Online");
  const [codBalanceInit, setCodBalanceInit] = useState("0");

  // OTP Verification States
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [riderOtpError, setRiderOtpError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Collect Cash State
  const [collectAmount, setCollectAmount] = useState("");

  // Settle Earnings State
  const [settlePayAmount, setSettlePayAmount] = useState("");

  // Rider Orders Detail View (Eye Icon)
  const [selectedRiderForOrders, setSelectedRiderForOrders] =
    useState<Rider | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>(
    {},
  );

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchRiders = useCallback(async () => {
    const { data } = await supabase
      .from("team")
      .select("*")
      .eq("role", "Rider");
    if (data) {
      setRiders(data as Rider[]);
    }
    setLoading(false);
  }, []);

  const [globalOrders, setGlobalOrders] = useState<any[]>([]);
  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(3000);
    if (data) setGlobalOrders(data);
  }, []);

  // 1. Sync Riders Fleet Real-Time
  useEffect(() => {
    let sub: any;
    fetchRiders();

    // Native App Background/Foreground State Reload
    let appStateListener: any;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          console.log(
            "[Native RiderManagement] App resumed to foreground, ensuring real-time Rider sync...",
          );
          fetchRiders();
        }
      }).then((listener) => {
        appStateListener = listener;
      });
    }

    sub = supabase
      .channel("console_riders_fleet")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team",
          filter: "role=eq.Rider",
        },
        () => {
          fetchRiders();
        },
      )
      .subscribe();

    return () => {
      if (sub) sub.unsubscribe();
      if (appStateListener) appStateListener.remove();
    };
  }, [fetchRiders]);

  // 2. Global live snapshot of Orders for offline metrics recalculation
  useEffect(() => {
    let sub: any;
    fetchOrders();

    sub = supabase
      .channel("console_global_orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        },
      )
      .subscribe();
    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [fetchOrders]);

  // OTP Verification Operations
  const handleSendOtp = async () => {
    const formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit mobile number!");
    }

    setIsSendingOtp(true);
    setOtpInput("");
    setIsOtpVerified(false);

    try {
      console.log("[Firebase Auth] Web Phone OTP initialization...");
      const firebasePromise = (async () => {
        if (Capacitor.isNativePlatform()) {
          return new Promise(async (resolve, reject) => {
            let codeSentListener: any = null;
            let verificationFailedListener: any = null;
            let authStateListener: any = null;

            const cleanup = async () => {
              try {
                if (codeSentListener)
                  await codeSentListener.remove().catch(() => {});
                if (verificationFailedListener)
                  await verificationFailedListener.remove().catch(() => {});
                if (authStateListener)
                  await authStateListener.remove().catch(() => {});
              } catch (cleanErr) {
                console.warn(
                  "[Native Phone Auth] Listener cleanup error:",
                  cleanErr,
                );
              }
            };

            try {
              authStateListener = await FirebaseAuthentication.addListener(
                "authStateChange",
                async (event) => {
                  if (event.user) {
                    await cleanup();
                    resolve({
                      isNativeAuth: true,
                      autoVerified: true,
                      verificationId: "auto",
                    });
                  }
                },
              );

              codeSentListener = await FirebaseAuthentication.addListener(
                "phoneCodeSent",
                async (event: any) => {
                  console.log(
                    "[Native Phone Auth] phoneCodeSent trigger:",
                    event,
                  );
                  await cleanup();
                  resolve({
                    isNativeAuth: true,
                    verificationId: event.verificationId,
                  });
                },
              );

              verificationFailedListener =
                await FirebaseAuthentication.addListener(
                  "phoneVerificationFailed",
                  async (event: any) => {
                    console.error(
                      "[Native Phone Auth] phoneVerificationFailed trigger:",
                      event,
                    );
                    await cleanup();
                    reject(
                      new Error(
                        event.message ||
                          "Android Phone Authentication failed. Please check your network connection or Firebase settings.",
                      ),
                    );
                  },
                );

              console.log(
                "[Native Phone Auth] signInWithPhoneNumber calling with +91" +
                  formattedPhone,
              );
              await FirebaseAuthentication.signInWithPhoneNumber({
                phoneNumber: `+91${formattedPhone}`,
              });
            } catch (err) {
              await cleanup();
              reject(err);
            }
          });
        } else {
          let verifier = (window as any).recaptchaVerifier;
          if (!verifier) {
            if (!document.getElementById("recaptcha-container-rider")) {
              const newContainer = document.createElement("div");
              newContainer.id = "recaptcha-container-rider";
              newContainer.style.position = "fixed";
              newContainer.style.bottom = "10px";
              newContainer.style.right = "10px";
              newContainer.style.width = "1px";
              newContainer.style.height = "1px";
              newContainer.style.opacity = "0.01";
              newContainer.style.pointerEvents = "none";
              newContainer.style.zIndex = "99999";
              document.body.appendChild(newContainer);
            }
            verifier = new RecaptchaVerifier(
              auth,
              "recaptcha-container-rider",
              {
                size: "invisible",
                callback: () => {
                  console.log("[Firebase Recaptcha] Callback triggered.");
                },
              },
            );
            await verifier.render();
            (window as any).recaptchaVerifier = verifier;
          }

          const confirmation = await signInWithPhoneNumber(
            auth,
            `+91${formattedPhone}`,
            verifier,
          );
          return confirmation;
        }
      })();

      const confirmationResultData = await firebasePromise;
      setConfirmationResult(confirmationResultData);
      setRiderOtpError(null);
      setIsOtpSent(true);
      toast.success(
        `Verification OTP has been sent to +91 ${formattedPhone}! 📲`,
      );
    } catch (err: any) {
      console.warn("Real Firebase OTP dispatch failed. Fallback active:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);

      let detailedMsg = "";
      if (
        errCode === "auth/unauthorized-domain" ||
        errMsg.includes("unauthorized") ||
        errMsg.includes("domain")
      ) {
        detailedMsg = `Your current preview domain "${window.location.hostname}" is not added in the Firebase Console!
        
        This means Firebase is preventing real text message sending requests.
        
        To send SMS without issues:
        1. Open Firebase Console -> Authentication -> Settings tab.
        2. In "Authorized Domains" settings, click 'Add Domain'.
        3. Enter domain address: ${window.location.hostname} and save!
        4. Real SMS will dynamically start working!`;
      } else if (
        errCode === "auth/operation-not-allowed" ||
        errMsg.includes("operation-not-allowed")
      ) {
        detailedMsg = `Phone Sign-in toggle is disabled in Firebase Project settings.
        
        Solution step:
        1. Open Firebase Console -> Authentication -> Sign-in Method.
        2. Enable the Phone method and save settings!`;
      } else if (
        errCode === "auth/api-key-expired" ||
        errMsg.includes("api-key-expired")
      ) {
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
          console.log(
            "[Client OTP Verification] Confirming rider OTP directly using Client SDK...",
          );
          if (confirmationResult.isNativeAuth) {
            const currentUser = await FirebaseAuthentication.getCurrentUser();
            if (
              currentUser &&
              currentUser.user &&
              confirmationResult.autoVerified
            ) {
              console.log(
                "[Native OTP Verification] Rider already auto-verified by Play Services!",
              );
              const tokenResult = await FirebaseAuthentication.getIdToken();
              clientUid = currentUser.user.uid;
              idToken = tokenResult.token;
              isVerified = true;
            } else {
              const nativeResult =
                await FirebaseAuthentication.confirmVerificationCode({
                  verificationId: confirmationResult.verificationId,
                  verificationCode: otpInput,
                });
              const tokenResult = await FirebaseAuthentication.getIdToken();
              clientUid = nativeResult.user?.uid || "";
              idToken = tokenResult.token;
              isVerified = true;
              console.log(
                "[Native OTP Verification SUCCESS] Verified native client-side for rider UID:",
                clientUid,
              );
            }
          } else {
            const userCredential = await confirmationResult.confirm(otpInput);
            clientUid = userCredential.user.uid;
            try {
              idToken = await userCredential.user.getIdToken();
            } catch (tokenErr) {
              console.warn(
                "Failed to retrieve rider client idToken:",
                tokenErr,
              );
            }
            isVerified = true;
            console.log(
              "[Client OTP Verification SUCCESS] Verified client-side for rider UID:",
              clientUid,
            );
          }
        } catch (clientVerifyErr: any) {
          console.error(
            "Client confirm failed for rider identification:",
            clientVerifyErr,
          );
          toast.error(
            "Incorrect OTP! Please enter the correct 6-digit verification code. 🛑",
          );
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
          idToken: idToken,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        if (isVerified) {
          console.warn(
            "Client was verified but server sync profile failed:",
            resData.error,
          );
        } else {
          throw new Error(resData.error || "Incorrect OTP");
        }
      }

      console.log("[SERVER RIDER OTP VERIFICATION SUCCESS]", resData);

      if (resData.fallbackToken) {
        localStorage.setItem("grezto_fallback_token", resData.fallbackToken);
        console.log(
          "[Fallback Auth] Cryptographic fallback token stored securely (Rider mode).",
        );
      }

      // Support native client session association if desired
      if (resData.customToken && !isVerified) {
        try {
          if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signInWithCustomToken({
              token: resData.customToken,
            });
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
      toast.error(
        err.message ||
          "Incorrect OTP entered! Please check the correct code. ❌",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return toast.error("Please fill Name and Phone number.");
    }
    const formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit phone number.");
    }

    // New rider must verify phone number first
    if (!editingRider && !isOtpVerified) {
      return toast.error(
        "Please verify the Rider's phone number before registering!",
      );
    }

    const riderId = editingRider ? editingRider.id : `rider_${Date.now()}`;
    const riderData: any = {
      id: riderId,
      name: name.trim(),
      phone: formattedPhone,
      vehicle,
      status,
      role: "Rider",
      updatedAt: new Date().toISOString(),
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
      const { error: upsertError } = await supabase
        .from("team")
        .upsert(riderData);

      if (upsertError) {
        console.error(
          "[Supabase Error] Upsert failed for team table:",
          upsertError,
        );
        toast.error(
          `Error saving Rider: ${upsertError.message || "Failed to save rider. Sync issue."}`,
        );
        return;
      }

      if (!editingRider) {
        // Send a 100% congratulatory message through Firebase Firestore trigger trigger_sms rules
        try {
          const smsPayload = {
            to: `+91${formattedPhone}`,
            body: `Congratulations ${name.trim()}! You are successfully registered as a Grezto Delivery Partner. Welcome to our family! 🛵✨`,
            createdAt: new Date().toISOString(),
            status: "pending",
            riderId,
          };
          await supabase.from("sms_notifications").insert(smsPayload);
          console.log(
            "[Supabase] Congratulatory SMS written successfully:",
            smsPayload,
          );
          toast.success("Congratulatory welcome SMS has been sent! 📱🌟");
        } catch (smsErr) {
          console.warn(
            "SMS collection trigger write failed, simulated success:",
            smsErr,
          );
        }
      }

      toast.success(
        editingRider
          ? "Rider updated successfully! 🛵"
          : "New Delivery Partner Registered! 🚀",
      );
      fetchRiders();
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      toast.error("Cloud synchronisation failed.");
    }
  };

  const resetForm = () => {
    setEditingRider(null);
    setName("");
    setPhone("");
    setVehicle("Electric Scooter");
    setStatus("Online");
    setCodBalanceInit("0");
    setIsSendingOtp(false);
    setIsOtpSent(false);
    setOtpInput("");
    setIsVerifyingOtp(false);
    setIsOtpVerified(false);
    setConfirmationResult(null);
  };

  const handleCleanRiderConsole = async (rider: Rider) => {
    const { value: isConfirmed } = await Dialog.confirm({
      title: "Confirmation",
      message: `Are you sure you want to clear all active/stuck orders for Delivery Partner / Rider "${rider.name}"? This will clean up their active Console and reset the cash balance to zero initially in our system.`,
    });
    if (!isConfirmed) return;

    setOpenMenuRiderId(null);
    const loadToast = toast.loading(
      `Cleaning ${rider.name}'s active assignments...`,
    );
    try {
      // 1. Reset COD balance & cash collection back to initial in the 'team' collection doc
      const initBal = Number(rider.codBalanceInit || 0);
      await supabase
        .from("team")
        .update({
          codBalance: initBal,
          totalCollectedCash: 0,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", rider.id);

      setRiders((prev) =>
        prev.map((r) =>
          r.id === rider.id
            ? { ...r, codBalance: initBal, totalCollectedCash: 0 }
            : r,
        ),
      );
      fetchRiders();

      // 2. Query all active orders assigned to this rider's phone that are not Delivered or Cancelled
      const { data: getOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("partnerPhone", rider.phone);
      const ordersToCancel = (getOrders || []).filter(
        (o) => o.status !== "Delivered" && o.status !== "Cancelled",
      );

      let cleanedCount = 0;
      for (const o of ordersToCancel) {
        await supabase
          .from("orders")
          .update({
            status: "Cancelled",
            updatedAt: new Date().toISOString(),
          })
          .eq("id", o.id);
        cleanedCount++;
      }

      toast.success(
        `${rider.name}'s Console successfully cleaned! ${cleanedCount} stuck assignments cleared. 🛵⚡🎉`,
        { id: loadToast },
      );
      fetchOrders();
    } catch (err: any) {
      console.error(err);
      toast.error(`Clearance failed: ${err.message || "Error occurred"}`, {
        id: loadToast,
      });
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
          await supabase
            .from("team")
            .update({
              status: "Offline",
              unregistered: true,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", rider.id);

          setRiders((prev) =>
            prev.map((r) =>
              r.id === rider.id
                ? { ...r, status: "Offline", unregistered: true }
                : r,
            ),
          );
          fetchRiders();

          toast.success(`${rider.name} suspended from Active Fleets. 🚫`);
        } catch (err) {
          toast.error("Failed to suspend rider.");
        }
      },
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
          await supabase.from("team").delete().eq("id", rider.id);
          setRiders((prev) => prev.filter((r) => r.id !== rider.id));
          fetchRiders();
          toast.success(`${rider.name} deleted permanently.`);
        } catch (err) {
          toast.error("Failed to delete rider registry.");
        }
      },
    });
  };

  // React state auto-refresh whenever DB data updates
  useEffect(() => {
    if (activeLedgerRider) {
      const freshDoc = riders.find((r) => r.id === activeLedgerRider.id);
      if (freshDoc) {
        setActiveLedgerRider(freshDoc);
      }
    }
  }, [riders]);

  // Generates last 7 days of dynamic ledger entries with beautiful representations
  const getLast7Days = () => {
    const list = [];
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dayName = daysOfWeek[d.getDay()];
      const dateNum = d.getDate();
      const monthName = months[d.getMonth()];
      const yearNum = d.getFullYear();

      const label = `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
      const dateLabel = `${dateNum} ${monthName} ${yearNum}`;

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      list.push({
        dayName,
        dateLabel,
        label,
        dateKey,
      });
    }
    return list;
  };

  const handleToggleDayStatus = async (status: "PAID" | "UNPAID") => {
    if (!activeLedgerRider || !selectedLedgerDate) return;

    const dayLabel = selectedLedgerDate.dateLabel;
    const riderName = activeLedgerRider.name;

    setConfirmModal({
      step: 1,
      title: "Set Day Status",
      messageStep1: `Mark ${dayLabel} as ${status} for ${riderName}?`,
      messageStep2: `Are you 100% sure that cash for ${dayLabel} is completely ${status === "PAID" ? "received & accounted at counter" : "marked pending"}?`,
      onConfirmed: async () => {
        try {
          const currentSettlements = activeLedgerRider.dailySettlements || {};
          const updatedSettlements = {
            ...currentSettlements,
            [selectedLedgerDate.dateKey]: status,
          };

          await supabase
            .from("team")
            .update({
              dailySettlements: updatedSettlements,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", activeLedgerRider.id);

          // Instantly refresh local active element
          setActiveLedgerRider((prev) =>
            prev
              ? {
                  ...prev,
                  dailySettlements: updatedSettlements,
                }
              : null,
          );

          setRiders((prev) =>
            prev.map((r) =>
              r.id === activeLedgerRider.id
                ? { ...r, dailySettlements: updatedSettlements }
                : r,
            ),
          );
          fetchRiders();

          toast.success(`Day ${dayLabel} status marked ${status}! 🏆`);
        } catch (err) {
          toast.error("Failed to write to settlement records.");
        }
      },
    });
  };

  const handleDeleteRider = async (id: string) => {
    setConfirmModal({
      step: 1,
      title: "Terminate Agreement",
      messageStep1:
        "Are you absolutely sure you want to terminate this Rider's association with your fleet? This deactivates their active profile.",
      messageStep2:
        "Final warning: This action is permanent and deletes their registry from the database. Proceed?",
      onConfirmed: async () => {
        try {
          await supabase.from("team").delete().eq("id", id);
          toast.success("Rider removed successfully.");
          setShowAddForm(false);
          resetForm();
        } catch (err) {
          toast.error("Failed to delete rider profile.");
        }
      },
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
            [day.dateKey]: "UNPAID" as const,
          };

          // Optimistic update FIRST
          setRiders((prev) =>
            prev.map((r) =>
              r.id === showCollectModal.id
                ? {
                    ...r,
                    dailySettlements: updatedSettlements,
                    updatedAt: new Date().toISOString(),
                  }
                : r,
            ),
          );

          toast.success(
            `${day.dayName} marked UNPAID for ${showCollectModal.name}. 🔴`,
          );
          const modalId = showCollectModal.id;
          setShowCollectModal(null);
          setCollectSubMode(null);

          await supabase
            .from("team")
            .update({
              dailySettlements: updatedSettlements,
              updatedAt: new Date().toISOString(),
            })
            .eq("id", modalId);

          fetchRiders();
        } catch (err) {
          toast.error("Failed to mark status.");
        }
      },
    });
  };

  const executePaidCollection = async (
    amountToCollect: number,
    currentBal: number,
  ) => {
    if (!showCollectModal) return;
    const day = getSelectedDayForRider(showCollectModal.id);
    try {
      const prevCollected = Number(showCollectModal.totalCollectedCash || 0);
      const newCollectedTotal = prevCollected + amountToCollect;

      const finalBal = Math.max(0, currentBal - amountToCollect);
      const currentSettlements = showCollectModal.dailySettlements || {};
      const updatedSettlements = {
        ...currentSettlements,
        [day.dateKey]: "PAID" as const,
      };

      // Optimistic update FIRST, before DB call
      setRiders((prev) =>
        prev.map((r) =>
          r.id === showCollectModal.id
            ? {
                ...r,
                totalCollectedCash: newCollectedTotal,
                codBalance: finalBal,
                dailySettlements: updatedSettlements,
                updatedAt: new Date().toISOString(),
              }
            : r,
        ),
      );

      toast.success(
        `Collected ₹${amountToCollect}! ${day.dayName} marked PAID successfully! 🟢`,
      );
      const modalId = showCollectModal.id;
      setShowCollectModal(null);
      setCollectSubMode(null);
      setCollectAmount("");

      await supabase
        .from("team")
        .update({
          totalCollectedCash: newCollectedTotal,
          codBalance: finalBal,
          dailySettlements: updatedSettlements,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", modalId);

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
        },
      });
      return;
    }

    await executePaidCollection(amountToCollect, currentBal);
  };

  // Calculations for specific Rider
  const getRiderMetrics = (rider: Rider) => {
    let deliveredCount = 0;
    let liveEarnings = 0;
    let totalInvoicedAmount = 0;
    let totalGeneratedCod = 0;
    let totalDeliveryCharges = 0;

    globalOrders.forEach((order) => {
      if (
        order.partnerPhone === rider.phone &&
        (order.status === "Delivered" || order.status === "delivered")
      ) {
        deliveredCount++;
        const bill = Number(
          order.finalAmount ||
            order.amount ||
            order.billTotal ||
            order.totalAmount ||
            0,
        );
        totalInvoicedAmount += bill;
        const codAmt =
          order.paymentMethod === "Cash on Delivery" ||
          order.paymentMethod === "COD"
            ? bill
            : 0;
        totalGeneratedCod += codAmt;
        liveEarnings += Number(order.riderFee || 25);
        totalDeliveryCharges += Number(order.deliveryCharge || 0);
      }
    });

    const settled = Number(rider.totalCollectedCash || 0);
    const liveCodBalance = Math.max(0, totalGeneratedCod - settled);

    return {
      deliveredCount,
      liveEarnings,
      totalInvoicedAmount,
      totalGeneratedCod,
      liveCodBalance,
      totalDeliveryCharges,
      remainingDeliveryCharges: totalDeliveryCharges - liveEarnings,
    };
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
      setRiders((prev) =>
        prev.map((r) =>
          r.id === showSettleModal.id
            ? {
                ...r,
                liveEarnings: currentLiveEarnings - amountToSettle,
                lastSettledDate: new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                updatedAt: new Date().toISOString(),
              }
            : r,
        ),
      );

      toast.success(
        `Settlement of ₹${amountToSettle} recorded for ${showSettleModal.name}! 🤝`,
      );
      const modalId = showSettleModal.id;
      setShowSettleModal(null);
      setSettlePayAmount("");

      await supabase
        .from("team")
        .update({
          liveEarnings: currentLiveEarnings - amountToSettle,
          lastSettledDate: new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", modalId);

      fetchRiders();
    } catch (err) {
      toast.error("Failed to record settlement.");
    }
  };

  return {
    riders,
    setRiders,
    loading,
    showAddForm,
    setShowAddForm,
    editingRider,
    setEditingRider,
    showCollectModal,
    setShowCollectModal,
    showSettleModal,
    setShowSettleModal,
    openMenuRiderId,
    setOpenMenuRiderId,
    activeLedgerRider,
    setActiveLedgerRider,
    selectedLedgerDate,
    setSelectedLedgerDate,
    selectedDayPerRider,
    setSelectedDayPerRider,
    fullDaySelectActive,
    setFullDaySelectActive,
    collectSubMode,
    setCollectSubMode,
    confirmModal,
    setConfirmModal,
    name,
    setName,
    phone,
    setPhone,
    vehicle,
    setVehicle,
    status,
    setStatus,
    codBalanceInit,
    setCodBalanceInit,
    isSendingOtp,
    isOtpSent,
    setIsOtpSent,
    otpInput,
    setOtpInput,
    isVerifyingOtp,
    isOtpVerified,
    setIsOtpVerified,
    riderOtpError,
    setRiderOtpError,
    confirmationResult,
    setConfirmationResult,
    collectAmount,
    setCollectAmount,
    settlePayAmount,
    setSettlePayAmount,
    selectedRiderForOrders,
    setSelectedRiderForOrders,
    expandedOrders,
    setExpandedOrders,
    isMounted,
    fetchRiders,
    handleSendOtp,
    handleVerifyOtp,
    handleSaveRider,
    resetForm,
    handleCleanRiderConsole,
    handleUnregisterRider,
    handleDeleteRiderTwoStep,
    getLast7Days,
    handleToggleDayStatus,
    handleDeleteRider,
    getSelectedDayForRider,
    handleUnpaidCollectVerification,
    handlePaidCollectAndSetStatus,
    getRiderMetrics,
    handleSettleEarnings,
  };
}
