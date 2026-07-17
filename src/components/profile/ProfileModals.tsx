import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogOut, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileLoginModal from './ProfileLoginModal';

interface ProfileModalsProps {
  // Login Modal
  showLoginModal: boolean;
  setShowLoginModal: (val: boolean) => void;
  authMode: 'signup' | 'login';
  setAuthMode: (mode: 'signup' | 'login') => void;
  loginName: string;
  setLoginName: (val: string) => void;
  loginPhone: string;
  setLoginPhone: (val: string) => void;
  otpCode: string;
  setOtpCode: (val: string) => void;
  authLoading: boolean;
  isOtpSent: boolean;
  setIsOtpSent: (val: boolean) => void;
  resendTimer: number;
  handleSendOtpInline: () => void;
  handleVerifyAndLogin: (e: React.FormEvent) => void;

  // About Modal
  showAboutModal: boolean;
  setShowAboutModal: (val: boolean) => void;

  // Sign Out Modal
  showSignOutConfirm: boolean;
  setShowSignOutConfirm: (val: boolean) => void;
  logout: () => void;

  // PIN Modal
  showPinModal: boolean;
  setShowPinModal: (val: boolean) => void;
  isSettingNewPin: boolean;
  pinInput: string;
  setPinInput: (val: string | ((prev: string) => string)) => void;
  userShop: any;
  handlePinSubmit: () => void;
}

