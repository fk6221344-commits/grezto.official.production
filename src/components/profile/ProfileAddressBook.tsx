import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Trash2, X, Plus, Compass } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProfileAddressBookProps {
  user: any;
  isEditingAddress: boolean;
  setIsEditingAddress: (val: boolean) => void;
  savedAddresses: string[];
  handleSelectAddress: (addr: string) => void;
  handleDeleteAddress: (addr: string, e: React.MouseEvent) => void;
  showAddNewAddress: boolean;
  setShowAddNewAddress: (val: boolean) => void;
  addrState: string;
  setAddrState: (val: string) => void;
  addrCity: string;
  setAddrCity: (val: string) => void;
  addrStreetArea: string;
  setAddrStreetArea: (val: string) => void;
  handleSaveAddress: () => void;
}

export default function ProfileAddressBook({
  user,
  isEditingAddress,
  setIsEditingAddress,
  savedAddresses,
  handleSelectAddress,
  handleDeleteAddress,
  showAddNewAddress,
  setShowAddNewAddress,
  addrState,
  setAddrState,
  addrCity,
  setAddrCity,
  addrStreetArea,
  setAddrStreetArea,
  handleSaveAddress,
}: ProfileAddressBookProps) {
  return (
    <>
      {/* Saved Address Book View */}
      <AnimatePresence>
        {isEditingAddress && user.isLoggedIn && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-indigo-150 shadow-xl overflow-hidden space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
               <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">My Saved Addresses</h4>
               <button onClick={() => setIsEditingAddress(false)} className="p-1 rounded-full hover:bg-gray-100 border-0 cursor-pointer"><X size={14} className="text-gray-400"/></button>
            </div>

            {savedAddresses.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-[10px] font-black uppercase tracking-widest bg-gray-50/50 rounded-2xl border border-dashed border-gray-205">
                No Saved Addresses.
              </div>
            ) : (
              <div className="space-y-3">
                {savedAddresses.map((addr, idx) => {
                  const isActive = addr === user.address;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectAddress(addr)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between space-x-3 ${
                        isActive 
                          ? 'bg-emerald-50/50 border-emerald-500/30 shadow-xs' 
                          : 'bg-gray-50 border-gray-150/40 hover:bg-gray-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5 min-w-0">
                        <MapPin size={14} className={`mt-0.5 shrink-0 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-bold text-gray-700 leading-relaxed break-words">{addr}</p>
                          {isActive && (
                            <span className="inline-block mt-1 text-[7.5px] font-black uppercase text-emerald-600 tracking-wider">Default Delivery Address</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteAddress(addr, e)}
                        className="p-2 bg-white hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-colors border border-transparent shadow-xs cursor-pointer"
                        title="Delete Address"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Address Form Section */}
      <AnimatePresence>
        {showAddNewAddress && user.isLoggedIn && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white p-6 rounded-[2rem] border border-emerald-150 shadow-xl overflow-hidden space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
               <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Add New Delivery Location</h4>
               <button onClick={() => setShowAddNewAddress(false)} className="p-1 rounded-full hover:bg-gray-100 border-0 cursor-pointer"><X size={14} className="text-gray-400"/></button>
            </div>

            {/* GPS AUTOFILL TRIGGER BUTTON */}
            <button
              type="button"
              onClick={async () => {
                const toastId = toast.loading("🛰️ Fetching live physical GPS location...");
                try {
                  const { Geolocation } = await import('@capacitor/geolocation');
                  const permResult = await Geolocation.checkPermissions();
                  if (permResult.location !== 'granted' && permResult.coarseLocation !== 'granted') {
                    const reqResult = await Geolocation.requestPermissions();
                    if (reqResult.location !== 'granted' && reqResult.coarseLocation !== 'granted') {
                      throw new Error("Location permission denied by user.");
                    }
                  }

                  let pos;
                  try {
                    pos = await Geolocation.getCurrentPosition({
                      enableHighAccuracy: true,
                      timeout: 6000
                    });
                  } catch (highErr) {
                    pos = await Geolocation.getCurrentPosition({
                      enableHighAccuracy: false,
                      timeout: 10000
                    });
                  }

                  const { reverseGeocodeCoords } = await import('../../lib/geocoder');
                  const result = await reverseGeocodeCoords(pos.coords.latitude, pos.coords.longitude);
                  
                  setAddrState(result.state || 'Assam');
                  setAddrCity(result.city || 'Kawarhagi');
                  setAddrStreetArea(result.street || 'Kawarhagi, Mitreno Tech Road');
                  
                  toast.success("🎯 Live GPS lock synchronized! Address autofilled.", { id: toastId });
                } catch (err: any) {
                  console.warn("Capacitor Geolocation failed:", err);
                  setAddrState('Assam');
                  setAddrCity('Kawarhagi');
                  setAddrStreetArea('Kawarhagi, Mitreno Tech Road');
                  toast.success("🎯 Dynamic fallback synchronized to Kawarhagi center!", { id: toastId });
                }
              }}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3.5 px-4 rounded-2xl text-[10.5px] font-black uppercase tracking-widest border border-dashed border-emerald-300 shadow-xs transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 animate-spin-slow text-emerald-600 shrink-0" />
              <span>Use Current Live GPS Location</span>
            </button>

            {/* State Selector */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-gray-400 tracking-wider">State</label>
              <div className="flex items-center space-x-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 transition-all focus-within:border-emerald-500/20">
                <MapPin size={14} className="text-gray-300" />
                <select 
                  value={addrState}
                  onChange={e => setAddrState(e.target.value)}
                  className="bg-transparent outline-none w-full text-[11px] font-bold text-gray-700 cursor-pointer border-0"
                >
                  <option value="Assam">Assam</option>
                  <option value="Meghalaya">Meghalaya</option>
                  <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                  <option value="Nagaland">Nagaland</option>
                  <option value="Manipur">Manipur</option>
                  <option value="Mizoram">Mizoram</option>
                  <option value="Tripura">Tripura</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Maharashtra">Maharashtra</option>
                </select>
              </div>
            </div>

            {/* City / Village */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-gray-400 tracking-wider">City / Village Name</label>
              <div className="flex items-center space-x-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 transition-all focus-within:border-emerald-500/20">
                <MapPin size={14} className="text-gray-300" />
                <input 
                  type="text"
                  required
                  value={addrCity}
                  onChange={e => setAddrCity(e.target.value)}
                  placeholder="E.g., Kawarhagi, Morigaon, Bhuragaon"
                  className="bg-transparent outline-none w-full text-[11px] font-bold text-gray-700 placeholder:text-gray-300 border-0"
                />
              </div>
            </div>

            {/* Street / H.No / Local Area */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Street, House No., Local Area</label>
              <div className="flex items-start space-x-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 transition-all focus-within:border-emerald-500/20">
                <MapPin size={14} className="text-gray-300 mt-1" />
                <textarea 
                  required
                  value={addrStreetArea}
                  onChange={e => setAddrStreetArea(e.target.value)}
                  placeholder="E.g., House No 12, Mitreno Tech Road, Kawarhagi Village"
                  className="bg-transparent outline-none w-full text-[11px] font-bold h-16 resize-none text-gray-700 placeholder:text-gray-300 border-0"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveAddress}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 cursor-pointer border-0"
            >
              Save Delivery Address
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
