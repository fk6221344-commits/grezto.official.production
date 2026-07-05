import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';
import { getApiUrl } from '../utils/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
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