export default function ProfileModals({
  showLoginModal,
  setShowLoginModal,
  authMode,
  setAuthMode,
  loginName,
  setLoginName,
  loginPhone,
  setLoginPhone,
  otpCode,
  setOtpCode,
  authLoading,
  isOtpSent,
  setIsOtpSent,
  resendTimer,
  handleSendOtpInline,
  handleVerifyAndLogin,

  showAboutModal,
  setShowAboutModal,

  showSignOutConfirm,
  setShowSignOutConfirm,
  logout,

  showPinModal,
  setShowPinModal,
  isSettingNewPin,
  pinInput,
  setPinInput,
  userShop,
  handlePinSubmit,
}: ProfileModalsProps) {
  // We no longer have authError, so we remove the useEffect handling its auto-dismiss

  return (
    <>
      {/* Login / Create Account Modal */}
      <ProfileLoginModal
        showLoginModal={showLoginModal}
        setShowLoginModal={setShowLoginModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginName={loginName}
        setLoginName={setLoginName}
        loginPhone={loginPhone}
        setLoginPhone={setLoginPhone}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        authLoading={authLoading}
        isOtpSent={isOtpSent}
        setIsOtpSent={setIsOtpSent}
        resendTimer={resendTimer}
        handleSendOtpInline={handleSendOtpInline}
        handleVerifyAndLogin={handleVerifyAndLogin}
      />

      {/* About Grezto Detail Info Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showAboutModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAboutModal(false)}
                className="absolute inset-0 bg-black backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 relative z-[9999] max-h-[85vh] overflow-y-auto text-display text-gray-800 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">About Grezto</h3>
                    <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-1">Delivery of Happiness & Pure Trust 🌿</p>
                  </div>
                  <button onClick={() => setShowAboutModal(false)} className="p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 border-0 cursor-pointer">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6 text-xs leading-relaxed font-semibold text-gray-650">
                  {/* Heartwarming Delivery Boy Message */}
                  <div className="bg-gradient-to-br from-rose-50 via-red-50/45 to-rose-50/20 rounded-2xl p-5 border border-rose-100/50 shadow-sm">
                    <h4 className="text-[11px] font-black text-rose-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      ❤️ RESPECT OUR HERO DELIVERY BOYS
                    </h4>
                    <p className="text-[11px] font-bold text-gray-950 leading-relaxed">
                      Our hard-working delivery boys ride through hot sunshine, heavy rains, and busy traffic to bring fresh food and happiness directly to your doorstep. They work super hard for their families.
                      <br /><br />
                      Please treat them with a warm smile and respect. 🙏 Offering them a simple glass of cool water 🥛 or saying a sweet "thank you" means the world to them! Let's work together to make Grezto a kind community.
                    </p>
                  </div>

                  <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100/30">
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-2">🌿 100% Pure & Trustworthy</h4>
                    <p className="text-[10.5px] font-bold text-emerald-700/80 leading-relaxed">
                      Grezto is Assam's premium delivery service for curated groceries, local household necessities, and fresh garden vegetables. We carefully pick every single item so your family always stays healthy!
                    </p>
                  </div>

                  <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/30">
                    <h4 className="text-[10px] font-black text-indigo-800 uppercase tracking-wider mb-2">⚡ Super Fast Delivery</h4>
                    <p className="text-[10.5px] font-bold text-indigo-700/80 leading-relaxed">
                      All your orders are packed with strict hygiene care and delivered securely right to your home in just 30 to 40 minutes. We value your time above everything!
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100 font-sans">
                       <p className="text-slate-900 font-black text-sm">100%</p>
                       <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 font-display font-black">Happy Deliveries</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100 font-sans">
                       <p className="text-slate-900 font-black text-sm">24/7</p>
                       <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 font-display font-black">Help Support</p>
                    </div>
                  </div>

                  <p className="text-[8.5px] text-center text-gray-400 uppercase tracking-widest font-black pt-4">Grezto Services India Pvt. Ltd. 🇮🇳</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Sign Out Confirmation Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSignOutConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSignOutConfirm(false)}
                className="absolute inset-0 bg-black backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 relative z-[9999] text-center shadow-2xl border border-red-100/50"
              >
                {/* Visual Top Handle for Bottom Sheet physics */}
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />

                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-50 to-rose-100/50 rounded-full flex items-center justify-center mb-4.5 text-red-600 shadow-inner ring-4 ring-red-50/40">
                  <LogOut size={26} className="stroke-[2.5]" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                  Confirm Sign Out?
                </h3>
                
                <p className="text-[11px] font-bold text-gray-500 leading-relaxed mt-3 max-w-xs mx-auto">
                  You will need to login again to access your profile details or check live orders. Are you sure you want to sign out?
                </p>

                <div className="flex flex-col gap-3 mt-7 w-full">
                  <motion.button 
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowSignOutConfirm(false)}
                    className="w-full bg-slate-950 active:bg-slate-900 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-xl shadow-slate-950/15 border-0"
                  >
                    Cancel / Back
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      logout();
                      setShowSignOutConfirm(false);
                      toast.success("Successfully Signed Out! See you soon. 👋");
                    }}
                    className="w-full bg-rose-50/80 active:bg-rose-100 hover:bg-rose-100/80 text-rose-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest border border-rose-100/50 transition-all cursor-pointer"
                  >
                    Yes, Sign Out
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Secure Merchant PIN Validation Modal Overlay */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPinModal(false);
                setPinInput('');
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%', scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 pb-10 relative z-[121] text-center shadow-2xl border border-rose-50"
            >
              <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-600 shadow-inner">
                <Shield size={22} className="stroke-[2.5]" />
              </div>

              <h3 className="text-lg font-black text-gray-900 tracking-tight uppercase">
                {isSettingNewPin ? "Setup Dashboard PIN 🔒" : "Verify Store PIN ⚔️"}
              </h3>
              
              <p className="text-[10px] text-gray-400 font-extrabold uppercase mt-1 tracking-widest leading-relaxed">
                {isSettingNewPin 
                  ? "Configure a secure 4-digit entry PIN for your merchant profile"
                  : `Enter PIN for ${userShop?.name}`
                }
              </p>

              {/* Dot Indicators */}
              <div className="flex justify-center gap-4 my-6">
                {[0, 1, 2, 3].map((idx) => (
                  <div 
                    key={idx}
                    className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
                      pinInput.length > idx 
                        ? 'bg-rose-600 border-rose-600 scale-110 shadow-sm shadow-rose-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                ))}
              </div>

              {/* Numerical keyboard UI grid */}
              <div className="grid grid-cols-3 gap-3.5 max-w-[280px] mx-auto mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <motion.button
                    key={num}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (pinInput.length < 4) {
                        setPinInput(prev => prev + num);
                      }
                    }}
                    className="w-14 h-14 bg-gray-50 active:bg-rose-50 hover:bg-gray-100 rounded-full text-slate-800 text-lg font-black flex items-center justify-center border-0 cursor-pointer shadow-xs transition-colors"
                  >
                    {num}
                  </motion.button>
                ))}
                
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setPinInput('')}
                  className="w-14 h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-450 text-[10px] font-black uppercase flex items-center justify-center border-0 cursor-pointer"
                >
                  Clear
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (pinInput.length < 4) {
                      setPinInput(prev => prev + '0');
                    }
                  }}
                  className="w-14 h-14 bg-gray-50 active:bg-rose-50 hover:bg-gray-100 rounded-full text-slate-800 text-lg font-black flex items-center justify-center border-0 cursor-pointer shadow-xs transition-colors"
                >
                  0
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                  className="w-14 h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 text-xs font-black flex items-center justify-center border-0 cursor-pointer"
                >
                  ⌫
                </motion.button>
              </div>

              {/* Submit trigger button */}
              <div className="flex space-x-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pinInput.length !== 4}
                  onClick={handlePinSubmit}
                  className="flex-grow bg-rose-600 disabled:opacity-40 hover:bg-rose-700 text-white py-3.5 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest border-0 shadow-lg shadow-rose-200 transition-all cursor-pointer select-none active:scale-95"
                >
                  Confirm Entry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </>
  );
}
