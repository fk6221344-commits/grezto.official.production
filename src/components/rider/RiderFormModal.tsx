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
  vehicle: string;
  setVehicle: (vehicle: string) => void;
  status: string;
  setStatus: (status: string) => void;
  codBalanceInit: string;
  setCodBalanceInit: (val: string) => void;
  handleSaveRider: (e: React.FormEvent) => Promise<any>;
  handleDeleteRider: (id: string) => Promise<any>;
}

export default function RiderFormModal({
  showAddForm,
  setShowAddForm,
  editingRider,
  name,
  setName,
  phone,
  setPhone,
  vehicle,
  setVehicle,
  status,
  setStatus,
  codBalanceInit,
  setCodBalanceInit,
  handleSaveRider,
  handleDeleteRider,
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
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px] border-r border-slate-200 pr-2">+91</div>
                    <input
                      required
                      maxLength={10}
                      type="text"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPhone(val);
                      }}
                      className="w-full bg-slate-50 border border-slate-150 py-3.5 pl-11 pr-3 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-rose-500/20 disabled:opacity-75"
                    />
                  </div>
                </div>
              </div>



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
