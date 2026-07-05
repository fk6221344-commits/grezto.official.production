import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Plus, Trash2, Edit3, X, User, Phone, Navigation, Landmark, Ruler, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Dialog } from '@capacitor/dialog';
import { toast } from 'react-hot-toast';

interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  radius: number;
  managerName: string;
  managerPhone: string;
  managerPin?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

interface AdminMasterCitiesTabProps {
  cities: City[];
  shops: any[];
  riders: any[];
  orders: any[];
  onImpersonateCity?: (cityName: string) => void;
}

export default function AdminMasterCitiesTab({
  cities = [],
  shops = [],
  riders = [],
  orders = [],
  onImpersonateCity
}: AdminMasterCitiesTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);

  // Form fields
  const [cityName, setCityName] = useState('');
  const [cityState, setCityState] = useState('Assam');
  const [cityLat, setCityLat] = useState('26.24345');
  const [cityLng, setCityLng] = useState('92.13062');
  const [cityRadius, setCityRadius] = useState('10');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerPin, setManagerPin] = useState('1234');
  const [cityStatus, setCityStatus] = useState<'active' | 'inactive'>('active');

  const openAddModal = () => {
    setEditingCity(null);
    setCityName('');
    setCityState('Assam');
    setCityLat('26.24345');
    setCityLng('92.13062');
    setCityRadius('10');
    setManagerName('');
    setManagerPhone('');
    setManagerPin('1234');
    setCityStatus('active');
    setShowAddModal(true);
  };

  const openEditModal = (city: City) => {
    setEditingCity(city);
    setCityName(city.name);
    setCityState(city.state || 'Assam');
    setCityLat(city.lat ? String(city.lat) : '26.24345');
    setCityLng(city.lng ? String(city.lng) : '92.13062');
    setCityRadius(city.radius ? String(city.radius) : '10');
    setManagerName(city.managerName || '');
    setManagerPhone(city.managerPhone || '');
    setManagerPin(city.managerPin || '1234');
    setCityStatus(city.status || 'active');
    setShowAddModal(true);
  };

  const handleSaveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityName.trim()) {
      toast.error("City name is required!");
      return;
    }

    const cityId = editingCity ? editingCity.id : cityName.trim().toLowerCase().replace(/\s+/g, '_');
    const loadToastId = toast.loading(editingCity ? "Updating Service Area..." : "Registering New Service Hub...");

    try {
      const cityData: City = {
        id: cityId,
        name: cityName.trim(),
        state: cityState.trim(),
        lat: parseFloat(cityLat) || 26.24345,
        lng: parseFloat(cityLng) || 92.13062,
        radius: parseFloat(cityRadius) || 10,
        managerName: managerName.trim() || 'Regional Admin',
        managerPhone: managerPhone.trim().replace(/\s+/g, ''),
        managerPin: managerPin.trim() || '1234',
        status: cityStatus,
        createdAt: editingCity ? (editingCity.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      await supabase.from('cities').upsert(cityData);
      toast.success(editingCity ? "Hub metadata refreshed successfully!" : "Service area provisioned successfully!", { id: loadToastId });
      setShowAddModal(false);
    } catch (err: any) {
      console.error("Failed saving city:", err);
      toast.error(`Database synchronization error: ${err.message}`, { id: loadToastId });
    }
  };

  const handleDeleteCity = async (cityId: string, name: string) => {
    if (cityId === 'kawarhagi') {
      toast.error("The root Kawarhagi HQ hub cannot be deleted!");
      return;
    }

    const { value: conf } = await Dialog.confirm({ title: 'CONFIRM DELETE', message: `Are you absolutely sure you want to cease all operations and delete "${name}" Hub? This will un-register this city from the app.` });
    if (!conf) return;

    const loadToastId = toast.loading("Ceasing operations & de-provisioning hub...");
    try {
      await supabase.from('cities').delete().eq('id', cityId);
      toast.success("Hub deleted from the systems list.", { id: loadToastId });
    } catch (err: any) {
      console.error(err);
      toast.error(`Error deleting hub: ${err.message}`, { id: loadToastId });
    }
  };

  // Stats calculation
  const totalCities = cities.length;
  const activeCities = cities.filter(c => c.status === 'active').length;
  
  // Calculate total active pipeline revenue (since history is no longer globally fetched)
  const activePipelineValue = orders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Global Multi-City Performance Widgets Card Group */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Hubs Count */}
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4 rounded-3xl border border-emerald-150/40 text-left">
          <div className="flex items-center space-x-2 text-emerald-700">
            <Landmark className="w-4 h-4 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-wider block">Total Service Hubs</span>
          </div>
          <h3 className="text-xl font-black text-emerald-950 mt-1.5">{totalCities}</h3>
          <p className="text-[8px] font-bold text-emerald-600/80 uppercase tracking-tight mt-1">{activeCities} Active Hubs</p>
        </div>

        {/* Associated Partners Count */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 p-4 rounded-3xl border border-purple-150/40 text-left">
          <div className="flex items-center space-x-2 text-purple-700">
            <Plus className="w-4 h-4 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-wider block">Local Retail Partners</span>
          </div>
          <h3 className="text-xl font-black text-purple-950 mt-1.5">{shops.length}</h3>
          <p className="text-[8px] font-bold text-purple-600/80 uppercase tracking-tight mt-1">Sellers/Restaurants</p>
        </div>

        {/* Local Revenue */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 p-4 rounded-3xl border border-amber-150/40 text-left col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-2 text-amber-700">
            <Navigation className="w-4 h-4 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-wider block">Active Pipeline GMV</span>
          </div>
          <h3 className="text-xl font-black text-amber-950 mt-1.5">₹{activePipelineValue.toLocaleString('en-IN')}</h3>
          <p className="text-[8px] font-bold text-amber-600/80 uppercase tracking-tight mt-1">Value of Orders in Transit</p>
        </div>
      </div>

      {/* 2. Headline & Add Button */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="text-left">
          <h4 className="text-xs font-black text-stone-850 uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            Multi-City Service Areas
          </h4>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-1">
            Configure regional coverage coordinates, radius limits, and assign managers
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] uppercase tracking-widest px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all outline-none border-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New City Hub
        </button>
      </div>

      {/* 3. Cities operational Grid list cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cities.map((city) => {
          // Compute local statistics
          const cityShops = shops.filter(s => {
            if (s.city) return s.city.toLowerCase() === city.name.toLowerCase();
            const address = (s.address || "").toLowerCase();
            if (city.id === 'kawarhagi') {
              return !address.includes('guwahati') && !address.includes('morigaon');
            }
            return address.includes(city.name.toLowerCase());
          });

          const cityRiders = riders.filter(r => r.city?.toLowerCase() === city.name.toLowerCase());
          const isActive = city.status === 'active';

          return (
            <div
              key={city.id}
              className={`bg-white rounded-3xl border p-5 text-left flex flex-col justify-between space-y-4 hover:shadow-lg transition-all relative overflow-hidden ${
                isActive ? 'border-gray-100' : 'border-rose-100 bg-rose-50/10'
              }`}
            >
              {/* Active Status Badge tag */}
              <div className="absolute right-4 top-4 flex items-center space-x-1">
                <span className={`text-[7.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                }`}>
                  {isActive ? '● Hub Active' : 'Offline'}
                </span>
              </div>

              {/* Header Info */}
              <div className="space-y-1.5 text-left pr-20">
                <h5 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-1">
                  {city.name}
                  <span className="text-xs text-gray-400 font-medium font-sans">({city.state})</span>
                </h5>
                <p className="text-[10px] text-gray-400 font-mono font-bold flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-600/70 shrink-0" />
                  GPS: {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                </p>
              </div>

              {/* Stat strips */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-2xl border border-gray-100/50">
                <div className="text-left font-sans">
                  <span className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest block">Radius</span>
                  <p className="text-xs font-black text-gray-800 flex items-center gap-0.5 mt-0.5">
                    <Ruler className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {city.radius} KM
                  </p>
                </div>
                <div className="text-left font-sans">
                  <span className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest block">Partners</span>
                  <p className="text-xs font-black text-gray-800 mt-0.5">🏬 {cityShops.length}</p>
                </div>
                <div className="text-left font-sans">
                  <span className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest block">Riders</span>
                  <p className="text-xs font-black text-gray-800 mt-0.5">🚴 {cityRiders.length || 2}</p>
                </div>
              </div>

              {/* Assigned Manager Card */}
              <div className="bg-emerald-50/35 border border-emerald-100/30 p-3 rounded-2xl flex items-center justify-between text-left">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h6 className="text-[10.5px] font-black text-emerald-950 uppercase tracking-tight">{city.managerName}</h6>
                    <p className="text-[8px] font-bold text-emerald-700 tracking-wider flex flex-col mt-0.5">
                      <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5 text-emerald-600" /> +91 {city.managerPhone}</span>
                      <span className="text-[8.5px] text-gray-500 font-extrabold lowercase mt-0.5">🔑 pin: <span className="text-emerald-700 font-black">{city.managerPin || '1234'}</span></span>
                    </p>
                  </div>
                </div>
                <span className="text-[7px] font-black uppercase text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-150">City Manager</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-2 pt-1 border-t border-gray-50">
                <button
                  onClick={() => onImpersonateCity && onImpersonateCity(city.name)}
                  className="w-full bg-[#1c1917] hover:bg-stone-800 text-white font-black text-[9.5px] uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-1 border-0 cursor-pointer transition-colors shadow-xs"
                >
                  🚪 Enter Hub Dashboard
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(city)}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-extrabold text-[8.5px] uppercase tracking-widest py-2 rounded-xl flex items-center justify-center gap-1 border-0 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3 text-stone-500" />
                    Edit Metadata
                  </button>
                  {city.id !== 'kawarhagi' && (
                    <button
                      onClick={() => handleDeleteCity(city.id, city.name)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 rounded-xl flex items-center justify-center border-0 cursor-pointer transition-colors"
                      title="Terminate Hub"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Elegant form dialog modally overlayed */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99] flex items-end sm:items-center justify-center p-0 font-sans"
          >
            <motion.div
              initial={{ y: "15%" }}
              animate={{ y: 0 }}
              exit={{ y: "15%" }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 pb-10 space-y-5 shadow-2xl relative border-t border-gray-100/30 overflow-y-auto max-h-[85vh] text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  {editingCity ? "Edit Service Hub" : "Provision New City Hub"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-xl px-2.5 py-1 text-xs font-black transition-colors flex items-center justify-center border-0 cursor-pointer shadow-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCity} className="space-y-4">
                {/* City Name */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">City or Service Area Name</label>
                  <input
                    type="text"
                    required
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    disabled={!!editingCity}
                    placeholder="e.g. Guwahati / Morigaon Center"
                    className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                {/* State */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">State</label>
                  <input
                    type="text"
                    required
                    value={cityState}
                    onChange={(e) => setCityState(e.target.value)}
                    placeholder="e.g. Assam"
                    className="w-full bg-gray-50 border border-gray-100 text-gray-700 py-3 px-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Radius Coordinates */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Geofencing & Coverage Range</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Center Latitude</label>
                      <input
                        type="number"
                        step="0.00001"
                        required
                        value={cityLat}
                        onChange={(e) => setCityLat(e.target.value)}
                        placeholder="e.g. 26.1158"
                        className="w-full bg-white border border-gray-150 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Center Longitude</label>
                      <input
                        type="number"
                        step="0.00001"
                        required
                        value={cityLng}
                        onChange={(e) => setCityLng(e.target.value)}
                        placeholder="e.g. 91.7086"
                        className="w-full bg-white border border-gray-150 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Service Delivery Radius (KM)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={cityRadius}
                      onChange={(e) => setCityRadius(e.target.value)}
                      placeholder="e.g. 10 (Km radius)"
                      className="w-full bg-white border border-gray-150 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-extrabold outline-none"
                    />
                  </div>
                </div>

                {/* Manager Allocation */}
                <div className="bg-emerald-50/10 border border-emerald-100 p-4 rounded-2xl space-y-3">
                  <span className="text-[8px] font-black text-emerald-800 uppercase tracking-widest block flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    City Administrative Manager
                  </span>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Manager Full Name</label>
                      <input
                        type="text"
                        required
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="e.g. Dhruba Jyoti"
                        className="w-full bg-white border border-gray-150 text-gray-750 py-2.5 px-3 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Manager Contact Phone</label>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        value={managerPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setManagerPhone(val);
                        }}
                        placeholder="10-digit phone number"
                        className="w-full bg-white border border-gray-150 text-gray-750 py-2.5 px-3 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-bold text-gray-400 uppercase block">Manager Login PIN (e.g., 4 digits)</label>
                      <input
                        type="text"
                        maxLength={4}
                        required
                        value={managerPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setManagerPin(val);
                        }}
                        placeholder="4-digit PIN"
                        className="w-full bg-white border border-gray-150 text-gray-750 py-2.5 px-3 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-left select-none">
                  <div>
                    <span className="text-[8.5px] font-black text-gray-600 uppercase tracking-widest block">Active Operations Status</span>
                    <p className="text-[9.5px] text-gray-400 leading-tight mt-0.5">Toggle active state of operations in this hub</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCityStatus(cityStatus === 'active' ? 'inactive' : 'active')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none border-0 ${
                      cityStatus === 'active' ? 'bg-emerald-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        cityStatus === 'active' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-98 cursor-pointer mt-3 border-0 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingCity ? "REFRESH HUB SETTINGS" : "ACTIVATE SERVICE AREA"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
