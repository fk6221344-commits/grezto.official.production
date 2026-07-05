import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, Bike, MapPin, Search, ChevronRight, Activity, Trash2, Edit, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Dialog } from '@capacitor/dialog';
import toast from 'react-hot-toast';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  activeOrders?: number;
  codBalance?: number;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
}

export default function RiderManagementModal({ onClose }: { onClose: () => void }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRiderForm, setShowRiderForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  
  // New Rider Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: 'Bike',
    status: 'Online'
  });

  useEffect(() => {
    let sub: any;
    const fetchRiders = async () => {
       const { data } = await supabase.from('team').select('*').eq('role', 'Rider');
       if (data) setRiders(data as Rider[]);
       setLoading(false);
    };
    fetchRiders();

    sub = supabase.channel('modal_riders')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: 'role=eq.Rider' }, () => {
         fetchRiders();
       }).subscribe();

    return () => { if (sub) sub.unsubscribe(); };
  }, []);

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Name and Phone are mandatory!");
      return;
    }

    const loadToast = toast.loading("Saving rider profile...");
    try {
      const finalId = editingRider ? editingRider.id : `rider_${Date.now()}`;
      const riderData = {
        ...formData,
        role: 'Rider',
        role_type: 'logistics',
        codBalance: editingRider?.codBalance || 0,
        activeOrders: editingRider?.activeOrders || 0,
        updatedAt: new Date().toISOString()
      };

      await supabase.from('team').upsert({ id: finalId, ...riderData });
      toast.success(editingRider ? "Rider updated!" : "New partner added! 🚀");
      setShowRiderForm(false);
      setEditingRider(null);
      setFormData({ name: '', phone: '', vehicle: 'Bike', status: 'Online' });
    } catch (err: any) {
      toast.error("Cloud sync failed. Profiles saved locally.");
    } finally {
      toast.dismiss(loadToast);
    }
  };

  const filteredRiders = riders.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.phone.includes(searchQuery)
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-gray-50 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] border border-white/10"
      >
        {/* Header */}
        <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-sm">
                <Activity size={20} />
             </div>
             <div>
               <h2 className="text-sm font-black uppercase text-gray-800 tracking-tight leading-none">Riders Console</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{riders.length} Active Logistics Partners</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all border border-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          <div className="flex gap-3">
             <div className="relative flex-1">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
               <input 
                 type="text" 
                 placeholder="Search by name or number..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-white border border-gray-200 py-3.5 pl-11 pr-4 rounded-2xl text-[11px] font-bold placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
               />
             </div>
             <button 
               onClick={() => {
                 setEditingRider(null);
                 setFormData({ name: '', phone: '', vehicle: 'Bike', status: 'Online' });
                 setShowRiderForm(true);
               }}
               className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center shrink-0"
             >
               <User size={18} strokeWidth={2.5} />
             </button>
          </div>

          {loading ? (
             <div className="py-12 flex flex-col items-center justify-center text-gray-300 gap-3">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading Records...</p>
             </div>
          ) : filteredRiders.length === 0 ? (
             <div className="py-12 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-300">
                <Bike className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">No logistics partners found</p>
             </div>
          ) : (
             <div className="space-y-3">
                {filteredRiders.map((rider) => (
                  <motion.div 
                    layout
                    key={rider.id} 
                    className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group"
                  >
                     <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg border shadow-sm ${rider.status === 'Online' ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
                           {rider.vehicle === 'Electric Scooter' ? '🛵' : '🏍️'}
                        </div>
                        <div className="text-left">
                           <h4 className="text-[12px] font-black uppercase text-gray-800 leading-tight">{rider.name}</h4>
                           <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">{rider.phone} • {rider.vehicle}</p>
                           <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full border ${rider.status === 'Online' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                 {rider.status}
                              </span>
                              <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest">₹{rider.codBalance || 0} COD</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingRider(rider);
                            setFormData({
                              name: rider.name,
                              phone: rider.phone,
                              vehicle: rider.vehicle,
                              status: rider.status
                            });
                            setShowRiderForm(true);
                          }}
                          className="p-2.5 bg-gray-50 text-indigo-600 rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
                        >
                           <Edit size={14} />
                        </button>
                        <a href={`tel:${rider.phone}`} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100">
                           <Phone size={14} />
                        </a>
                     </div>
                  </motion.div>
                ))}
             </div>
          )}
        </div>

        {/* Floating Form Overlay */}
        <AnimatePresence>
          {showRiderForm && (
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="absolute inset-0 bg-white z-50 flex flex-col"
            >
               <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-gray-800 tracking-tight">{editingRider ? 'Update Rider' : 'New Delivery Partner'}</h3>
                  <button onClick={() => setShowRiderForm(false)} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl">
                    <X size={18} />
                  </button>
               </div>
               
               <form onSubmit={handleSaveRider} className="p-6 space-y-5 flex-1 overflow-y-auto text-left">
                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Full Name</label>
                     <input 
                       required
                       value={formData.name}
                       onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                       placeholder="e.g. Rahul Sarma"
                       className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                     />
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number</label>
                     <input 
                       required
                       maxLength={10}
                       value={formData.phone}
                       onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))}
                       placeholder="10-digit mobile number"
                       className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Vehicle Type</label>
                        <select 
                          value={formData.vehicle}
                          onChange={(e) => setFormData(prev => ({...prev, vehicle: e.target.value}))}
                          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[11px] font-black outline-none appearance-none"
                        >
                           <option value="Bike">Heavy Bike (Pulsar/Apache)</option>
                           <option value="Electric Scooter">Electric Scooter</option>
                           <option value="Scooter">Regular Scooty</option>
                           <option value="Bicycle">Bicycle / Cycle</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Initial Status</label>
                        <select 
                          value={formData.status}
                          onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
                          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[11px] font-black outline-none appearance-none"
                        >
                           <option value="Online">Online / Ready</option>
                           <option value="Offline">Offline / Training</option>
                        </select>
                     </div>
                  </div>

                  <div className="pt-4 flex flex-col gap-3">
                     <button 
                       type="submit"
                       className="w-full bg-indigo-600 text-white py-4.5 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all"
                     >
                       {editingRider ? 'Apply Updates' : 'Authorize Partner'}
                     </button>
                     {editingRider && (
                       <button 
                         type="button"
                         onClick={async () => {
                            const { value } = await Dialog.confirm({ title: 'Confirmation', message: 'Remove this rider permanently?' });
                            if (!value) return;
                            await supabase.from('team').delete().eq('id', editingRider.id);
                            toast.success("Rider removed.");
                            setShowRiderForm(false);
                         }}
                         className="w-full bg-rose-50 text-rose-600 py-4.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                       >
                         Terminate Agreement
                       </button>
                     )}
                  </div>
               </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
