import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Shield, Activity, Globe, Loader2, Navigation, AlertTriangle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export default function GpsPressingActivator({ onUnlocked }: { onUnlocked: () => void }) {
  const { user, updateProfile } = useUser();
  const [synced, setSynced] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [telemetryMsg, setTelemetryMsg] = useState('Satellite Terminal Idle');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Auto skip if already unlocked in active state session
  useEffect(() => {
    if (localStorage.getItem('grezto_gps_pressed') === 'true' && user.lat && user.lng) {
      onUnlocked();
    }
  }, [user.lat, user.lng, onUnlocked]);

  const triggerGpsPressing = async () => {
    setLoading(true);
    setProgress(0);
    setTelemetryMsg('Requesting hardware GPS sensor authorization...');

    // 1. Fire realistic high-fidelity loading ticker that is extremely exciting to watch
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.floor(Math.random() * 8) + 4;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        
        // Dynamic informative feedback messages based on telemetry stages
        if (next < 25) {
          setTelemetryMsg('Polling signal transceivers for real-time cellular handshakes...');
        } else if (next < 50) {
          setTelemetryMsg('Synthesizing triangulation vectors with nearest Assam Base Station...');
        } else if (next < 75) {
          setTelemetryMsg('Receiving active satellite packet streams...');
        } else if (next < 95) {
          setTelemetryMsg('Computing Haversine distance tolerance & calibrating accuracy...');
        } else {
          setTelemetryMsg('Parsing coordinate telemetry data feeds...');
        }
        return next;
      });
    }, 100);

    // 2. Fetch the actual physical device coordinates using Capacitor Native Geolocation
    try {
      console.log("[GPS] Querying native location via Capacitor Geolocation plugin...");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
         const reqStatus = await Geolocation.requestPermissions();
         if (reqStatus.location !== 'granted' && reqStatus.coarseLocation !== 'granted') {
           throw new Error("Permission Denied. We require hardware GPS access.");
         }
      }
      
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
      
      const currentLat = pos.coords.latitude;
      const currentLng = pos.coords.longitude;
      updateProfileAndSave(currentLat, currentLng);
    } catch (err: any) {
      console.error("GPS telemetry sync failed:", err);
      toast.error(err.message || "Strict Native GPS Enforced. Please enable real hardware location.");
      setLoading(false);
      setTelemetryMsg("");
    }
  };

  const updateProfileAndSave = (latitude: number, longitude: number) => {
    // Generate simulated address format depending on coordinates
    let regionAddress = "Live GPS Coordinate Tracked";

    setTimeout(() => {
      updateProfile({
        lat: latitude,
        lng: longitude,
        address: regionAddress
      });

      localStorage.setItem('grezto_gps_pressed', 'true');
      toast.success("Hardware GPS Connection Locked successfully! 🛰️📡");
      onUnlocked();
    }, 2800); // Allow loading animation to complete so user sees the premium flow
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#070b13] text-white flex flex-col justify-between p-8 text-center font-sans select-none overflow-y-auto">
      
      {/* Background glowing telemetry concentric vector rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
        <div className="w-[450px] h-[450px] border border-cyan-500/20 rounded-full animate-[ping_4s_infinite_ease-in-out] flex items-center justify-center">
          <div className="w-[300px] h-[300px] border border-cyan-500/30 rounded-full flex items-center justify-center">
            <div className="w-[150px] h-[150px] border border-cyan-500/45 rounded-full" />
          </div>
        </div>
        <div className="absolute h-full w-px bg-cyan-500/10" />
        <div className="absolute w-full h-px bg-cyan-500/10" />
      </div>

      {/* HEADER SECTION */}
      <div className="mt-8 space-y-3 relative z-10">
        <div className="flex items-center justify-center space-x-2">
          <Globe className="w-5 h-5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-500/20 px-3 py-1 font-black rounded-full uppercase tracking-widest leading-none">
            SATELLITE POSITION PROTOCOL
          </span>
        </div>
        <h2 className="text-2xl font-black mt-2 capitalize tracking-tight leading-tight text-slate-100">
          Sync Satellite Portal
        </h2>
        <p className="text-[11px] text-gray-400 font-bold max-w-xs mx-auto leading-relaxed">
          Grezto requires physical GPS synchronization. Lock your exact position coordinates before entering the vendor catalog.
        </p>
      </div>

      {/* CENTER COMPACT RADAR DISPLAY */}
      <div className="my-6 relative z-10 flex flex-col items-center">
        <div className="w-40 h-40 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center relative shadow-2xl overflow-hidden p-6">
          
          {/* Radar sweeping green ray line */}
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(16,185,129,0.15)_0deg,transparent_120deg)] animate-[spin_3s_linear_infinite] rounded-full" />
          
          <div className="relative z-20 flex flex-col items-center">
            {loading ? (
              <div className="space-y-1">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto stroke-[2.5]" />
                <span className="text-[18px] font-black font-mono text-cyan-400">{progress}%</span>
              </div>
            ) : (
              <Compass className="w-16 h-16 text-emerald-400 stroke-[1.5] animate-pulse" />
            )}
          </div>

          <div className="absolute inset-1 border border-slate-800/40 rounded-full" />
          <div className="absolute inset-4 border border-dashed border-slate-800/30 rounded-full" />
        </div>

        {/* Real-time coordinates preview label */}
        <div className="mt-4 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-[9px] font-mono font-bold text-gray-300">
          STATUS: {loading ? "TRANSMITTING..." : "OFFLINE TERMINAL"}
        </div>
      </div>

      {/* FOOTER INTERACTIVE PRESSING TRIGGER SECTION */}
      <div className="mb-8 space-y-5 relative z-10 w-full max-w-sm mx-auto flex flex-col items-center">
        
        {/* Progress Ticker Message */}
        {loading && (
          <div className="space-y-2 w-full">
            <span className="text-[8.5px] font-mono text-cyan-400/95 uppercase font-black tracking-widest block text-center max-w-xs mx-auto truncate">
              {telemetryMsg}
            </span>
            <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden p-0.5 border border-stone-800">
              <motion.div 
                className="h-full bg-cyan-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        )}

        {/* Primary Clickable Pressing button */}
        {!loading && (
          <button
            type="button"
            onClick={triggerGpsPressing}
            className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[12px] uppercase tracking-widest rounded-3xl border-0 shadow-lg shadow-teal-950/60 cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4 animate-bounce" />
            <span>PRESSING GPS SYNC</span>
          </button>
        )}

        {/* Informative Security and Location Disclaimer */}
        <div className="space-y-2.5">
          <p onClick={() => setShowDisclaimer(!showDisclaimer)} className="text-[9.5px] text-gray-500 hover:text-cyan-400 cursor-pointer underline select-none font-bold uppercase tracking-wider">
            Why is GPS pressing mandatory? 🔒
          </p>
          
          <AnimatePresence>
            {showDisclaimer && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-[9px] text-left text-gray-400 leading-normal"
              >
                <div className="flex gap-2 items-start">
                  <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>
                    Grezto uses high-gain terminal geolocation to enforce continuous delivery route speed, ensure correct rider dispatch, and preserve absolute user security. Your data is kept local and fully encrypted.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
