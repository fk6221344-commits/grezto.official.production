import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Bike, MapPin } from 'lucide-react';
import SwipeButton from './SwipeButton';

interface RiderAssignmentOverlayProps {
  globalIncomingRiderOrders: any[];
  globalRiderProfile: any;
  onAccept: (orderId: string) => void;
}

export default function RiderAssignmentOverlay({
  globalIncomingRiderOrders,
  globalRiderProfile,
  onAccept
}: RiderAssignmentOverlayProps) {
  const hasIncoming = globalIncomingRiderOrders.length > 0 && globalRiderProfile?.status === 'Online';
  const currentIncoming = globalIncomingRiderOrders[0];

  const [secondsLeft, setSecondsLeft] = React.useState(60);

  const isUrgent = secondsLeft <= 30;
  const timerCircleColor = isUrgent ? '#ef4444' : '#22c55e';

  React.useEffect(() => {
    if (!currentIncoming) return;
    const calculateSecondsLeft = () => {
      if (currentIncoming.assignedAt) {
        const assignedTime = new Date(currentIncoming.assignedAt).getTime();
        const diff = (Date.now() - assignedTime) / 1000;
        return Math.max(0, 60 - diff);
      }
      return 60;
    };

    setSecondsLeft(calculateSecondsLeft());

    let timerFired = false;
    const interval = setInterval(async () => {
      const left = calculateSecondsLeft();
      setSecondsLeft(left);
      
      if (left <= 0 && !timerFired) {
        timerFired = true;
        clearInterval(interval);
        try {
          const { supabase } = await import('../services/supabase');
          const updateData = { 
            status: "Packed",
            partnerPhone: null,
            partnerName: null,
            riderAccepted: false,
            assignedAt: null as any,
            deliveryOtp: null as any
          };
          await supabase.from('orders').update(updateData).eq('id', currentIncoming.id);
        } catch (e) {
          console.warn("Could not auto-reset assignment from rider overlay:", e);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentIncoming]);

  return (
    <AnimatePresence>
      {hasIncoming && currentIncoming && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md text-white flex flex-col justify-between p-8 text-center font-sans select-none animate-fade-in">
          {/* Visual pulse rings */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-transparent to-transparent opacity-40 pointer-events-none" />
          
          {/* Pulsing Header */}
          <div className="mt-12 space-y-4 relative z-10 flex flex-col items-center">
            <div className="w-[120px] h-[120px] bg-slate-900 rounded-full flex items-center justify-center mx-auto shadow-2xl relative border-4 border-slate-800/80">
              <span className="absolute inset-x-0 inset-y-0 bg-emerald-500/10 rounded-full animate-ping scale-[1.3] pointer-events-none" />
              
              {/* Animated Countdown SVG Circular Progress Track */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
                <circle
                  cx="58"
                  cy="58"
                  r="48"
                  className="stroke-slate-850"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="58"
                  cy="58"
                  r="48"
                  className="transition-[stroke-dashoffset,stroke] duration-[30ms,500ms] ease-linear"
                  style={{ stroke: timerCircleColor }}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - secondsLeft / 60)}
                  strokeLinecap="round"
                />
              </svg>

              {/* Inside content: Bouncing Bike & Countdown Numbers */}
              <div className="relative z-10 flex flex-col items-center justify-center font-sans">
                <Bike className="w-8 h-8 stroke-[2.5] mb-0.5 animate-bounce transition-colors duration-500" style={{ color: timerCircleColor }} />
                <span className="text-sm font-black text-white font-mono leading-none tracking-tight">{Math.ceil(secondsLeft)}s</span>
              </div>
            </div>
            
            <div className="text-center font-sans">
              <span className="text-[10px] bg-gradient-to-r from-amber-600 via-red-800 to-amber-700 text-amber-50 border border-amber-500/20 px-4 py-1.5 font-black rounded-full uppercase tracking-widest animate-pulse inline-block shadow-md">
                ⚡ INCOMING ASSIGNMENT
              </span>
              <h2 className="text-xl font-black mt-3 capitalize tracking-tight leading-none text-slate-100">
                New Order Dispatch Alert
              </h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1">
                Rider alarm trigger: Ringing... <span className="inline-block animate-bounce">🔊</span>
              </p>
            </div>
          </div>

          {/* Middle order details */}
          {(() => {
            const currentIncoming = globalIncomingRiderOrders[0];
            const orderItems = currentIncoming.items || currentIncoming.fullItems || [];
            const itemsCount = orderItems.length > 0 
              ? orderItems.length 
              : (currentIncoming.items && currentIncoming.items.length > 0 ? currentIncoming.items.length : 1);
            return (
              <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 p-6 rounded-[2rem] space-y-4 shadow-xl text-left relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8.5px] bg-white/10 text-white/80 px-2 py-0.5 rounded border border-white/10 font-bold">
                      #{currentIncoming.id?.slice(-5).toUpperCase()}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1.5">{currentIncoming.customerName || 'Loyal Client'}</h4>
                  </div>
                  <div className="text-right font-sans">
                    <span className="text-[8.5px] block font-black uppercase text-white/40">PAYOUT FEE</span>
                    <span className="text-base font-black text-emerald-400 font-mono">₹25.00</span>
                  </div>
                </div>

                <div className="h-px bg-slate-800/80" />

                {/* Address */}
                <div className="flex items-start gap-2 text-[10.5px]">
                  <MapPin className="text-rose-500 shrink-0 mt-0.5" size={13} />
                  <div>
                    <p className="font-extrabold text-slate-150 leading-tight">
                      {typeof currentIncoming.address === 'object' 
                        ? (currentIncoming.address?.address || 'Kawarhagi Delivery Route') 
                        : (currentIncoming.address || 'Kawarhagi Delivery Route')}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-1 border-t border-dashed border-slate-800">
                  <span>Package containing {itemsCount} order list items</span>
                  <span>COD: ₹{currentIncoming.totalAmount || currentIncoming.amount}</span>
                </div>
              </div>
            );
          })()}

          {/* Swipe area at bottom */}
          <div className="mb-12 space-y-4 relative z-10 w-full max-w-sm mx-auto flex flex-col items-center">
            <SwipeButton key={globalIncomingRiderOrders[0].id} onAccept={() => onAccept(globalIncomingRiderOrders[0].id)} />
            <p className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
              🔒 Slide right to lock job on your portal
            </p>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
