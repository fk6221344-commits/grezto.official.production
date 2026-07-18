import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileLoginModalProps {
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
}

export default function ProfileLoginModal({
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
}: ProfileLoginModalProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {showLoginModal && (
        <div className={`fixed inset-0 z-[250] flex ${isFocused ? 'items-start pt-6 sm:items-center sm:pt-4' : 'items-center'} justify-center p-4 transition-all duration-300`}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowLoginModal(false);
              setIsOtpSent(false);
              setIsFocused(false);
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 relative z-10 shadow-2xl border border-stone-100 max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <button 
              onClick={() => {
                setShowLoginModal(false);
                setIsOtpSent(false);
                setIsFocused(false);
              }} 
              className="absolute top-4 right-4 p-2.5 bg-stone-50 hover:bg-stone-100/80 active:scale-95 text-stone-400 hover:text-stone-600 rounded-full border border-stone-150/40 transition-all cursor-pointer z-20"
              title="Close"
            >
              <X size={14} className="stroke-[2.5]" />
            </button>

            <div className="flex flex-col items-center justify-center text-center mt-2 mb-5">
              <div className="relative w-14 h-14 mb-2.5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0f9f6e] via-amber-400 via-orange-500 to-rose-600 animate-spin opacity-85" style={{ animationDuration: '4s' }} />
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0f9f6e] to-rose-600 blur-md opacity-35 animate-pulse" />
                <div className="absolute inset-[3px] bg-white rounded-full flex items-center justify-center z-10 shadow-inner">
                  <span className="text-lg">🌿</span>
                </div>
              </div>

              <h3 className="text-sm font-black text-stone-900 tracking-wider uppercase font-sans">
                {authMode === 'signup' ? 'Create Account' : 'Login'}
              </h3>
              <p className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest mt-1">
                {authMode === 'signup' ? 'Get fresh ingredients on-demand' : 'Access your existing dashboard'}
              </p>
            </div>

            {/* Secure Mode Switch Tabs inside Modal */}
            <div className="grid grid-cols-2 bg-[#f4f7f4] p-1 rounded-xl mb-5 border border-[#ebf0eb]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setLoginName('');
                  setLoginPhone('');
                  setOtpCode('');
                  setIsOtpSent(false);
                  setIsFocused(false);
                }}
                className={`py-2 text-center text-[9px] rounded-lg font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 ${
                  authMode === 'signup' 
                    ? 'bg-white text-emerald-800 shadow-xs border border-[#e6ebe6]' 
                    : 'text-stone-400 hover:text-stone-600 bg-transparent'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setLoginName('Grezto Member');
                  setLoginPhone('');
                  setOtpCode('');
                  setIsOtpSent(false);
                  setIsFocused(false);
                }}
                className={`py-2 text-center text-[9px] rounded-lg font-extrabold uppercase tracking-widest transition-all cursor-pointer border-0 ${
                  authMode === 'login' 
                    ? 'bg-white text-emerald-800 shadow-xs border border-[#e6ebe6]' 
                    : 'text-stone-400 hover:text-stone-600 bg-transparent'
                }`}
              >
                Login
              </button>
            </div>

            <form onSubmit={handleVerifyAndLogin} className="space-y-4">
              {authMode === 'signup' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                     <label className="text-[8.5px] font-black text-stone-400 uppercase tracking-widest ml-1">Your Full Name</label>
                     <input 
                       required
                       type="text"
                       value={loginName}
                       onChange={e => setLoginName(e.target.value)}
                       onFocus={handleFocus}
                       onBlur={handleBlur}
                       className="w-full bg-[#fcfdfc] border border-[#e2e8e2] px-4 py-3 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold text-stone-800 text-xs placeholder:text-stone-300 transition-all font-sans"
                       placeholder="Enter your name"
                     />
                  </div>

                  <div className="space-y-1">
                     <label className="text-[8.5px] font-black text-stone-400 uppercase tracking-widest ml-1">Phone Number</label>
                     <div className="flex gap-2">
                        <div className="relative flex-1">
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs border-r border-[#e2e8e2] pr-2.5">+91</div>
                           <input 
                             required
                             type="tel"
                             maxLength={10}
                             pattern="[0-9]{10}"
                             value={loginPhone}
                             onChange={e => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                             onFocus={handleFocus}
                             onBlur={handleBlur}
                             className="w-full bg-[#fcfdfc] border border-[#e2e8e2] py-3 pl-14 pr-4 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-black text-stone-800 font-mono tracking-wider text-xs placeholder:text-stone-300 transition-all"
                             placeholder="Phone code"
                           />
                        </div>
                        <button 
                          id="sign-in-button-profile"
                          type="button"
                          onClick={handleSendOtpInline}
                          disabled={authLoading || loginPhone.length !== 10 || !loginName.trim() || resendTimer > 0}
                          className={`active:scale-95 text-white px-3.5 rounded-xl font-black text-[8px] uppercase tracking-wider transition-all shadow-xs inline-flex items-center justify-center min-w-[90px] ${
                            resendTimer > 0
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400 shadow-md shadow-emerald-600/30"
                              : "bg-stone-900 border border-stone-800 hover:bg-stone-850 cursor-pointer disabled:opacity-40"
                          }`}
                        >
                          {authLoading ? '...' : (resendTimer > 0 ? `Resend in ${resendTimer}s` : (isOtpSent ? 'Resend' : 'Send OTP'))}
                        </button>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                     <label className="text-[8.5px] font-black text-stone-400 uppercase tracking-widest ml-1">Phone Number</label>
                     <div className="flex gap-2">
                        <div className="relative flex-1">
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs border-r border-[#e2e8e2] pr-2.5">+91</div>
                           <input 
                             required
                             type="tel"
                             maxLength={10}
                             pattern="[0-9]{10}"
                             value={loginPhone}
                             onChange={e => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                             onFocus={handleFocus}
                             onBlur={handleBlur}
                             className="w-full bg-[#fcfdfc] border border-[#e2e8e2] py-3 pl-14 pr-4 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-black text-stone-800 font-mono tracking-wider text-xs placeholder:text-stone-300 transition-all"
                             placeholder="Phone code"
                           />
                        </div>
                        <button 
                          id="sign-in-button-profile"
                          type="button"
                          onClick={handleSendOtpInline}
                          disabled={authLoading || loginPhone.length !== 10 || resendTimer > 0}
                          className={`active:scale-95 text-white px-3.5 rounded-xl font-black text-[8px] uppercase tracking-wider transition-all shadow-xs inline-flex items-center justify-center min-w-[90px] ${
                            resendTimer > 0
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400 shadow-md shadow-emerald-600/30"
                              : "bg-stone-900 border border-stone-800 hover:bg-stone-850 cursor-pointer disabled:opacity-40"
                          }`}
                        >
                          {authLoading ? '...' : (resendTimer > 0 ? `Resend in ${resendTimer}s` : (isOtpSent ? 'Resend' : 'Send OTP'))}
                        </button>
                     </div>
                  </div>
                </div>
              )}

              {/* Removed recaptcha container */}

              {/* Password/OTP Field */}
              <div className="space-y-1 pt-1">
                 <label className="text-[8.5px] font-black text-stone-400 uppercase tracking-widest ml-1">Verification OTP</label>
                 <input 
                   required
                   type="text"
                   maxLength={6}
                   pattern="[0-9]{6}"
                   value={otpCode}
                   onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   onFocus={handleFocus}
                   onBlur={handleBlur}
                   className="w-full bg-[#f4faf5] border border-emerald-100 py-3 rounded-xl text-center font-black text-base text-emerald-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-mono tracking-[0.25em] transition-all placeholder:text-emerald-300/60"
                   placeholder="••••••"
                 />
              </div>

              {isOtpSent && (
                <div className="bg-emerald-50/90 border border-emerald-100/80 rounded-2xl p-3.5 text-left animate-fadeIn flex flex-col gap-1">
                   <div className="text-[10px] text-emerald-800 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                     🌿 Secure verification code dynamic status: Active!
                   </div>
                   <div className="text-[9px] text-emerald-600 font-bold leading-relaxed">
                     Kripya check karein aur dynamic verification code enter karke safely continue karein.
                   </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white py-4 rounded-xl font-bold text-[13px] tracking-wide shadow-lg shadow-stone-900/20 active:scale-[0.98] transition-all cursor-pointer mt-4 flex items-center justify-center gap-2 border border-stone-800 disabled:opacity-50"
              >
                {authLoading ? 'Verifying...' : (authMode === 'signup' ? 'Complete Create Account' : 'Complete Login')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
