import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bike, 
  MapPin, 
  Phone, 
  Navigation, 
  Compass, 
  CheckCircle, 
  X, 
  ChevronRight, 
  Sliders, 
  Eye, 
  HelpCircle, 
  Check, 
  Info,
  Volume2, 
  VolumeX,
  Play,
  RotateCcw,
  Zap,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface RiderCoPilotProps {
  order: any;
  shopDetails: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  onClose: () => void;
  onComplete?: () => void;
}

export default function RiderCoPilotAssist({ order, shopDetails, onClose, onComplete }: RiderCoPilotProps) {
  // Co-Pilot navigation state variables
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(0); // 0 to 100 %
  const [speedMs, setSpeedMs] = useState(0); // Simulated speed
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0); // in meters
  const [simulatedLat, setSimulatedLat] = useState<number>(26.1522);
  const [simulatedLng, setSimulatedLng] = useState<number>(91.7602);
  
  // Doorstep delivery checklists
  const [checklist, setChecklist] = useState({
    locationConfirmed: false,
    paymentCollected: order.paymentMethod === 'Online' || false,
    customerSignature: false,
  });

  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sound Synth Cues helper
  const speakVoiceInstruction = (text: string) => {
    // Disabled entirely at user request to prevent background voice suggestions
  };

  // Coordinates values
  const riderStartLat = 26.243455; // Kawarhagi center
  const riderStartLng = 92.1306235;
  
  // Safe extraction of customer coordinates from JSONB address or fallback string parsing
  const getDeliveryCoords = () => {
    let lat = order.lat;
    let lng = order.lng;
    if (order.address && typeof order.address === 'object') {
      if (order.address.lat) lat = order.address.lat;
      if (order.address.lng) lng = order.address.lng;
    }
    if (!lat || !lng) {
      const addrStr = typeof order.address === 'object' ? order.address?.address : order.address;
      if (addrStr && typeof addrStr === 'string') {
        const gpsMatch = addrStr.match(/\(GPS:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\)/i) || 
                         addrStr.match(/\(GPS Address:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\)/i) ||
                         addrStr.match(/GPS:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/i);
        if (gpsMatch && gpsMatch[1] && gpsMatch[2]) {
          lat = parseFloat(gpsMatch[1]);
          lng = parseFloat(gpsMatch[2]);
        }
      }
    }
    return {
      lat: lat || 26.1852,
      lng: lng || 91.7538
    };
  };

  const { lat: deliveryLat, lng: deliveryLng } = getDeliveryCoords();

  // Compute live relative distances
  useEffect(() => {
    if (simulationActive) return;

    // Static estimate from starting point to customer address
    const dx = deliveryLat - riderStartLat;
    const dy = deliveryLng - riderStartLng;
    const initialDistanceInMeters = Math.round(Math.sqrt(dx * dx + dy * dy) * 111300);
    setDistanceRemaining(initialDistanceInMeters);
    setSimulatedLat(riderStartLat);
    setSimulatedLng(riderStartLng);
  }, [deliveryLat, deliveryLng, simulationActive]);

  // Initial greeting announcement when launched
  useEffect(() => {
    const greetingText = `को-पायलट एक्टिव। सीधे कस्टमर ${order.customerName || ''} के दरवाजे पर नेविगेट करें।`;
    speakVoiceInstruction(greetingText);
  }, [order.customerName]);

  // Handle live ride simulation
  useEffect(() => {
    let intervalId: any = null;
    
    if (simulationActive) {
      intervalId = setInterval(() => {
        setSimulatedProgress(prev => {
          if (prev >= 100) {
            setSimulationActive(false);
            setSpeedMs(0);
            setDistanceRemaining(0);
            
            speakVoiceInstruction("आप कस्टमर के दरवाजे पर पहुंच चुके हैं। कृपया सुरक्षित ओ टी पी दर्ज करके डिलीवरी समाप्त करें।");
            toast.success("🏠 Customer Destination Reached!");
            return 100;
          }

          const nextProgress = prev + 5; // increment progress
          
          // Interpolate real geodesic latitude and longitude
          const currentInterpLat = riderStartLat + (deliveryLat - riderStartLat) * (nextProgress / 100);
          const currentInterpLng = riderStartLng + (deliveryLng - riderStartLng) * (nextProgress / 100);
          
          setSimulatedLat(currentInterpLat);
          setSimulatedLng(currentInterpLng);

          // Calculate remaining distance
          const dx = deliveryLat - currentInterpLat;
          const dy = deliveryLng - currentInterpLng;
          const distLeft = Math.round(Math.sqrt(dx * dx + dy * dy) * 111300);
          setDistanceRemaining(distLeft);

          // Randomize speed for authentic telemetry
          setSpeedMs(Math.round(25 + Math.random() * 20));

          // Speak milestone voice prompts
          if (nextProgress === 25) {
            speakVoiceInstruction("डिलीवरी एड्रेस की तरफ मार्ग खुला है, सीधे नेविगेट करें।");
          } else if (nextProgress === 75) {
            speakVoiceInstruction("आप कस्टमर के एड्रेस के बेहद करीब हैं, गाड़ी धीमी करें।");
          }

          return nextProgress;
        });
      }, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [simulationActive, deliveryLat, deliveryLng]);

  // Start Ride Simulation Helper
  const startSimulation = () => {
    setSimulatedProgress(0);
    setSimulationActive(true);
    speakVoiceInstruction("कस्टमर के अड्रेस के लिए राइट नेविगेशन सिमुलेशन सुचारू रूप से शुरू है।");
    toast.success("🚀 Real-Time Navigation Simulation Started!");
  };

  // Reset Simulation Tracker
  const resetSimulation = () => {
    setSimulationActive(false);
    setSimulatedProgress(0);
    setSpeedMs(0);
    speakVoiceInstruction("नेविगेशन रीसेट कर दिया गया है।");
    toast("Navigation Reset Completed.");
  };

  // Satisfaction / Reward motivation audio tone synthesized on-device in real-time
  const playMotivationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Tone 1: High-pitched digital bell success layer
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.16); // G5
      osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.24); // C6
      osc1.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.32); // E6
      
      gain1.gain.setValueAtTime(0, audioCtx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      
      // Tone 2: Satisfying level-up synth pad to add thickness and feeling of warmth
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, audioCtx.currentTime); // C4
      osc2.frequency.setValueAtTime(329.63, audioCtx.currentTime + 0.08); // E4
      osc2.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.16); // G4
      osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime + 0.24); // C5
      
      gain2.gain.setValueAtTime(0, audioCtx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          audioCtx.close();
        } catch (e) {}
      }, 1200);
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  };

  // Secure OTP Matching & Delivery Handover
  const handleFinalDeliverySubmit = async () => {
    if (!checklist.locationConfirmed || !checklist.paymentCollected) {
      speakVoiceInstruction("कृपया डिलीवरी एड्रेस और पेमेंट कन्फर्मेशन दोनों पर सही टिक मार्क लगाएं।");
      return toast.error("Please confirm doorstep coordinates and cash collection first.");
    }

    if (!otpInput) {
      speakVoiceInstruction("कस्टमर का वेरीफिकेशन ओ टी पी दर्ज करें।");
      setOtpError(true);
      return toast.error("Enter secure OTP sent to customer.");
    }

    const expectedOtp = order.deliveryOtp;
    if (otpInput.trim() !== expectedOtp.trim()) {
      speakVoiceInstruction("ओ टी पी गलत है। कृपया कस्टमर से सही कोड दोबारा पूछें।");
      setOtpError(true);
      return toast.error("🔒 Incorrect OTP! Access and delivery authorized denied.");
    }

    setIsSubmitting(true);
    setOtpError(false);

    try {
      const idsToUpdate = [order.id];
      if (order.id.startsWith('c_') && !order.id.includes('_')) {
        const { data: sisterOrders } = await supabase
          .from('orders')
          .select('id')
          .ilike('id', `${order.id}_%`);
        if (sisterOrders && sisterOrders.length > 0) {
          idsToUpdate.push(...sisterOrders.map((s: any) => s.id));
        }
      }

      await supabase.from('orders').update({
        status: 'Delivered', 
        deliveredAt: new Date().toISOString() 
      }).in('id', idsToUpdate);

      setOtpVerified(true);
      speakVoiceInstruction(`बधाई हो! डिलीवरी ऑर्डर ${order.id?.slice(-5).toUpperCase()} सफलतापूर्वक समाप्त हो गया है।`);
      
      // Play satisfying success chime sound
      playMotivationChime();

      // Trigger triple grand pataka explosions!
      try {
        confetti({ particleCount: 90, spread: 60, origin: { x: 0.15, y: 0.75 } });
        confetti({ particleCount: 90, spread: 60, origin: { x: 0.85, y: 0.75 } });
        setTimeout(() => {
          confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 } });
        }, 320);
      } catch (ce) {}
      
      if (onComplete) {
        onComplete();
      }

      toast.success("🎉 Order Delivered Successfully! ₹25 added directly to Rider Wallet.");
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 2500);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      toast.error("Connection failed. Try again.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="fixed inset-0 z-[3000] bg-white flex flex-col font-sans text-stone-900 w-full h-full overflow-y-auto pb-10"
    >
      
      {/* Minimal Header with Back Button on Left */}
      <div className="bg-white border-b border-stone-200 py-3.5 px-4 flex items-center gap-3 sticky top-0 z-50">
        <button 
          type="button"
          onClick={onClose}
          className="p-2 -my-2 -ml-2 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-full transition-all active:scale-90 border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="stroke-[2.5]" />
        </button>
        <span className="text-[13px] font-black uppercase text-stone-800 tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#00C853] fill-[#00C853]" /> Rider Co-Pilot System
        </span>
      </div>

      {/* Main Delivery Checksheet & Finish Panel */}
      <div className="p-4.5 space-y-4">
        
        <div className="bg-white border border-stone-200 rounded-2xl p-4.5 space-y-4 text-left">
          
          {/* Customer Address Details Header */}
          <div className="flex justify-between items-start gap-3 border-b border-stone-200 pb-3">
            <div>
              <h4 className="text-[13px] font-black text-stone-900 mt-1 leading-tight">
                {order.customerName || 'Loyal Client'}
              </h4>
              <p className="text-[10px] text-stone-500 mt-0.5 whitespace-pre-wrap">
                {typeof order.address === 'object' ? (order.address?.address || '') : (order.address || '')}
              </p>
              {order.phone && (
                <p className="text-[9px] text-[#009624] font-bold mt-1 tracking-wider uppercase">
                  Phone: +91 {order.phone}
                </p>
              )}
            </div>

            {/* Navigation and Phone Call shortcuts */}
            <div className="flex gap-2 shrink-0">
              {order.phone && (
                <a
                  href={`tel:${order.phone}`}
                  className="p-2.5 bg-stone-100 hover:bg-stone-200 text-emerald-700 rounded-xl transition flex items-center justify-center border border-stone-200"
                >
                  <Phone size={14} />
                </a>
              )}

              <button
                onClick={() => {
                   const { lat: destinationLat, lng: destinationLng } = getDeliveryCoords();
                   console.log(`🛵 [CO-PILOT NAV] Opening maps for coordinates: ${destinationLat}, ${destinationLng}`);
                   const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}&travelmode=driving`;
                   // Using window.open with _system is the Capacitor native standard for opening in external apps (e.g. Google Maps) rather than inside the webview WebView
                   window.open(url, '_system');
                }}
                className="p-2.5 bg-[#00E676] hover:bg-[#00D069] text-white rounded-xl transition flex items-center justify-center border-0 shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                <Navigation size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Checklist of doorstep rules */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-2.5 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer hover:bg-stone-100">
              <input 
                type="checkbox"
                checked={checklist.locationConfirmed}
                onChange={(e) => setChecklist(prev => ({ ...prev, locationConfirmed: e.target.checked }))}
                className="w-4 h-4 rounded text-emerald-600 bg-white border-stone-300 accent-emerald-600 shrink-0 mt-0.5 cursor-pointer"
              />
              <div className="text-left font-sans">
                <p className="text-[10.5px] font-extrabold text-stone-850 leading-tight">GPS Doorstep Pin Match Confirmed</p>
                <p className="text-[8.5px] text-stone-500 mt-0.5">Verify house numbers, bells, signage before calling bell</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2.5 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer hover:bg-stone-100">
              <input 
                type="checkbox"
                checked={checklist.paymentCollected}
                onChange={(e) => setChecklist(prev => ({ ...prev, paymentCollected: e.target.checked }))}
                className="w-4 h-4 rounded text-emerald-600 bg-white border-stone-300 accent-emerald-600 shrink-0 mt-0.5 cursor-pointer"
              />
              <div className="text-left font-sans">
                <p className="text-[10.5px] font-extrabold text-stone-850 flex items-center gap-1 leading-tight">
                  Payment Collected (₹{order.totalAmount || order.amount})
                  {order.paymentMethod === 'Online' && <span className="text-[7.5px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 border border-emerald-200 rounded-sm">PAID</span>}
                </p>
                <p className="text-[8.5px] text-stone-500 mt-0.5">
                  {order.paymentMethod === 'Cash' 
                    ? "Keep cash change ready, receive total cash amount before package handover."
                    : "Verified digital online checkout system. Handover package without collecting cash."
                  }
                </p>
              </div>
            </label>
          </div>

          {/* High-security Verify Deliver with Secure OTP field */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left space-y-3.5">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Eye size={13} className="stroke-[2.5]" />
              <span className="text-[9px] font-black uppercase tracking-widest font-sans">Secure Verification Code</span>
            </div>

            <div className="space-y-2 font-sans">
              <div className="flex gap-2">
                <input
                  type="text"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOtpError(false);
                  }}
                  placeholder="Enter 6-Digit OTP (e.g. 154823)"
                  className={`flex-1 bg-white border ${otpError ? 'border-rose-500 focus:border-rose-455' : 'border-stone-200 focus:border-[#00C853]'} rounded-xl text-center font-mono text-[14px] font-black text-stone-800 px-3 py-3 tracking-[0.2em] outline-none transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-[10px] placeholder:font-normal select-text`}
                />

                <button
                  type="button"
                  disabled={isSubmitting || otpVerified}
                  onClick={handleFinalDeliverySubmit}
                  className="px-4.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 disabled:opacity-50 text-white font-black text-[9.5px] uppercase tracking-widest rounded-xl border-0 cursor-pointer flex items-center justify-center gap-1 transition-all"
                >
                  Verify & Finish
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}
