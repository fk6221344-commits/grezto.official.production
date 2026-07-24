import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Gift, Truck, ChevronRight } from 'lucide-react';

export interface PromoPayload {
  enabled: boolean;
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  image?: string;
  buttonText?: string;
  discountCode?: string;
}

interface PromoAnnouncementModalProps {
  onApplyOffer?: (code: string) => void;
}

export default function PromoAnnouncementModal({ onApplyOffer }: PromoAnnouncementModalProps) {
  const [promoData, setPromoData] = useState<PromoPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkPromoAnnouncement = async () => {
      try {
        // Fetch OTA & Dynamic Announcement from Railway API or local fallback
        const apiUrl = 'https://api.grezto.com/api/app-update-info';
        const res = await fetch(apiUrl, { cache: 'no-store' }).catch(() => null);
        
        let data: any = null;
        if (res && res.ok) {
          data = await res.json().catch(() => null);
        }

        // Fallback default promo if server is offline
        const activePromo: PromoPayload = data?.activePromoPopup || {
          enabled: true,
          id: 'promo_first_order_free_v1',
          title: 'FIRST ORDER FREE DELIVERY 🚚🎉',
          subtitle: 'Welcome to Grezto! Enjoy ₹0 Delivery Fee on your very first order today.',
          badgeText: 'LIMITED TIME OFFER',
          image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&auto=format&fit=crop&q=80',
          buttonText: 'CLAIM FREE DELIVERY 🚀',
          discountCode: 'FIRSTFREE'
        };

        if (activePromo && activePromo.enabled) {
          const dismissedId = sessionStorage.getItem('grezto_dismissed_promo');
          if (dismissedId !== activePromo.id) {
            setPromoData(activePromo);
            // Delay 1.2s after splash/launch for max visual impact
            setTimeout(() => {
              setIsOpen(true);
            }, 1200);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch promo announcement:', e);
      }
    };

    checkPromoAnnouncement();
  }, []);

  const handleClose = () => {
    if (promoData) {
      sessionStorage.setItem('grezto_dismissed_promo', promoData.id);
    }
    setIsOpen(false);
  };

  const handleClaim = () => {
    if (promoData?.discountCode && onApplyOffer) {
      onApplyOffer(promoData.discountCode);
    }
    handleClose();
  };

  if (!isOpen || !promoData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden"
        >
          {/* Top Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/60 text-stone-300 hover:text-white border border-white/10 flex items-center justify-center backdrop-blur-md active:scale-90 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top Graphic / Image Header */}
          <div className="relative h-44 w-full bg-gradient-to-tr from-amber-600 via-orange-600 to-amber-500 overflow-hidden">
            {promoData.image ? (
              <img
                src={promoData.image}
                alt="Promo Banner"
                className="w-full h-full object-cover opacity-85 mix-blend-overlay"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-amber-600 to-orange-500">
                <Truck className="w-20 h-20 text-white/30 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-black/30" />

            {/* Badge Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-lg border border-amber-300/40">
              <Sparkles className="w-3 h-3 text-stone-950 fill-current animate-spin" />
              <span>{promoData.badgeText || 'SPECIAL OFFER'}</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1 shadow-inner">
              <Gift className="w-6 h-6 text-amber-400 animate-bounce" />
            </div>

            <h3 className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 bg-clip-text text-transparent leading-tight">
              {promoData.title}
            </h3>

            <p className="text-xs text-stone-300 font-medium leading-relaxed px-2">
              {promoData.subtitle}
            </p>

            {/* CTA Action Button */}
            <div className="pt-2">
              <button
                onClick={handleClaim}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>{promoData.buttonText || 'CLAIM FREE DELIVERY 🚀'}</span>
                <ChevronRight className="w-4 h-4 text-stone-950" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
