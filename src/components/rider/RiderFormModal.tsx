import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  codBalance?: number;
  codBalanceInit?: number;
  totalCollectedCash?: number;
  lastSettledDate?: string;
  rating?: string;
  unregistered?: boolean;
}

interface RiderFormModalProps {
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
  editingRider: Rider | null;
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  isOtpVerified: boolean;
  setIsOtpVerified: (verified: boolean) => void;
  isSendingOtp: boolean;
  isOtpSent: boolean;
  setIsOtpSent: (sent: boolean) => void;
  otpInput: string;
  setOtpInput: (otp: string) => void;
  vehicle: string;
  setVehicle: (vehicle: string) => void;
  status: string;
  setStatus: (status: string) => void;
  codBalanceInit: string;
  setCodBalanceInit: (val: string) => void;
  handleSendOtp: () => Promise<any>;
  handleVerifyOtp: () => Promise<any>;
  isVerifyingOtp: boolean;
  handleSaveRider: (e: React.FormEvent) => Promise<any>;
  handleDeleteRider: (id: string) => Promise<any>;
  riderOtpError?: string | null;
  setRiderOtpError?: (val: string | null) => void;
}

export default function RiderFormModal({
  showAddForm,
  setShowAddForm,
  editingRider,
  name,
  setName,
  phone,
  setPhone,
  isOtpVerified,
  setIsOtpVerified,
  isSendingOtp,
  isOtpSent,
  setIsOtpSent,
  otpInput,
  setOtpInput,
  vehicle,
  setVehicle,
  status,
  setStatus,
  codBalanceInit,
  setCodBalanceInit,
  handleSendOtp,
  handleVerifyOtp,
  isVerifyingOtp,
  handleSaveRider,
  handleDeleteRider,
  riderOtpError,
  setRiderOtpError,
}: RiderFormModalProps) {
  return (
    <AnimatePresence>
      {showAddForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white w-full max-w-md rounded-[2.2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col text-left font-sans text-slate-800"
          >
            <div className="p-5.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {editingRider ? 'Modify Rider Info' : 'Add New Delivery Partner'}
                </h3>
                <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                  Fleets logistics registry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl transition cursor-pointer border-0"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRider} className="p-5.5 space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">
                  Rider Full Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rahul Borah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    maxLength={10}
                    type="text"
                    disabled={isOtpVerified || isSendingOtp}
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPhone(val);
                      if (isOtpSent) {
                        setIsOtpSent(false);
                        setIsOtpVerified(false);
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 disabled:opacity-75"
                  />
                  {!editingRider && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={phone.length !== 10 || isSendingOtp || isOtpVerified}
                      className={`px-4.5 rounded-xl text-[9.5px] font-bold transition-all border-0 cursor-pointer flex items-center justify-center min-w-[76px] ${
                        isOtpVerified
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : isSendingOtp
                          ? 'bg-slate-100 text-slate-400'
                          : isOtpSent
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-rose-900 text-white hover:bg-rose-950 shadow-sm shadow-rose-900/15'
                      }`}
                    >
                      {isOtpVerified ? 'Verified ✓' : isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend' : 'Verify'}
                    </button>
                  )}
                </div>
              </div>

               {/* Sub OTP Box */}
              {isOtpSent && !isOtpVerified && !editingRider && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[8px] font-black uppercase text-rose-600 tracking-widest ml-1">
                    Enter 6-Digit Verification Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      maxLength={6}
                      type="text"
                      placeholder="Enter OTP code"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1 bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10.5px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 text-center tracking-widest font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpInput.length !== 6 || isVerifyingOtp}
                      className="bg-slate-950 text-white hover:bg-black px-4.5 py-2.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider border-0 cursor-pointer transition active:scale-95 min-w-[85px] flex items-center justify-center"
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}

              {riderOtpError && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-[10.5px] text-amber-950 font-semibold space-y-2 leading-relaxed animate-fadeIn mt-3">
                   <p className="font-extrabold text-[10.5px] text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                     ⚠️ Real SMS Dispatch Failed
                   </p>
                   <p className="whitespace-pre-line text-[10px] text-amber-900">{riderOtpError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">
                    Vehicle
                  </label>
                  <select
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[10.5px] font-black outline-none border-0"
                  >
                    <option value="Electric Scooter">🛵 Electric Scooter</option>
                    <option value="Apache/Pulsar">🏍️ Apache/Pulsar Bike</option>
                    <option value="Bicycle">🚲 Bicycle</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[10.5px] font-black outline-none border-0"
                  >
                    <option value="Online">🟢 Online</option>
                    <option value="Offline">🔴 Offline</option>
                  </select>
                </div>
              </div>

              {!editingRider && (
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-450 tracking-widest ml-1">
                    Starting Unsettled COD Balance (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 0"
                    value={codBalanceInit}
                    onChange={(e) => setCodBalanceInit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20"
                  />
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2.5">
                <button
                  type="submit"
                  className="w-full bg-rose-900 border-0 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 hover:bg-rose-950 transition active:scale-95 cursor-pointer"
                >
                  {editingRider ? 'Save Changes' : 'Confirm Registration'}
                </button>

                {editingRider && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRider(editingRider.id)}
                    className="w-full bg-slate-100 hover:bg-rose-50 text-rose-600 border-0 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition cursor-pointer"
                  >
                    ⚠️ Terminate Agreement
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
