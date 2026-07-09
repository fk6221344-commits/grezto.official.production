import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';
import { getApiUrl } from '../utils/api';

let activeSupabaseClient: any = null;

const getSupabaseConfig = () => {
  const savedUrl = localStorage.getItem('grezto_supabase_url');
  const savedKey = localStorage.getItem('grezto_supabase_anon_key');
  
  const url = savedUrl || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = savedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  return { url, anonKey };
};

const initSupabase = () => {
  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    try {
      activeSupabaseClient = createClient(url, anonKey);
    } catch (err) {
      console.error("[Supabase Proxy] Failed to initialize Supabase client:", err);
      activeSupabaseClient = null;
    }
  } else {
    activeSupabaseClient = null;
  }
};

// Initialize immediately on boot
initSupabase();

export const reinitializeSupabase = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem('grezto_supabase_url', url);
    localStorage.setItem('grezto_supabase_anon_key', key);
    activeSupabaseClient = createClient(url, key);
    console.log("[Supabase Proxy] Supabase client successfully reinitialized dynamically! ⚡");
  } else {
    localStorage.removeItem('grezto_supabase_url');
    localStorage.removeItem('grezto_supabase_anon_key');
    activeSupabaseClient = null;
  }
};

// Proxy handler to dynamically forward operations to the active client
const supabaseProxyHandler: ProxyHandler<any> = {
  get(target, prop, receiver) {
    if (prop === 'isConfigured') {
      return () => !!activeSupabaseClient;
    }
    if (prop === 'rawClient') {
      return activeSupabaseClient;
    }
    
    if (!activeSupabaseClient) {
      initSupabase();
    }
    
    if (!activeSupabaseClient) {
      console.warn(`[Supabase Proxy] Attempted to read prop "${String(prop)}" but client is unconfigured.`);
      // Return a dummy chainable function to prevent immediate client crash
      return (...args: any[]) => {
        return {
          from: () => ({
            select: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured yet.") }),
            insert: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured yet.") }),
            update: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured yet.") }),
            delete: () => Promise.resolve({ data: null, error: new Error("Supabase is not configured yet.") }),
          })
        };
      };
    }
    
    const value = Reflect.get(activeSupabaseClient, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activeSupabaseClient);
    }
    return value;
  }
};

export const supabase = new Proxy({}, supabaseProxyHandler) as any;

export const isSupabaseConfigured = () => {
  const { url, anonKey } = getSupabaseConfig();
  return !!url && !!anonKey;
};

export async function callSecureGateway(
  action: 'place_order' | 'update_rider_status' | 'upsert_user_profile',
  payload: any
): Promise<any> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Bhai, login karna zaroori hai gateway use karne ke liye! 🛑");
  }

  const idToken = await currentUser.getIdToken(false); // Using getIdToken(false) retrieves the locally cached token in 0ms and auto-renews only if expired. This is the industry-standard high-performance secure practice!
  const url = getApiUrl('/api/gateway');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ action, payload })
  });

  const resData = await response.json();
  if (!response.ok || !resData.success) {
    throw new Error(resData.error || "Gateway action failed.");
  }

  return resData.data;
}
