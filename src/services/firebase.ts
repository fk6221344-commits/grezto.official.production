import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import config from '../../firebase-applet-config.json';
import { logCrashlyticsError } from './nativeService';

const firebaseConfig = {
  ...config,
  apiKey: process.env.FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey
};

// 1. Safe Application Initialization
const app = initializeApp(firebaseConfig);

// Messaging Export
export let messaging: any = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
}).catch(() => console.warn("FCM Not Supported in this environment"));

export const auth = getAuth(app);

// Secondary App instance for Admin Registration (Prevents Admin session override)
const secondaryApp = initializeApp(firebaseConfig, "GreztoRegistryApp");
export const secondaryAuth = getAuth(secondaryApp);

// Automatically authenticate client session anonymously on startup if there is no active/saved phone credential
try {
  const saved = localStorage.getItem('grezto_user');
  let hasPhone = false;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.phone && parsed.phone.trim() !== "") {
        hasPhone = true;
      }
    } catch (e) {}
  }

  if (!hasPhone) {
    signInAnonymously(auth)
      .then((userCred) => {
        console.log("[Firebase Auth] Production anonymous credentials established successfully:", userCred.user.uid);
      })
      .catch((err) => {
        console.warn("[Firebase Auth] Anonymous sign-in failed (offline or container mode):", err);
      });
  } else {
    console.log("[Firebase Auth] Saved phone session detected. Skipping auto-anonymous fallback during module loading to protect user state.");
  }
} catch (e) {
  console.warn("[Firebase Auth] Init error:", e);
}

// Mandatory Custom Error Handler Wrapper for Zero-Trust Auditing
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('[Grezto Non-Fatal/Offline Fallback Dev]: ', JSON.stringify(errInfo));
  
  // Cleanly log the non-fatal exception to Firebase Crashlytics for background monitoring
  logCrashlyticsError(`Error [${operationType}] on path ${path || 'unknown'}: ${errInfo.error}`, {
    firestore_op: operationType,
    firestore_path: path || 'none',
    user_id: auth.currentUser?.uid || 'none',
    user_is_anonymous: auth.currentUser?.isAnonymous || false
  });
}
