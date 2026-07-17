import express from "express";
import { supabase, admin } from "./clients";
import { safeSet, safeGet, safeDel } from "./redisClient";

const router = express.Router();

// Real function for sending WhatsApp via Meta Cloud API
async function sendWhatsAppOTP(phone: string, otp: string) {
  console.log(`[WhatsApp Meta API] Sending OTP ${otp} to phone +91${phone}`);
  
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn("⚠️ WhatsApp tokens missing in .env! Simulating OTP send...");
    return true;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `91${phone}`,
    type: "text",
    text: { 
      preview_url: false,
      body: `Your Grezto verification code is: *${otp}*\n\nPlease do not share this code with anyone.`
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("[WhatsApp Meta API] Error response:", data);
      throw new Error(data.error?.message || "Failed to send WhatsApp message");
    }

    console.log("[WhatsApp Meta API] Message sent successfully!", data.messages?.[0]?.id);
    return true;
  } catch (err) {
    console.error("[WhatsApp Meta API] Exception:", err);
    throw err; // Propagate the error so the frontend knows it failed
  }
}

// 1. POST /api/auth/send-whatsapp-otp
router.post("/send-whatsapp-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) {
      return res.status(400).json({ success: false, error: "Valid 10 digit phone number is required" });
    }

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redisKey = `whatsapp_otp:${phone}`;
    
    // Priority 1: Save in Redis (with 60 seconds TTL)
    const redisSuccess = await safeSet(redisKey, otp, 60);

    // Backup Engine: Supabase (if Redis is down or failed)
    if (!redisSuccess) {
      console.warn(`[OTP System] Redis is down or failed for +91${phone}. Falling back to Supabase Backup Engine!`);
      if (!supabase) throw new Error("Database client not available");
      
      // Zero-Millisecond Cleanup: Delete all old/dead OTPs for this number
      await supabase.from("otp_verifications")
        .delete()
        .eq("phone_number", phone);

      // Insert new OTP with 60 seconds expiration
      const expiresAt = new Date(Date.now() + 60 * 1000); 
      const { error } = await supabase.from("otp_verifications").insert({
        phone_number: phone,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        is_verified: false
      });

      if (error) {
        console.error("[OTP System] Supabase backup failed:", error);
        throw new Error("Could not generate OTP in backup engine");
      }
    }

    // Send the OTP via Meta API
    await sendWhatsAppOTP(phone, otp);

    res.json({ success: true, message: "WhatsApp OTP sent successfully (60s timer)" });
  } catch (err: any) {
    console.error("Error in send-whatsapp-otp:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to send OTP" });
  }
});

// Helper function to Verify OTP from either Redis (Primary) or Supabase (Backup)
async function verifyOtpEngine(phone: string, otp: string): Promise<boolean> {
  const redisKey = `whatsapp_otp:${phone}`;
  
  // 1. Try Redis first
  const cachedOtp = await safeGet(redisKey);
  if (cachedOtp) {
    if (cachedOtp === otp) {
      await safeDel(redisKey); // Delete immediately after successful use
      return true;
    }
    return false; // OTP matched Redis but was wrong
  }

  // 2. Try Supabase Backup Engine
  if (supabase) {
    const { data, error } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone_number", phone)
      .eq("otp_code", otp)
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      // Check expiry manually (just to be safe)
      if (new Date(data.expires_at).getTime() >= Date.now()) {
        // Valid! Mark as verified / Delete it
        await supabase.from("otp_verifications").delete().eq("id", data.id);
        return true;
      } else {
        // It's expired in DB, clean it up
        await supabase.from("otp_verifications").delete().eq("id", data.id);
      }
    }
  }

  return false;
}


// 2. POST /api/auth/verify-whatsapp-login (Customer Login -> Generates Firebase Token)
router.post("/verify-whatsapp-login", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP are required" });
    }

    const isValid = await verifyOtpEngine(phone, otp);
    
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid or Expired OTP" });
    }

    // Generate Firebase Custom Token
    if (!admin || admin.apps.length === 0) {
      return res.status(500).json({ success: false, error: "Firebase Admin SDK is not configured." });
    }

    const uid = `+91${phone}`; 
    const customToken = await admin.auth().createCustomToken(uid);

    res.json({ success: true, customToken });
  } catch (err: any) {
    console.error("Error in verify-whatsapp-login:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to verify OTP" });
  }
});


// 3. POST /api/auth/verify-whatsapp-registration (Admin Shop/Rider Registration -> NO Firebase Token)
router.post("/verify-whatsapp-registration", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP are required" });
    }

    const isValid = await verifyOtpEngine(phone, otp);
    
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid or Expired OTP" });
    }

    // Do NOT generate Firebase Token here. Just return success so Admin doesn't get logged out!
    res.json({ success: true, message: "Phone number verified successfully!" });
  } catch (err: any) {
    console.error("Error in verify-whatsapp-registration:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to verify OTP" });
  }
});

export default router;
