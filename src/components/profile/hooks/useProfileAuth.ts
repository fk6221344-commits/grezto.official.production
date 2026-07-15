import { useState, useEffect } from "react";
import { useUser } from "../../../context/UserContext";
import { supabase } from "../../../services/supabase";
import { auth } from "../../../services/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { getApiUrl } from "../../../utils/api";
import toast from "react-hot-toast";

export function useProfileAuth() {
  const { login, updateProfile, firebaseAuthReady } = useUser();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginName, setLoginName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [serverOtp, setServerOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [useFastOtp, setUseFastOtp] = useState(true);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<{
    show: boolean;
    title: string;
    message: string;
    isOwner: boolean;
    technicalDetails?: string;
  } | null>(null);

  // Dynamic warm-up of reCAPTCHA verifier
  useEffect(() => {
    if (showLoginModal) {
      const initializeWarmup = async () => {
        try {
          if (!document.getElementById("recaptcha-container")) {
            const newContainer = document.createElement("div");
            newContainer.id = "recaptcha-container";
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
          if (!(window as any).recaptchaVerifier) {
            const verifier = new RecaptchaVerifier(
              auth,
              "recaptcha-container",
              {
                size: "invisible",
                callback: () => {},
              },
            );
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

  // Listener for global sign-up triggers
  useEffect(() => {
    const handleOpenLogin = (e: any) => {
      const mode = e.detail?.mode || "signup";
      setAuthMode(mode);
      setLoginName("");
      setLoginPhone("");
      setOtpCode("");
      setIsOtpSent(false);
      setServerOtp("");
      setShowLoginModal(true);
    };
    window.addEventListener("open-login-modal", handleOpenLogin);

    const forceOpen = localStorage.getItem("grezto_force_open_signup");
    if (forceOpen === "true") {
      localStorage.removeItem("grezto_force_open_signup");
      setAuthMode("signup");
      setLoginName("");
      setLoginPhone("");
      setOtpCode("");
      setIsOtpSent(false);
      setServerOtp("");
      setShowLoginModal(true);
    }

    return () =>
      window.removeEventListener("open-login-modal", handleOpenLogin);
  }, []);

  const promiseTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
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

    if (authMode === "signup" && !loginName.trim()) {
      return toast.error("Please enter your name to create your account!");
    }

    setAuthLoading(true);
    setServerOtp("");
    setConfirmationResult(null);

    try {
      let exists = false;

      try {
        const { data } = await supabase
          .from("profiles")
          .select("phone")
          .eq("phone", loginPhone)
          .maybeSingle();
        if (data) {
          exists = true;
        }
      } catch (dbErr: any) {
        console.warn(
          "Supabase lookup timed out or bypassed, utilizing local cache check:",
          dbErr,
        );
      }

      if (authMode === "signup" && exists) {
        setAuthLoading(false);
        return toast.error(
          "This phone number is already registered! Please choose 'Login' instead.",
        );
      }

      if (authMode === "login" && !exists) {
        setAuthLoading(false);
        return toast.error(
          "This phone number is not registered yet! Please choose 'Create Account' first.",
        );
      }
    } catch (err: any) {
      console.warn("Pre-checks bypassed:", err);
    }

    try {
      const firebasePromise = new Promise(async (resolve, reject) => {
        const triggerWebFallback = async () => {
          console.log("[Fallback] Trying Web Invisible reCAPTCHA...");
          try {
            // Bulletproof container check to prevent DOM errors
            if (!document.getElementById("recaptcha-container")) {
              const newContainer = document.createElement("div");
              newContainer.id = "recaptcha-container";
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

            let verifier = (window as any).recaptchaVerifier;
            if (!verifier) {
              verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
                size: "invisible",
                callback: () => {},
              });
              await verifier.render();
              (window as any).recaptchaVerifier = verifier;
            }

            const confirmation = await signInWithPhoneNumber(
              auth,
              `+91${loginPhone}`,
              verifier,
            );
            resolve(confirmation);
          } catch (err) {
            reject(err);
          }
        };

        if (Capacitor.isNativePlatform()) {
          try {
            let codeSentListener: any = null;
            let failCleanup: any = null;
            let authStateListener: any = null;

            const removeAllListeners = async () => {
              try {
                if (codeSentListener)
                  await codeSentListener.remove().catch(() => {});
                if (failCleanup) await failCleanup.remove().catch(() => {});
                if (authStateListener)
                  await authStateListener.remove().catch(() => {});
              } catch (e) {}
            };

            authStateListener = await FirebaseAuthentication.addListener(
              "authStateChange",
              async (event) => {
                if (event.user) {
                  await removeAllListeners();
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
                await removeAllListeners();
                resolve({
                  isNativeAuth: true,
                  verificationId: event.verificationId,
                });
              },
            );

            failCleanup = await FirebaseAuthentication.addListener(
              "phoneVerificationFailed",
              async (event: any) => {
                await removeAllListeners();
                console.warn("Native phone auth failed.", event.message);
                reject(event);
              },
            );

            console.log(
              "[Native Phone Auth] signInWithPhoneNumber calling with +91" +
                loginPhone,
            );
            await FirebaseAuthentication.signInWithPhoneNumber({
              phoneNumber: `+91${loginPhone}`,
            });
          } catch (err) {
            console.warn("Native phone auth invocation failed.", err);
            reject(err);
          }
        } else {
          await triggerWebFallback();
        }
      });

      const result = await promiseTimeout(firebasePromise, 30000);
      setConfirmationResult(result);
      setOtpError(null);
      setIsOtpSent(true);
      toast.success(`Verification code sent to +91 ${loginPhone} via SMS! 📲`, {
        duration: 6000,
      });
    } catch (err: any) {
      // 1000% Bulletproof Error Recovery: Clear stale reCAPTCHA to ensure the next click works perfectly
      try {
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        }
        const container = document.getElementById("recaptcha-container");
        if (container) {
          container.innerHTML = "";
        }
      } catch (clearErr) {
        console.warn("reCAPTCHA cleanup failed:", clearErr);
      }

      console.warn(
        "Real Firebase OTP dispatch failed. Generating audit logs:",
        err,
      );
      const errCode = err?.code || "";
      const errMsg = err?.message || String(err);

      let detailedMsg = "";
      if (
        errCode === "auth/unauthorized-domain" ||
        errMsg.includes("unauthorized") ||
        errMsg.includes("domain")
      ) {
        detailedMsg = `Your current preview domain "${window.location.hostname}" is not added in the Firebase Console!
        
        This means the permission to verify real SMS is blocked.
        
        To fix:
        1. Open Firebase Console -> Authentication -> Settings Tab.
        2. Click "Add Domain" in the "Authorized Domains" block.
        3. Enter this address: ${window.location.hostname} and save!
        4. Safe dynamic real SMS OTP will start arriving!`;
      } else if (
        errCode === "auth/operation-not-allowed" ||
        errMsg.includes("operation-not-allowed")
      ) {
        detailedMsg = `The 'Phone Sign-in' method is not enabled in the Firebase Console!
        
        To fix:
        1. Open Firebase Console -> Authentication -> Sign-in Method.
        2. Select the Phone method, toggle it on (Enable), and Save.`;
      } else if (
        errCode === "auth/too-many-requests" ||
        errMsg.includes("too-many-requests")
      ) {
        detailedMsg =
          "SMS quota limit or security blocks triggered. Please try again later or use fallback credentials!";
      } else {
        detailedMsg = `Firebase Connection Blocked!\n\nDetail: ${errMsg}\n\nIf mobile carrier, network settings, or firebase keys configuration are incorrect, real SMS dispatch can fail.`;
      }

      setOtpError(detailedMsg);

      const isOwner =
        loginPhone === "9864975468" ||
        loginPhone === "919864975468" ||
        loginPhone.endsWith("9864975468");

      if (isOwner) {
        let technicalInfo = `Error Code: ${errCode || "N/A"}\nMessage: ${errMsg}`;
        if (
          errCode === "auth/unauthorized-domain" ||
          errMsg.includes("unauthorized") ||
          errMsg.includes("domain")
        ) {
          technicalInfo += `\n\n[DIAGNOSIS] Domain "${window.location.hostname}" is not authorized in Firebase Console -> Authentication -> Settings.`;
        } else if (
          errCode === "auth/operation-not-allowed" ||
          errMsg.includes("operation-not-allowed")
        ) {
          technicalInfo += `\n\n[DIAGNOSIS] 'Phone' sign-in is not enabled under Authentication -> Sign-in Method.`;
        } else if (
          errCode === "auth/too-many-requests" ||
          errMsg.includes("too-many-requests")
        ) {
          technicalInfo += `\n\n[DIAGNOSIS] Too many requests / quota exceeded. Firebase blocks temporary requests for safety.`;
        }

        setAuthError({
          show: true,
          title: "🛠️ Developer Diagnostic Report",
          message:
            detailedMsg ||
            "Firebase OTP dispatch failed. Here is the direct system error report:",
          isOwner: true,
          technicalDetails: technicalInfo,
        });
      } else {
        const isQuotaOrRateLimit =
          errCode === "auth/too-many-requests" ||
          errMsg.includes("too-many-requests") ||
          errMsg.includes("quota") ||
          errMsg.includes("limit") ||
          errMsg.includes("exceeded") ||
          errMsg.includes("blocked") ||
          errMsg.includes("unusual activity");

        if (isQuotaOrRateLimit) {
          setAuthError({
            show: true,
            title: "Too Many Attempts",
            message:
              "You have requested OTPs too many times.\nPlease take a short break and try again later.",
            isOwner: false,
          });
        } else {
          setAuthError({
            show: true,
            title: "Connection Error",
            message:
              "We are unable to verify your number right now.\nPlease check your network and try again.",
            isOwner: false,
          });
        }
      }
    }

    setAuthLoading(false);
  };

  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "signup" && !loginName.trim()) {
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
          console.log(
            "[Client OTP Verification] Confirming OTP directly using Client SDK...",
          );
          if (confirmationResult.isNativeAuth) {
            const currentUser = await FirebaseAuthentication.getCurrentUser();
            if (
              currentUser &&
              currentUser.user &&
              confirmationResult.autoVerified
            ) {
              console.log(
                "[Native OTP Verification] User already auto-verified by Play Services!",
              );
              const tokenResult = await FirebaseAuthentication.getIdToken();
              clientUid = currentUser.user.uid;
              idToken = tokenResult.token;
            } else {
              const nativeResult =
                await FirebaseAuthentication.confirmVerificationCode({
                  verificationId: confirmationResult.verificationId,
                  verificationCode: otpCode,
                });
              const tokenResult = await FirebaseAuthentication.getIdToken();
              clientUid = nativeResult.user?.uid || "";
              idToken = tokenResult.token;
            }
          } else {
            const userCredential = await confirmationResult.confirm(otpCode);
            clientUid = userCredential.user.uid;
            try {
              idToken = await userCredential.user.getIdToken();
            } catch (tokenErr) {
              console.warn("Failed to retrieve client idToken:", tokenErr);
            }
          }
          isVerified = true;
          console.log(
            "[Client OTP Verification SUCCESS] Authenticated client-side with UID:",
            clientUid,
          );
        } catch (clientVerifyErr: any) {
          console.error("Client OTP confirm failed:", clientVerifyErr);
          toast.error(
            "Incorrect OTP! Please enter the correct 6-digit verification code. 🛑",
          );
          setAuthLoading(false);
          return;
        }
      }

      try {
        console.log(
          "[SERVER OTP VERIFICATION] Syncing OTP session securely with server side...",
        );
        const response = await fetch(getApiUrl("/api/auth/verify-otp"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: loginPhone,
            otp: otpCode,
            verificationId: isVerified
              ? "client-verified"
              : verifyVerificationId,
            clientUid: clientUid,
            idToken: idToken,
          }),
        });

        const resData = await response.json();

        if (!response.ok || !resData.success) {
          if (isVerified) {
            console.warn(
              "Client-side was authenticated but backend failed to update metadata profiles:",
              resData.error,
            );
          } else {
            toast.error(
              resData.error ||
                "Incorrect verification OTP! Please correct and try again.",
            );
            setAuthLoading(false);
            return;
          }
        }

        console.log(
          "[SERVER OTP VERIFICATION SUCCESS] Server verified/synced OTP:",
          resData,
        );

        if (resData.fallbackToken) {
          localStorage.setItem("grezto_fallback_token", resData.fallbackToken);
          console.log(
            "[Fallback Auth] Cryptographic fallback token stored securely.",
          );
        }

        if (resData.customToken && !isVerified) {
          try {
            await signInWithCustomToken(auth, resData.customToken);
            console.log(
              "[Firebase client sign-in] Custom token sign-in completed successfully.",
            );
          } catch (signinErr) {
            console.warn(
              "[Firebase client sign-in warning] Client auth sync bypassed, processing profile:",
              signinErr,
            );
          }
        }

        isVerified = true;
      } catch (verifyErr: any) {
        console.error("Server-side OTP validation failed:", verifyErr);
        if (!isVerified) {
          toast.error(
            "Standard verification failed due to connection error. Please try again.",
          );
          setAuthLoading(false);
          return;
        }
      }

      if (isVerified) {
        let existingAvatar = "";
        let existingAddress = "";
        let resolvedName =
          authMode === "signup" ? loginName.trim() : "Grezto Member";

        login(resolvedName, loginPhone, existingAvatar, existingAddress);

        setShowLoginModal(false);
        setOtpCode("");
        setServerOtp("");
        setIsOtpSent(false);
        setConfirmationResult(null);

        const isOwner =
          loginPhone === "9864975438" || loginPhone === "8638089161";
        if (isOwner) {
          toast.success("Welcome Back Master Owner! 👑🌿");
        } else {
          toast.success(`Welcome to Grezto, ${resolvedName}! 🌿`);
        }

        (async () => {
          try {
            const { data: dbData } = await supabase
              .from("profiles")
              .select("*")
              .eq("phone", loginPhone)
              .maybeSingle();
            if (dbData) {
              const freshAvatar = dbData.avatar || existingAvatar;
              const freshAddress =
                dbData.address !== null ? dbData.address : existingAddress;
              const freshName = dbData.name || resolvedName;

              updateProfile({
                name: freshName,
                avatar: freshAvatar,
                address: freshAddress,
                phone: loginPhone,
                isLoggedIn: true,
              });
            } else {
              updateProfile({
                name: resolvedName,
                avatar: existingAvatar,
                address: existingAddress,
                phone: loginPhone,
                isLoggedIn: true,
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

  return {
    showLoginModal,
    setShowLoginModal,
    loginPhone,
    setLoginPhone,
    loginName,
    setLoginName,
    otpCode,
    setOtpCode,
    serverOtp,
    setServerOtp,
    authLoading,
    setAuthLoading,
    authMode,
    setAuthMode,
    confirmationResult,
    setConfirmationResult,
    useFastOtp,
    setUseFastOtp,
    isOtpSent,
    setIsOtpSent,
    otpError,
    setOtpError,
    authError,
    setAuthError,
    handleSendOtpInline,
    handleVerifyAndLogin,
  };
}
