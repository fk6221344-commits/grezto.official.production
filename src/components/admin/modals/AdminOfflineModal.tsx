import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, ChevronDown } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import toast from 'react-hot-toast';

interface AdminOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminOfflineModal({ isOpen, onClose }: AdminOfflineModalProps) {
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM'|'PM'>('AM');

  const submitOffline = async () => {
    try {
      const now = new Date();
      let hours24 = parseInt(hour, 10);
      if (ampm === 'PM' && hours24 < 12) hours24 += 12;
      if (ampm === 'AM' && hours24 === 12) hours24 = 0;

      let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours24, parseInt(minute, 10));
      
      // If the selected time has already passed today, assume it's for tomorrow
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      if (supabase) {
        await supabase.from('system_config').upsert({
          id: 'config',
          isSystemOnline: false,
          systemReopenTime: targetDate.toISOString()
        });
      }

      toast.success('System is now Offline');
      onClose();
    } catch (e) {
      toast.error('Failed to set offline status');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white w-full sm:w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] pb-8 pt-4 relative z-10 font-sans"
          >
            <div className="px-6 flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Go Offline</h2>
                <p className="text-xs font-bold tracking-wider text-gray-500 uppercase mt-0.5">Set Reopen Time</p>
              </div>
              <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-95 transition-transform border-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 space-y-4">
              <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100">
                <div className="flex items-center space-x-3 mb-4">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-sm tracking-tight text-indigo-700">Select when system will reopen</span>
                </div>
                
                <div className="flex items-center justify-between space-x-2">
                  {/* Custom Time Selectors */}
                  <div className="flex items-center space-x-2">
                    <div className="relative flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-wider">Hour</span>
                      <div className="relative">
                        <select 
                          value={hour} 
                          onChange={(e) => setHour(e.target.value)}
                          className="appearance-none bg-white border-2 border-rose-100 text-2xl font-black text-center w-16 h-16 rounded-2xl focus:border-rose-400 focus:ring-0 outline-none text-gray-800 cursor-pointer shadow-sm"
                        >
                          {Array.from({length: 12}, (_, i) => i + 1).map(h => {
                            const val = h.toString().padStart(2, '0');
                            return <option key={val} value={val}>{val}</option>;
                          })}
                        </select>
                        <ChevronDown className="w-3 h-3 text-rose-300 absolute bottom-1.5 right-1.5 pointer-events-none" />
                      </div>
                    </div>

                    <span className="text-2xl font-black text-rose-300 pt-4">:</span>

                    <div className="relative flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-wider">Minute</span>
                      <div className="relative">
                        <select 
                          value={minute} 
                          onChange={(e) => setMinute(e.target.value)}
                          className="appearance-none bg-white border-2 border-rose-100 text-2xl font-black text-center w-16 h-16 rounded-2xl focus:border-rose-400 focus:ring-0 outline-none text-gray-800 cursor-pointer shadow-sm"
                        >
                          {Array.from({length: 60}, (_, i) => i).map(m => {
                            const val = m.toString().padStart(2, '0');
                            return <option key={val} value={val}>{val}</option>;
                          })}
                        </select>
                        <ChevronDown className="w-3 h-3 text-rose-300 absolute bottom-1.5 right-1.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Animated AM/PM Toggle */}
                  <div className="relative flex flex-col items-center">
                     <span className="text-[10px] font-black uppercase text-transparent mb-1 select-none pointer-events-none">AMPM</span>
                    <div 
                      className="relative w-20 h-16 bg-gray-100 rounded-2xl p-1.5 flex flex-col cursor-pointer select-none shadow-inner border border-gray-200" 
                      onClick={() => setAmpm(a => a === 'AM' ? 'PM' : 'AM')}
                    >
                      <motion.div 
                        layout
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        className={`absolute left-1.5 right-1.5 h-[calc(50%-6px)] rounded-xl shadow-md ${ampm === 'AM' ? 'top-1.5 bg-emerald-700' : 'top-[calc(50%+1px)] bg-rose-700'}`}
                      />
                      <div className={`flex-1 flex items-center justify-center z-10 text-xs font-black transition-colors ${ampm === 'AM' ? 'text-white' : 'text-gray-400'}`}>
                        AM
                      </div>
                      <div className={`flex-1 flex items-center justify-center z-10 text-xs font-black transition-colors ${ampm === 'PM' ? 'text-white' : 'text-gray-400'}`}>
                        PM
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              <div className="flex justify-center mt-2">
                <button 
                  onClick={submitOffline}
                  className="w-3/4 bg-slate-800 active:bg-slate-900 text-white font-black py-3 rounded-xl text-sm tracking-wider uppercase border-b-4 border-slate-950 transition-transform active:translate-y-1 active:border-b-0 shadow-lg cursor-pointer"
                >
                  Confirm Offline
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
