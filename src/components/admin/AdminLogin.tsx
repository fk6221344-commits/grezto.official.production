import React from 'react';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface AdminLoginProps {
  pin: string;
  setPin: React.Dispatch<React.SetStateAction<string>> | ((pin: string | ((p: string) => string)) => void);
  handleLogin: () => void;
  onClose: () => void;
}

export default function AdminLogin({
  pin,
  setPin,
  handleLogin,
  onClose
}: AdminLoginProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col items-center justify-center px-8 font-sans">
      {/* Animated premium glowing background aura */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-red-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-yellow-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm text-center relative z-10"
      >
        <div className="w-24 h-24 bg-gradient-to-tr from-red-600 via-yellow-500 to-emerald-500 rounded-[2.5rem] p-1 flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <div className="w-full h-full bg-stone-950 rounded-[2.2rem] flex items-center justify-center text-yellow-400">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight uppercase italic border-none bg-transparent">
          {t("admin_login")}
        </h2>
        <p className="text-yellow-500 font-extrabold mb-4 text-[9px] uppercase tracking-[0.25em]">
          {t("enter_pin")}
        </p>

        <div className="flex justify-center space-x-3 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-18 rounded-2xl border-2 transition-all flex items-center justify-center text-xl font-black ${
                pin.length > i
                  ? "border-yellow-400 bg-yellow-450/10 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                  : "border-stone-800 bg-stone-950 text-stone-500"
              }`}
            >
              {pin[i] ? "•" : ""}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((num) => (
            <motion.button
              key={num}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (num === "C") setPin("");
                else if (num === "OK") handleLogin();
                else if (pin.length < 4) setPin((p) => p + num);
              }}
              className={`h-15 rounded-2xl flex items-center justify-center text-base font-black transition-all cursor-pointer ${
                num === "OK"
                  ? "bg-gradient-to-r from-red-650 via-yellow-500 to-emerald-500 text-white shadow-xl shadow-red-950/20 active:scale-95 border-0 hover:brightness-110"
                  : num === "C"
                    ? "bg-stone-900 border border-stone-800 text-red-500 font-extrabold"
                    : "bg-stone-950 text-white hover:bg-stone-900 border border-stone-800/80"
              }`}
            >
              {num}
            </motion.button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-10 text-stone-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-red-500 transition-colors border-0 bg-transparent cursor-pointer outline-none"
        >
          Exit Admin Panel
        </button>
      </motion.div>
    </div>
  );
}
