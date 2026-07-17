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

  // OTP logic removed. The Admin just creates the Rider and the Rider verifies their own number when logging in.

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



  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return toast.error("Please fill Name and Phone number.");
    }
    const formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit phone number.");
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
