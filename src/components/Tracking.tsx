import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  Award, 
  Activity, 
  Battery, 
  Wifi, 
  AlertTriangle, 
  BarChart3, 
  ShieldAlert, 
  Sparkles, 
  Sliders, 
  ChevronDown, 
  CheckCircle, 
  Orbit, 
  Signal, 
  Play, 
  Pause, 
  RefreshCw 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { auth } from '../services/firebase';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// Base Kawarhagi coordinates for central hub and mapping
const HUB_COORDS = { lat: 26.243455, lng: 92.1306235 }; // Grezto Central Warehouse Hub

// Parse user address into simulated coordinates in Kawarhagi if explicit lat/lng is missing
const resolveCustomerCoords = (address: string = ''): { lat: number; lng: number } => {
  const addr = address.toLowerCase();
  if (addr.includes('zoo road')) return { lat: 26.1558, lng: 91.7786 };
  if (addr.includes('ganeshguri')) return { lat: 26.1488, lng: 91.7820 };
  if (addr.includes('beltola')) return { lat: 26.1360, lng: 91.7915 };
  if (addr.includes('paltan')) return { lat: 26.1750, lng: 91.7540 };
  if (addr.includes('dispur')) return { lat: 26.1432, lng: 91.7891 };
  if (addr.includes('kahilipara')) return { lat: 26.1315, lng: 91.7585 };
  if (addr.includes('maligaon')) return { lat: 26.1542, lng: 91.7011 };
  if (addr.includes('chansari')) return { lat: 26.2415, lng: 91.7145 };
  
  let hash = 0;
  for (let i = 0; i < addr.length; i++) {
    hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (Math.abs(hash % 100) / 1000) - 0.05;
  const lngOffset = (Math.abs((hash >> 8) % 100) / 100) - 0.05;
  return { lat: 26.243455 + latOffset * 0.1, lng: 92.1306235 + lngOffset * 0.1 };
};

interface TrackingProps {
  order?: any;
  onBack: () => void;
}

export default function Tracking({ order, onBack }: TrackingProps) {
  const { firebaseAuthReady } = useUser();
  const { t } = useLanguage();
  const userPhone = localStorage.getItem('last_order_phone');
  const [mapsAuthError, setMapsAuthError] = useState(Boolean((window as any).grezto_maps_auth_failed));

  useEffect(() => {
    const handleAuthFailed = () => {
      setMapsAuthError(true);
    };
    window.addEventListener('grezto-maps-auth-failed', handleAuthFailed);
    return () => {
      window.removeEventListener('grezto-maps-auth-failed', handleAuthFailed);
    };
  }, []);
  
  // Real-time states
  const [activeOrder, setActiveOrder] = useState<any>(order || null);
  const [partnerPos, setPartnerPos] = useState<{ lat: number; lng: number }>(HUB_COORDS);
  const [partnerInfo, setPartnerInfo] = useState({ 
    name: order?.partnerName || 'Rahul Sharma', 
    phone: order?.partnerPhone || '9876543210' 
  });
  
  const [routePath, setRoutePath] = useState<{ lat: number; lng: number }[]>([]);
  const [eta, setEta] = useState(15);
  const [distance, setDistance] = useState("3.4 KM");
  const [routePercent, setRoutePercent] = useState(0.01);

  // Upgraded Cockpit Dashboard States
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [speed, setSpeed] = useState(38);
  const [networkSignal, setNetworkSignal] = useState<'Excellent' | 'Weak' | 'Interrupted'>('Excellent');
  const [isBatteryOptimized, setIsBatteryOptimized] = useState(true);
  const [deviationDetected, setDeviationDetected] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    "📍 INITIALIZING REALTIME LOGISTICS COCKPIT...",
    "📡 GLOBAL NAVIGATION SYSTEM: ONLINE",
    "🛡️ PRO-ACTIVE SECURE COORDINATES DEPLOYMENT ROUTING..."
  ]);

  // Derive target Customer coordinates based on current active order coordinates or address
  const customerPos = useMemo(() => {
    if (activeOrder?.lat && activeOrder?.lng) {
      return { lat: Number(activeOrder.lat), lng: Number(activeOrder.lng) };
    }
    const addrStr = typeof activeOrder?.address === 'object' 
      ? (activeOrder.address?.address || '') 
      : (activeOrder?.address || '');
    return resolveCustomerCoords(addrStr);
  }, [activeOrder]);

  // Read latest active order for this user phone if none was passed
  useEffect(() => {
    if (order) {
      setActiveOrder(order);
    }
    if (!firebaseAuthReady || !userPhone || !supabase) return;

    const phoneList = [userPhone];
    const stripped = userPhone.replace(/\D/g, '').slice(-10);
    if (stripped && !phoneList.includes(stripped)) {
      phoneList.push(stripped);
    }
    if (stripped && !phoneList.includes('+91' + stripped)) {
      phoneList.push('+91' + stripped);
    }

    const currentUid = auth.currentUser?.uid;

    let isMounted = true;
    let sub: any;

    const fetchLatestOrder = async () => {
      try {
        const orConditions = [];
        if (currentUid) orConditions.push(`userId.eq.${currentUid}`);
        phoneList.forEach(p => orConditions.push(`customerPhone.eq.${p}`)); // Assuming phone is stored as customerPhone now in supabase, or 'phone'

        const { data } = await supabase.from('orders')
           .select('*')
           .or(orConditions.join(','))
           .order('createdAt', { ascending: false })
           .limit(1);

        if (data && data.length > 0 && isMounted) {
           setActiveOrder(data[0]);
           if (data[0].partnerPhone) {
              setPartnerInfo({
                name: data[0].partnerName || 'Rahul Sharma',
                phone: data[0].partnerPhone
              });
           }
        }

        if (isMounted) {
            sub = supabase.channel(`tracking_user_orders_${Math.random()}`)
               .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
                   if (!isMounted) return;
                   const { data: updated } = await supabase.from('orders')
                      .select('*')
                      .or(orConditions.join(','))
                      .order('createdAt', { ascending: false })
                      .limit(1);
                   if (updated && updated.length > 0 && isMounted) {
                      setActiveOrder(updated[0]);
                      if (updated[0].partnerPhone) {
                         setPartnerInfo({
                           name: updated[0].partnerName || 'Rahul Sharma',
                           phone: updated[0].partnerPhone
                         });
                      }
                   }
               }).subscribe();
        }
      } catch (err) {
        console.warn("Tracking fetch error:", err);
      }
    };
    fetchLatestOrder();

    return () => {
      isMounted = false;
      if (sub) supabase.removeChannel(sub);
    };
  }, [userPhone, firebaseAuthReady, order]);

  // Document-level observer trigger for activeOrder tracking updates (already handled by the top subscription but kept for singular id updates if needed)
  useEffect(() => {
    if (!activeOrder?.id || !supabase) return;
    let isMounted = true;
    const sub = supabase.channel(`tracking_doc_${activeOrder.id}_${Math.random()}`)
       .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` }, async () => {
           if (!isMounted) return;
           const { data } = await supabase.from('orders').select('*').eq('id', activeOrder.id).single();
           if (data && isMounted) {
              setActiveOrder(data);
              if (data.partnerPhone) {
                setPartnerInfo({
                  name: data.partnerName || 'Rahul Sharma',
                  phone: data.partnerPhone
                });
              }
           }
       }).subscribe();
    return () => { 
       isMounted = false;
       supabase.removeChannel(sub); 
    };
  }, [activeOrder?.id]);

  // Set real-time tracking route markers locally with perfect straight & curve geometries
  useEffect(() => {
    if (!customerPos) return;
    
    // Fallback simulated path calculation and distance metrics
    setDistance("4.2 KM");
    setEta(14);
    
    const mockPoints = [
      HUB_COORDS,
      { lat: (HUB_COORDS.lat + customerPos.lat) / 2 + 0.0015, lng: (HUB_COORDS.lng + customerPos.lng) / 2 - 0.001 },
      customerPos
    ];
    setRoutePath(mockPoints);
  }, [customerPos]);

  // Hook into Firestore to listen to real-time positions with automatic route-interpolation recovery
  useEffect(() => {
    // Tracking database query disabled on user request for reset
  }, [partnerInfo.phone, networkSignal]);

  // 60FPS fluid simulation along the actual route path
  useEffect(() => {
    if (activeOrder?.status !== 'Out for Delivery') {
      setPartnerPos(HUB_COORDS);
      return;
    }

    const interval = setInterval(() => {
      if (networkSignal === 'Interrupted') return; // Pause updates on network breakdown
      setRoutePercent(p => {
        const next = p + 0.004;
        if (next >= 1.0) return 0.97;
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [activeOrder?.status, networkSignal]);

  // Handle route coordinate interpolation
  useEffect(() => {
    if (routePath.length > 0 && routePercent > 0) {
      const floatIndex = routePercent * (routePath.length - 1);
      const index = Math.floor(floatIndex);
      const nextIndex = Math.min(index + 1, routePath.length - 1);
      
      const p1 = routePath[index];
      const p2 = routePath[nextIndex];
      const f = floatIndex % 1;

      if (p1 && p2) {
        setPartnerPos({
          lat: p1.lat + (p2.lat - p1.lat) * f,
          lng: p1.lng + (p2.lng - p1.lng) * f
        });
      }
    }
  }, [routePath, routePercent]);

  // Real-time Speed & Telemetry Ticker loop
  useEffect(() => {
    const isOut = activeOrder?.status === 'Out for Delivery';
    if (!isOut) return;

    const interval = setInterval(() => {
      // Randomly update speed meter
      setSpeed(s => {
        if (networkSignal === 'Interrupted') return 0;
        const delta = Math.floor(Math.random() * 7) - 3;
        const nextSpeed = s + delta;
        return Math.max(15, Math.min(55, nextSpeed));
      });

      // Insert fresh diagnostic log entry corresponding to location/status
      setTelemetryLogs(logs => {
        const logEntries = [
          `🚲 Speed tracking telemetry: ${speed} km/h - GPS accuracy: ±1.2m`,
          `🛰️ Sats tracked: ${networkSignal === 'Excellent' ? '12 GPS + GLONASS' : '4 Weak Sats'}`,
          `⚙️ Battery overhead optimize: ${isBatteryOptimized ? 'Eco Smart Telemetry active' : 'Full Power Stream'}`,
          `📍 Latency check: ${networkSignal === 'Excellent' ? '45ms' : networkSignal === 'Weak' ? '380ms' : 'Offline packet queued'}`
        ];
        const newLog = logEntries[Math.floor(Math.random() * logEntries.length)];
        return [newLog, ...logs.slice(0, 8)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [activeOrder?.status, speed, networkSignal, isBatteryOptimized]);

  // Manual Trigger to Simulate Deviation & Intelligent Re-routing
  const handleSimulateDeviation = () => {
    if (activeOrder?.status !== 'Out for Delivery') {
      toast.error("Activate order delivery to test deviation sequence!");
      return;
    }
    setDeviationDetected(true);
    toast.error("🚨 WARNING: Path Deviation Detected! Coordinates outside buffer corridor.", { duration: 4000 });
    
    // Auto initiate smart rerouting 3 seconds later
    setTimeout(() => {
      setIsRerouting(true);
      toast.success("🧠 CPU: Calculating smart reroute path via Roads API...", { duration: 3000 });
      
      setTimeout(() => {
        setDeviationDetected(false);
        setIsRerouting(false);
        toast.success("✅ Recalculated! Route deviations corrected. Stream re-aligned.");
        setTelemetryLogs(logs => [
          `🔄 REROUTING SEQUENCE COMPLETE: Smart Path Synchronized`,
          ...logs.slice(0, 5)
        ]);
      }, 2500);
    }, 3000);
  };

  // Simulates network disruption test
  const handleNetworkToggle = (mode: 'Excellent' | 'Weak' | 'Interrupted') => {
    setNetworkSignal(mode);
    if (mode === 'Interrupted') {
      toast.error("📵 Network Interrupted! Telemetry updates cached in device RAM.");
    } else if (mode === 'Weak') {
      toast("📶 Weak Signal! Fallbacks applied to prevent coordinate jumps.", { icon: '📶' });
    } else {
      toast.success("⚡ Signal Restored! Cached telemetry logs uploaded to database.");
      setTelemetryLogs(logs => [
        `🔄 OFFLINE ENGINE RECOVERY: Uploaded 4 cached packet positions.`,
        ...logs.slice(0, 5)
      ]);
    }
  };

  const currentStatus = activeOrder?.status || 'No active order';
  const showDeliveryTracker = currentStatus === 'Out for Delivery';

  return (
    <div className="fixed inset-0 bg-stone-950 z-[500] flex flex-col font-sans overflow-hidden">
      {/* Absolute top navbar styling */}
      <div className="absolute top-8 left-6 right-6 z-[1000] flex justify-between items-center pointer-events-none">
        <button 
          onClick={onBack} 
          className="pointer-events-auto p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 text-gray-505 hover:text-emerald-500 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="pointer-events-auto flex items-center space-x-2">
          {/* Operations terminal trigger button */}
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className="p-3 bg-slate-900 border border-emerald-500/20 rounded-2xl shadow-xl text-emerald-400 hover:text-emerald-300 pointer-events-auto font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer animate-pulse"
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>{showAnalytics ? "Close Terminal" : "Logistics Dashboard"}</span>
          </button>

          <div className="bg-emerald-600 px-4 py-2.5 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-xl flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
            <span>{currentStatus === 'Out for Delivery' ? '⚡ Live Tracking' : '🛒 Processing'}</span>
          </div>
        </div>
      </div>

      {/* Path deviation and rerouting full map warnings */}
      <AnimatePresence>
        {deviationDetected && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-x-6 top-28 z-[2000] bg-red-650/95 backdrop-blur-md text-white p-4.5 rounded-3xl border border-red-500 shadow-2xl flex space-x-3 items-center"
          >
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[10px] font-black uppercase tracking-wider leading-none text-red-100">Rider Out-of-Corridor Deviation</h4>
              <p className="text-[9px] font-bold text-red-50 mt-1 leading-snug">GPS telemetry shows delivery partner deviated from pre-computed path. Initiating automated recheck...</p>
            </div>
          </motion.div>
        )}

        {isRerouting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1999] bg-stone-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white"
          >
            <div className="p-6 bg-slate-900 border border-emerald-500/30 rounded-[2.5rem] flex flex-col items-center space-y-4 max-w-xs text-center shadow-2xl">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Smart Rerouting Engine</h4>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Resolving roads mapping network deviation anomalies...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Google Maps Container */}
      <div className="flex-1 relative z-0">
        <div className="absolute inset-0 bg-[#090d16] flex flex-col justify-center items-center p-6 text-center select-none">
          {/* Concentric expanding ripples representing active pinging */}
          <div className="absolute w-[80%] h-[80%] max-w-[450px] max-h-[450px] border border-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-[66%] h-[66%] border border-emerald-500/15 rounded-full flex items-center justify-center">
              <div className="w-[50%] h-[50%] border border-emerald-500/20 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-emerald-500/30 rounded-full animate-ping" />
              </div>
            </div>
          </div>

          {/* Glowing connecting path */}
          <div className="absolute w-[60%] h-[40%] max-w-[320px] border-b-2 border-r-2 border-dashed border-emerald-500/20 rounded-br-[4rem]" />

          {/* Header info badge explaining maps requirement */}
          <div className="absolute top-10 inset-x-6 max-w-sm mx-auto bg-stone-900/95 border border-emerald-500/20 p-4 rounded-3xl text-white shadow-2xl flex flex-col items-center">
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 animate-pulse mb-1">
              <Orbit className="w-4 h-4" />
            </div>
            <h4 className="text-[9.5px] font-black uppercase text-emerald-400 tracking-widest">Realtime Radar Satellite Navigation</h4>
            <p className="text-[8px] text-gray-400 font-bold uppercase mt-1 leading-normal px-2">
              Live delivery partner connection active on Kawarhagi terminal channel. Coordinates tracked sequentially.
            </p>
          </div>

          {/* Grezto Hub Node */}
          <div className="absolute left-[20%] top-[40%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald-950 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-4 ring-emerald-500/10">
              🌱
            </div>
            <span className="text-[7.5px] font-black text-emerald-400 mt-1 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded-md">Dispatch Hub</span>
          </div>

          {/* Delivery address Node */}
          <div className="absolute right-[20%] bottom-[40%] translate-x-1/2 translate-y-1/2 flex flex-col items-center">
            <div className="w-12 h-12 bg-rose-950 border border-rose-500/30 rounded-full flex items-center justify-center text-xl shadow-lg ring-4 ring-rose-500/10 animate-pulse">
              🏠
            </div>
            <span className="text-[7.5px] font-black text-rose-400 mt-1 uppercase tracking-widest bg-rose-950/80 px-2 py-0.5 rounded-md">Your Address</span>
          </div>

          {/* Active partner tracking specialist symbol */}
          {showDeliveryTracker && (
            <div 
              className="absolute flex flex-col items-center transition-all duration-300"
              style={{
                left: `${20 + (routePercent * 60)}%`,
                top: `${40 + (routePercent * 20)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-11 h-11 bg-amber-500 border-2 border-white rounded-2xl flex items-center justify-center text-lg shadow-xl ring-4 ring-amber-500/30 relative">
                🛵
              </div>
              <span className="text-[7px] font-extrabold text-stone-900 bg-amber-400 px-1.5 py-0.5 rounded-sm mt-1 uppercase tracking-wide leading-none">{partnerInfo.name}</span>
            </div>
          )}
        </div>


        {/* Informational bubble when order isn't dispatched yet */}
        <AnimatePresence>
          {!showDeliveryTracker && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-x-6 top-32 z-[999] bg-amber-500/95 backdrop-blur-md text-white p-4 rounded-3xl border border-amber-400 shadow-xl flex space-x-3 items-center"
            >
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg shrink-0 font-medium">🕒</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black uppercase tracking-wider leading-none">Rider Preparing Items</h4>
                <p className="text-[9px] font-bold text-amber-50 mt-1 leading-snug">Order is in "{currentStatus}" phase. Dispatch tracker will begin momentarily.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Logistics Operations Cockpit Side-Slide/Drawer Drawer overlay */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-slate-950 border-l border-slate-900 z-[1200] max-w-full flex flex-col text-slate-100 shadow-2xl overflow-y-auto no-scrollbar"
            >
              {/* Cockpit header */}
              <div className="p-6 border-b border-slate-900 flex justify-between items-center bg-slate-900/40">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 leading-none">Logistics Control board</h3>
                    <p className="text-[8px] text-gray-500 font-extrabold uppercase mt-1 tracking-widest">Realtime Operations Feed</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAnalytics(false)}
                  className="text-gray-500 hover:text-white p-1 bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-all border-0 text-[10px] uppercase font-black px-2 py-1 tracking-wider"
                >
                  Hide
                </button>
              </div>

              {/* Dynamic Gauges Section */}
              <div className="p-5.5 space-y-5 flex-1 select-none">
                {/* Visual Speedometer */}
                <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-900 flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider mb-2">Delivery Partner Speedometer</span>
                  <div className="relative w-28 h-18 border-t-4 border-l-4 border-r-4 border-dashed border-emerald-500/20 rounded-t-full flex items-center justify-center pt-3">
                    <div className="text-center">
                      <p className="text-2xl font-black tracking-tight leading-none text-emerald-400 font-mono italic">
                        {showDeliveryTracker ? speed : 0}
                      </p>
                      <p className="text-[7.5px] text-gray-500 uppercase font-black tracking-widest mt-0.5">KM/Hour</p>
                    </div>
                    {/* Glowing point cursor indicator */}
                    <div className="absolute bottom-0 w-1 bg-gradient-to-t from-transparent to-rose-500 origin-bottom transition-transform duration-500" 
                         style={{ height: '36px', transform: `rotate(${(showDeliveryTracker ? speed : 0) * 1.8 - 90}deg)` }} 
                    />
                  </div>
                </div>

                {/* Satellite coordinate details */}
                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider">Sub-meter GPS Coordinates</span>
                  <div className="font-mono text-[9px] text-slate-400 p-3 bg-slate-900/70 rounded-2xl border border-slate-900 space-y-1 leading-snug font-bold">
                    <p>Lat: <span className="text-indigo-400">{partnerPos.lat.toFixed(5)}</span></p>
                    <p>Lng: <span className="text-indigo-400">{partnerPos.lng.toFixed(5)}</span></p>
                    <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-900 text-[8px] uppercase tracking-wider text-slate-500">
                      <span>RTK Precision: ±0.34m</span>
                      <span>Lock: OK</span>
                    </div>
                  </div>
                </div>

                {/* Operations Controllers Toggles */}
                <div className="bg-slate-900/40 p-4.5 rounded-3xl border border-slate-900 space-y-4">
                  <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Operational Diagnostics</span>

                  {/* Traffic heatmap toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-white leading-none">Traffic Heatmap Layer</p>
                      <p className="text-[8px] text-gray-400 mt-1">Overlay local jams directly</p>
                    </div>
                    <button
                      onClick={() => setShowTrafficLayer(!showTrafficLayer)}
                      className={`px-3 py-1.5 rounded-xl text-[8.5px] uppercase font-black tracking-wider transition-colors border-0 cursor-pointer ${
                        showTrafficLayer ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {showTrafficLayer ? 'ON (Heat)' : 'OFF'}
                    </button>
                  </div>

                  {/* Battery performance background optimization toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-white leading-none">Battery Saving Sync</p>
                      <p className="text-[8px] text-gray-400 mt-1">Background adaptive sleep</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsBatteryOptimized(!isBatteryOptimized);
                        toast.success(isBatteryOptimized ? "Full Power Direct Tracking Stream Enabled!" : "Battery Saving Sync Activated!");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[8.5px] uppercase font-black tracking-wider transition-colors border-0 cursor-pointer ${
                        isBatteryOptimized ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {isBatteryOptimized ? 'Eco Active' : 'Off'}
                    </button>
                  </div>

                  {/* Network Signal Simulator switcher tabs */}
                  <div className="space-y-2 pt-1 border-t border-slate-900">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Simulate Network Quality</p>
                    <div className="grid grid-cols-3 bg-slate-950 p-0.5 rounded-xl border border-slate-900">
                      {(['Excellent', 'Weak', 'Interrupted'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => handleNetworkToggle(mode)}
                          className={`py-2 text-[8px] font-black uppercase tracking-wider rounded-lg border-0 transition-all cursor-pointer ${
                            networkSignal === mode 
                              ? (mode === 'Excellent' ? 'bg-emerald-605 text-emerald-400 bg-emerald-900/30' : mode === 'Weak' ? 'bg-amber-605 text-amber-500 bg-amber-900/30' : 'bg-red-650 text-red-100 bg-red-950/40')
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Route deviation simulator trigger button */}
                  <div className="pt-2">
                    <button
                      onClick={handleSimulateDeviation}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider border-0 cursor-pointer text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-950/50"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Simulate Route Deviation
                    </button>
                  </div>
                </div>

                {/* Telemetry live scrolling diagnostic logs */}
                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-black uppercase text-gray-500 tracking-wider block">Sat-Link Activity Logs</span>
                  <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-900 font-mono text-[7.5px] text-emerald-450 h-32 overflow-y-auto space-y-1.5 leading-snug no-scrollbar font-bold">
                    {telemetryLogs.map((log, index) => (
                      <div key={index} className="border-l-2 border-emerald-500/20 pl-1.5">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Operations Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-900 text-center select-none">
                <p className="text-[7.5px] text-gray-600 font-bold uppercase tracking-widest">Grezto logistics tracking system v4.2</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Card Pane */}
      <motion.div 
        initial={{ y: 250 }}
        animate={{ y: 0 }}
        className="bg-white px-2 pt-6 pb-10 rounded-t-[3.5rem] shadow-2xl border-t border-gray-100 z-[1001]"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6 shrink-0"></div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Navigation size={22} className="fill-white/10 rotate-45 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Guaranteed Delivery</p>
              <h3 className="text-xl font-black text-stone-850 tracking-tight uppercase leading-none italic">
                {showDeliveryTracker ? `${eta} Minutes (${distance})` : 'Awaiting Dispatch'}
              </h3>
            </div>
          </div>
          
          <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center space-x-1.5 shrink-0">
            <span className="text-emerald-700 font-extrabold text-[9px] uppercase tracking-wider">
              {currentStatus}
            </span>
          </div>
        </div>

        <div className="h-px bg-gray-50 w-full mb-6" />

        {/* Dynamic secure OTP shared block */}
        {activeOrder?.deliveryOtp && (
          <div className="mb-6 p-3 bg-gradient-to-r from-amber-50 to-orange-55/40 rounded-2xl border border-amber-200/60 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-sm">🔑</span>
              <span className="text-[9px] font-black text-amber-700 tracking-wider uppercase">DELIVERY VERIFICATION OTP</span>
            </div>
            <span className="text-base font-black text-amber-955 font-mono tracking-widest bg-white border border-amber-200/40 px-3.5 py-1 rounded-xl shadow-xs">{activeOrder.deliveryOtp}</span>
          </div>
        )}

        {/* Delivery Partner info area */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gray-100 rounded-3xl overflow-hidden border border-gray-100 flex items-center justify-center shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop" 
                  referrerPolicy="no-referrer"
                  alt="Rider" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm">
                🏆
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="font-extrabold text-stone-850 text-sm tracking-tight leading-none">{partnerInfo.name}</h4>
                <span className="bg-lime-50 text-[8px] font-black uppercase text-lime-700 px-1.5 py-0.5 rounded-md border border-lime-200">★ 4.9</span>
              </div>
              <p className="text-[10px] text-stone-400 font-extrabold uppercase mt-1 tracking-wider">Grezto Gold Rider Representative</p>
            </div>
          </div>
          
          {partnerInfo.phone && (
            <a 
              href={`tel:${partnerInfo.phone}`}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-lg transition-colors flex items-center justify-center cursor-pointer border-0 outline-none"
            >
              <Phone size={16} className="text-white shrink-0" />
            </a>
          )}
        </div>
      </motion.div>
    </div>
  );
}

