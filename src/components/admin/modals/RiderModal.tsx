import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bike } from 'lucide-react';

interface RiderModalProps {
  showRiderModal: boolean;
  setShowRiderModal: (val: boolean) => void;
  editingRider: any | null;
  setEditingRider: (val: any | null) => void;
  newRider: any;
  setNewRider: React.Dispatch<React.SetStateAction<any>>;
  handleSaveRider: (e: React.FormEvent) => Promise<any> | any;
}

export default function RiderModal({
  showRiderModal,
  setShowRiderModal,
  editingRider,
  setEditingRider,
  newRider,
  setNewRider,
  handleSaveRider
}: RiderModalProps) {
  return (
    <AnimatePresence>
      {showRiderModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0"
        >
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto no-scrollbar relative shadow-2xl font-sans"
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                    {editingRider ? 'Update Rider Profile' : 'Register New Rider'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold">Manage fleet credentials & status</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowRiderModal(false); setEditingRider(null); }} 
                className="p-2.5 bg-gray-100 rounded-2xl text-gray-400 border-0 cursor-pointer animate-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRider} className="space-y-5 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Rider Name</label>
                  <input 
                    required
                    value={newRider.name || ''}
                    onChange={e => setNewRider({...newRider, name: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input 
                    required
                    maxLength={10}
                    value={newRider.phone || ''}
                    onChange={e => setNewRider({...newRider, phone: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm"
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Vehicle Type</label>
                  <select 
                    value={newRider.vehicle || 'Electric Scooter'}
                    onChange={e => setNewRider({...newRider, vehicle: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm appearance-none"
                  >
                    <option value="Electric Scooter">Electric Scooter</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Bicycle">Bicycle</option>
                    <option value="Car">Car</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Status</label>
                  <select 
                    value={newRider.status || 'Online'}
                    onChange={e => setNewRider({...newRider, status: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm appearance-none"
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Busy">Busy</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>COD Balance (₹)</span>
                  <span className="text-rose-500 font-extrabold text-[8px]">Max Limit: ₹1500</span>
                </label>
                <input 
                  type="number"
                  value={typeof newRider.codBalance === 'number' ? newRider.codBalance : ''}
                  onChange={e => setNewRider({...newRider, codBalance: Number(e.target.value)})}
                  className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-sm"
                  placeholder="Current cash on hand"
                />
              </div>

              <button type="submit" className="w-full bg-[#5a6cfc] hover:bg-[#4856cc] py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] cursor-pointer border-0">
                {editingRider ? 'Apply Changes' : 'Confirm Registration'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
