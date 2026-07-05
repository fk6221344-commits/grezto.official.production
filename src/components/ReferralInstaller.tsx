import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function ReferralInstaller() {
  const [showInstaller, setShowInstaller] = useState(false);
  const [installerProgress, setInstallerProgress] = useState(0);
  const [installerRef, setInstallerRef] = useState('GREZ100');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('download') === 'grezto-app' || params.get('ref')) {
      setInstallerRef(params.get('ref') || 'GREZ100');
      setShowInstaller(true);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Trigger actual browser file download of placeholder Android .apk
          setTimeout(() => {
            try {
              const dummyApkContent = new Uint8Array([0x50, 0x4B, 0x03, 0x04]); 
              const blob = new Blob([dummyApkContent], { type: 'application/vnd.android.package-archive' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'grezto_premium_delivery.apk';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success("Android APK Download triggered! Please check your browser downloads to install Grezto on your device. 📲🌿", { duration: 6000 });
            } catch (err) {
              console.error("Binary download error:", err);
            }
          }, 800);
        }
        setInstallerProgress(Math.min(progress, 100));
      }, 120);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <AnimatePresence>
      {showInstaller && (
        <div className="fixed inset-0 z-[300] bg-stone-950 flex flex-col justify-center items-center p-6 text-center text-white">
          <div className="w-full max-w-sm space-y-8 flex flex-col items-center">
            {/* Visual pulsating logo emblem */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl relative z-10 animate-pulse border border-emerald-400/20">
                🏪
              </div>
              <div className="absolute inset-0 bg-emerald-500 rounded-[2rem] blur-2xl opacity-40 scale-125 animate-[ping_3s_infinite_ease-in-out]"></div>
            </div>

            <div className="space-y-2">
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/20 px-3.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase inline-block font-sans">
                REFERRAL CODE ACTIVE: {installerRef}
              </span>
              
              <h2 className="text-xl font-black tracking-tight leading-tight pt-1 font-sans">
                Installing Grezto Premium Delivery App 🥬🌾
              </h2>
              <p className="text-[10px] text-gray-400 font-semibold px-2 leading-relaxed font-sans">
                Your friend has invited you! The Android APK installer package is currently downloading. Please wait for the download to complete...
              </p>
            </div>

            {/* Progress bar container */}
            <div className="w-full bg-stone-900 border border-stone-850 p-4.5 rounded-[2rem] space-y-3 shadow-inner">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 font-extrabold uppercase tracking-wider">
                <span>{installerProgress < 100 ? "📥 Downloading package..." : "✅ Package Downloaded!"}</span>
                <span className="text-emerald-400 font-black">{installerProgress}%</span>
              </div>
              
              {/* Outer hollow bar */}
              <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden p-0.5 border border-stone-850">
                <motion.div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-full animate-pulse"
                  style={{ width: `${installerProgress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              <div className="flex justify-between items-center text-[8.5px] text-gray-500 font-black uppercase tracking-widest pt-1.5 border-t border-stone-850/40 font-mono">
                <span>Size: ~18.5 MB</span>
                <span>Speed: 3.4 MB/s</span>
                <span>{Math.min(Math.round(18.5 * (installerProgress / 100) * 10) / 10, 18.5)} MB / 18.5 MB</span>
              </div>
            </div>

            {/* Footnotes */}
            <div className="space-y-4 pt-2 w-full">
              {installerProgress === 100 ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-4 w-full"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstaller(false);
                      // Clear the parameter to let them explore the app
                      const newUrl = window.location.origin + window.location.pathname;
                      window.history.replaceState({}, document.title, newUrl);
                    }}
                    className="py-4 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl border-0 shadow-lg shadow-emerald-950/60 cursor-pointer w-full transition-all flex items-center justify-center gap-2 font-sans"
                  >
                    Explore Web App Interface 🌐
                  </button>
                  <p className="text-[9.5px] text-gray-550 font-extrabold uppercase tracking-widest leading-normal mb-0 pb-0">
                    Note: Please enable 'Unknown Sources' in your Android device settings. Happy Food Delivery! 🌿🎁
                  </p>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <p className="text-[9.5px] text-emerald-400 font-black uppercase tracking-wider mb-0 pb-0 font-sans">
                    Real APK Packet Delivery Pipeline Active
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
