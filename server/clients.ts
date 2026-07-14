import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import WebSocket from "ws";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Create Supabase client for Server
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// Prioritize Service Role Key for secure server-side operations, fall back to Anon Key
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
if (supabaseKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
  supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
}
const isValidSupabaseUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

export const supabase = (isValidSupabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    transport: WebSocket as any
  }
}) : null;

// Securely initialize Firebase Admin SDK using the active project ID dynamically or a Service Account
if (!admin.apps.length) {
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (serviceAccountBase64) {
      // Decode the base64 service account JSON
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log(`[SERVER] Firebase Admin SDK successfully initialized with Service Account for project: ${serviceAccount.project_id}`);
    } else {
      let projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          projectId = config.projectId;
        }
      }

      if (projectId) {
        admin.initializeApp({
          projectId: projectId
        });
        console.log(`[SERVER] Firebase Admin SDK successfully initialized (Without Service Account) for project: ${projectId}`);
      } else {
        console.warn("[SERVER] No Firebase Project ID or Service Account found. Skipping Admin SDK initialization.");
      }
    }
  } catch (adminInitErr) {
    console.error("[SERVER] Failed to initialize Firebase Admin SDK:", adminInitErr);
  }
}

export { admin };

let aiClient: any = null;

export function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.warn("Could not load firebase-applet-config.json");
}
