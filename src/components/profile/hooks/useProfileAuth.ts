import { useState, useEffect } from "react";
import { useUser } from "../../../context/UserContext";
import { supabase } from "../../../services/supabase";
import { auth } from "../../../services/firebase";
import { signInWithCustomToken, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getApiUrl } from "../../../utils/api";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

export function useProfileAuth() {
  const { login, updateProfile } = useUser();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginName, setLoginName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [nativeVerificationId, setNativeVerificationId] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [isOtpSent, setIsOtpSent] = useState(false);
  
  // New 60-Second Professional Resend Timer
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Listener for global sign-up triggers
  useEffect(() => {
    const handleOpenLogin = (e: any) => {
      const mode = e.detail?.mode || "signup";
      setAuthMode(mode);
      setLoginName("");
      setLoginPhone("");
      setOtpCode("");
      setConfirmationResult(null);
      setNativeVerificationId("");
      setIsOtpSent(false);
      setResendTimer(0);
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
      setConfirmationResult(null);
      setNativeVerificationId("");
      setIsOtpSent(false);
      setResendTimer(0);
      setShowLoginModal(true);
    }

    return () =>
      window.removeEventListener("open-login-modal", handleOpenLogin);
  }, []);

  // Native Listeners for Phone Auth
  useEffect(() => {
    let sentSub: any;
    let failedSub: any;
    let completedSub: any;

    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
        setNativeVerificationId(event.verificationId);
        setIsOtpSent(true);
        setResendTimer(60);
        toast.success(`Verification code sent! 📲`);
        setAuthLoading(false);
      }).then(sub => sentSub = sub);

      FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
        console.error("Native Phone Auth Failed", event);
        toast.error(event.message || "Native verification failed");
        setAuthLoading(false);
      }).then(sub => failedSub = sub);

      FirebaseAuthentication.addListener('phoneVerificationCompleted', (event) => {
        toast.success("Phone verified automatically!");
        // User still needs to hit Login to proceed to DB, or we can auto login here. 
        // We leave it to the user to press Login with an empty OTP or we can trigger it natively.
      }).then(sub => completedSub = sub);
    }

    return () => {
      if (sentSub) sentSub.remove();
      if (failedSub) failedSub.remove();
      if (completedSub) completedSub.remove();
    };
  }, []);

  const initRecaptcha = () => {
    if (!(window as any).recaptchaVerifierProfile) {
      let container = document.getElementById('recaptcha-container-profile');
      if (!container) {
        container = document.createElement('div');
        container.id = 'recaptcha-container-profile';
        document.body.appendChild(container);
      }
      (window as any).recaptchaVerifierProfile = new RecaptchaVerifier(auth, 'recaptcha-container-profile', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved
        }
      });
    }
  };

  const handleSendOtpInline = async () => {
    if (loginPhone.length !== 10) {
      return toast.error("Please enter a valid 10-digit mobile number!");
    }

    if (authMode === "signup" && !loginName.trim()) {
      return toast.error("Please enter your name to create your account!");
    }

    setAuthLoading(true);

    try {
      let exists = false;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("phone")
          .eq("phone", loginPhone)
          .maybeSingle();
        if (data) exists = true;
      } catch (dbErr: any) {
        console.warn("Supabase lookup bypassed:", dbErr);
      }

      if (authMode === "signup" && exists) {
        setAuthLoading(false);
        return toast.error("This phone number is already registered! Please choose 'Login' instead.");
      }

      if (authMode === "login" && !exists) {
        setAuthLoading(false);
        return toast.error("This phone number is not registered yet! Please choose 'Create Account' first.");
      }

      const phoneNumberWithCode = "+91" + loginPhone;

      if (Capacitor.isNativePlatform()) {
        try {
          // Native Flow
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: phoneNumberWithCode });
          // We don't setAuthLoading(false) here, the listener will handle it!
        } catch (nativeErr: any) {
          console.error("Native sign in failed:", nativeErr);
          toast.error(nativeErr.message || "Failed to start native authentication");
          setAuthLoading(false);
        }
      } else {
        // Web Flow
        initRecaptcha();
        const appVerifier = (window as any).recaptchaVerifierProfile;
        
        const confResult = await signInWithPhoneNumber(auth, phoneNumberWithCode, appVerifier);
        setConfirmationResult(confResult);
        
        setIsOtpSent(true);
        setResendTimer(60);
        toast.success(`Verification code sent to +91 ${loginPhone} 📲`);
        setAuthLoading(false);
      }

    } catch (err: any) {
      console.error("Firebase Phone Auth failed:", err);
      toast.error(err.message || "Network Error: Could not send OTP.");
      // Reset reCAPTCHA on error so user can try again (web only)
      if (!Capacitor.isNativePlatform() && (window as any).recaptchaVerifierProfile) {
        (window as any).recaptchaVerifierProfile.render().then((widgetId: any) => {
          (window as any).grecaptcha.reset(widgetId);
        });
      }
      setAuthLoading(false);
    }
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
      return toast.error("Please enter the 6-digit OTP!");
    }

    setAuthLoading(true);
    try {
      console.log("[OTP System] Verifying Firebase Phone Auth OTP...");
      
      if (Capacitor.isNativePlatform()) {
        if (!nativeVerificationId) {
          toast.error("Please request an OTP first.");
          setAuthLoading(false);
          return;
        }
        await FirebaseAuthentication.confirmVerificationCode({
          verificationId: nativeVerificationId,
          verificationCode: otpCode
        });
        console.log("[Native Firebase] Phone auth completed successfully.");
      } else {
        if (!confirmationResult) {
          toast.error("Please request an OTP first.");
          setAuthLoading(false);
          return;
        }
        await confirmationResult.confirm(otpCode);
        console.log("[Firebase client sign-in] Phone auth completed successfully.");
      }

      // Local state update
      let existingAvatar = "";
      let existingAddress = "";
      let resolvedName = authMode === "signup" ? loginName.trim() : "Grezto Member";

      login(resolvedName, loginPhone, existingAvatar, existingAddress);

      setShowLoginModal(false);
      setOtpCode("");
      setIsOtpSent(false);
      setResendTimer(0);

      const isOwner = loginPhone === "9864975438" || loginPhone === "8638089161" || loginPhone === "9101022803";
      if (isOwner) {
        toast.success("Welcome Back Master Owner! 👑🌿");
      } else {
        toast.success(`Welcome to Grezto, ${resolvedName}! 🌿`);
      }

      // Background sync profile
      (async () => {
        try {
          const { data: dbData } = await supabase
            .from("profiles")
            .select("*")
            .eq("phone", loginPhone)
            .maybeSingle();
          if (dbData) {
            updateProfile({
              name: dbData.name || resolvedName,
              avatar: dbData.avatar || existingAvatar,
              address: dbData.address !== null ? dbData.address : existingAddress,
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

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Verification session aborted. Please try again.");
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
    authLoading,
    setAuthLoading,
    authMode,
    setAuthMode,
    isOtpSent,
    setIsOtpSent,
    resendTimer,
    handleSendOtpInline,
    handleVerifyAndLogin,
  };
}
