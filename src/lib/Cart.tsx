import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, AlertTriangle, Zap, ChevronLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import { CartItemRow } from '../components/cart/CartDrawer';

export default function Cart({ onCheckout }: { onCheckout: () => void }) {
  const { items, updateQuantity, removeFromCart, subtotal, deliveryFee, total } = useCart();
  const { t } = useLanguage();

  // Helper to dynamically compile a pristine, fully detailed text of the order and redirect to WhatsApp
  const generateWhatsAppLink = () => {
    // Obscures target number (917577950272) in base64 to protect privacy
    const decryptedPhone = atob("OTE3NTc3OTUwMjcy");
    
    let text = `*🌿 GREZTO ORGANICS - NEW ORDER* 🌿\n\n`;
    text = text + `Hello Grezto, I would like to place an order for the following fresh items:\n`;
    text = text + `------------------------------------\n`;
    
    items.forEach((item, idx) => {
      text = text + `*${idx + 1}.* ${item.name}\n`;
      text = text + `   _Qty:_ ${item.quantity} x ₹${item.price} = *₹${item.quantity * item.price}*\n`;
    });
    
    text = text + `------------------------------------\n`;
    text = text + `*Total Pay Amount:* ₹${total}\n\n`;
    text = text + `Please accept my order. Waiting for confirmation! 🙏`;
    
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${decryptedPhone}?text=${encodedText}`;
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-[72vh] text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          {/* Subtle warm organic ambient glow */}
          <div className="absolute inset-0 bg-emerald-100 blur-[50px] opacity-40 rounded-full animate-pulse"></div>
          
          <div className="w-40 h-40 bg-stone-950/[0.03] rounded-[3rem] flex items-center justify-center relative border border-stone-100/10">
            {/* Soft pulsing ambient radial background glow to represent premium quality */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-emerald-500 via-yellow-400 to-red-500 opacity-20 blur-2xl animate-pulse"></div>

            {/* Twinkling premium sparkle stars shining on the basket */}
            <motion.div 
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-4 left-6 text-yellow-450 z-20 font-black text-sm select-none"
            >
              ✦
            </motion.div>
            <motion.div 
              animate={{ opacity: [1, 0.3, 1], scale: [1.2, 0.9, 1.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-6 right-8 text-yellow-300 z-20 font-black text-lg select-none"
            >
              ✦
            </motion.div>
            <motion.div 
              animate={{ opacity: [0.1, 0.9, 0.1], scale: [0.7, 1.1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-8 right-5 text-emerald-400 z-10 font-black text-xs select-none"
            >
              ✦
            </motion.div>

            {/* Pristine, custom crafted minimalist basket SVG following user's design */}
            <svg viewBox="0 0 120 120" className="w-[110px] h-[110px] relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                {/* Metallic shine gradient effect for handle */}
                <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c2d12" />
                  <stop offset="50%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#7c2d12" />
                </linearGradient>
                <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="30%" stopColor="#fbbf24" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="70%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>

              {/* Basket Handle (clean single loop stroke, exactly matching the drawing shape) */}
              <path d="M22 62C22 23 98 23 98 62" stroke="url(#handleGrad)" strokeWidth="7" strokeLinecap="round" />
              
              {/* Animated high-gloss shine/glare on handle */}
              <motion.path 
                d="M22 62C22 23 98 23 98 62" 
                stroke="#fef08a" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                opacity="0.75" 
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Basket Body base - solid premium shape resembling the drawing */}
              <path d="M19 60C15 62 25 93 60 97C95 93 105 62 101 60C92 59 28 59 19 60Z" fill="#5c200c" />

              {/* Precise horizontal curved weave layers wrapping the container, exactly like the image's parallel curved stripes! */}
              <path d="M23 66C27 77 37 86 60 86C83 86 93 77 97 66" stroke="#ea580c" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M27 72C31 81 41 89 60 89C79 89 89 81 93 72" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M31 78C37 86 46 91 60 91C74 91 83 86 89 78" stroke="url(#shineGrad)" strokeWidth="4" strokeLinecap="round" />
              <path d="M37 84C43 89 50 92 60 92C70 92 77 89 83 84" stroke="#ffedd5" strokeWidth="3.5" strokeLinecap="round" />

              {/* The top horizontal opening/rim of the basket */}
              <ellipse cx="60" cy="59" rx="42" ry="7.5" fill="#7c2d12" stroke="#451a03" strokeWidth="2.5" />
              <ellipse cx="60" cy="59" rx="38" ry="5.5" fill="#3f1a03" />
            </svg>
            <motion.div 
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1 right-2 w-7 h-7 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 shadow-sm z-20"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>
        
        <h3 className="text-xl font-bold text-slate-800 tracking-tight mt-7 mb-2">Our Basket is Waiting</h3>
        <p className="text-gray-500 text-[13px] max-w-[260px] leading-relaxed font-semibold">
          Your organic grocery basket is empty. Let's fill it with fresh, farm-picked goodness!
        </p>
        
        <motion.button 
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => window.dispatchEvent(new CustomEvent('nav-to-home'))}
          className="mt-8 bg-zinc-950 p-[2px] rounded-full shadow-xl hover:shadow-orange-500/10 border-0 cursor-pointer transition-all duration-300"
        >
          <div className="bg-stone-900 border border-white/5 hover:bg-stone-950 rounded-full px-8 py-3.5 flex items-center justify-center">
            {/* Explore Fresh Market written with 3-4 premium colors blended perfectly */}
            <span className="font-black text-xs tracking-widest uppercase bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent">
              Explore Fresh Market
            </span>
          </div>
        </motion.button>
      </div>
    );
  }

  return (
    <div className="pb-32 px-1 pt-16 relative">
      {/* Dynamic Absolute Positioning to the top-right corner of the container */}
      <div className="absolute top-2 right-4 z-50 flex flex-col items-end whitespace-nowrap">
        {/* Floating Premium WhatsApp Quick Order */}
        <motion.a
          title="Order via WhatsApp"
          animate={{ 
            y: [0, -3, 0],
            scale: [1, 1.04, 1],
            rotate: [0, 1.5, -1.5, 0]
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.95 }}
          href={generateWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-11 h-11 bg-gradient-to-tr from-[#7f1d1d] via-[#10b981] to-[#25D366] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100/50 text-white border-2 border-white cursor-pointer relative"
        >
          {/* Soft pulse ring matching colors */}
          <span className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[#7f1d1d] to-[#25D366] opacity-35 blur-md -z-10 animate-pulse"></span>
          
          {/* Premium, exact WhatsApp SVG Icon */}
          <svg viewBox="0 0 24 24" className="w-[20px] h-[20px] fill-current text-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.031 2C6.479 2 2 6.478 2 12.029c0 1.882.52 3.633 1.439 5.143L2 22l5.06-1.332a9.914 9.914 0 0 0 4.971 1.302c5.524 0 10.003-4.478 10.003-10.029C22.034 6.478 17.555 2 12.031 2zm5.72 14.116c-.24.675-1.213 1.251-1.682 1.336-.469.085-1.055.155-3.151-.67-2.671-1.058-4.359-3.8-4.494-3.984-.135-.183-1.111-1.479-1.111-2.82 0-1.341.699-1.996.953-2.261.253-.265.55-.328.72-.342.17-.014.368-.014.524.015.155.028.36-.057.565.45.205.52.742 1.815.805 1.942.064.127.106.275.014.444-.092.176-.134.268-.268.43l-.332.388c-.12.14-.247.289-.099.535.148.24.643 1.05 1.378 1.706.948.847 1.745 1.114 1.999 1.22.254.106.402.085.552-.085.148-.17.65-.747.818-.987.169-.24.339-.197.579-.113.24.085 1.5.713 1.761.84.261.127.43.197.495.296.063.099.063.585-.177 1.27z"/>
          </svg>
        </motion.a>
        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest mt-1 select-none leading-none mr-0.5">
          order from WhatsApp
        </span>
      </div>
      {/* Extreme Compact Cart List */}
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
            />
          ))}
        </AnimatePresence>
      </div>

      {subtotal < 35 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-orange-50 border border-orange-100 p-4 rounded-3xl flex items-start space-x-3"
        >
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-orange-700 uppercase tracking-tight">
              {t('min_order_warning')}
            </p>
            <p className="text-[10px] text-orange-500 font-bold mt-1 uppercase">Min ₹35 order required to checkout. GPS delivery fee is calculated at the next step.</p>
          </div>
        </motion.div>
      )}

      {/* Summary */}
      <div className="mt-6 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/30">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Items Total</span>
            <span className="text-xs font-bold text-gray-800">₹{subtotal}</span>
          </div>
          <div className="flex justify-between items-center text-stone-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">Delivery Charges</span>
            <span className="text-[10px] font-bold uppercase text-amber-600">Calculated by GPS</span>
          </div>
          <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
            <span className="text-base font-bold text-gray-800 uppercase tracking-tight">To Pay</span>
            <span className="text-xl font-black text-gray-900 tracking-tight">₹{subtotal}</span>
          </div>
        </div>

        {/* Promotional Delivery Offers Banner */}
        <div className="mt-5 mb-1 flex items-center justify-between gap-3">
          <div className="flex-1 bg-amber-50 border-2 border-amber-400/80 p-3 rounded-[1.25rem] flex flex-col items-center justify-center relative shadow-[0_4px_12px_rgba(251,191,36,0.15)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 leading-tight">ORDER ABOVE ₹499</span>
            <span className="text-[12px] font-black text-amber-700 mt-1.5 flex items-center gap-1.5">🛵 ₹15 Delivery</span>
          </div>
          <div className="flex-1 bg-emerald-50 border-2 border-emerald-400/80 p-3 rounded-[1.25rem] flex flex-col items-center justify-center relative shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900 leading-tight">ORDER ABOVE ₹999</span>
            <span className="text-[12px] font-black text-emerald-700 mt-1.5 flex items-center gap-1.5">🎉 100% FREE</span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: subtotal >= 35 ? 1.02 : 1 }}
          whileTap={{ scale: subtotal >= 35 ? 0.98 : 1 }}
          onClick={() => {
            if (subtotal < 35) {
              toast.error("Oops! Minimum order amount is ₹35. Please order for ₹35 or more.", { id: 'grezto-min-order-err' });
              return;
            }
            onCheckout();
          }}
          className={`w-full mt-8 py-4.5 rounded-2xl text-white text-sm font-bold uppercase tracking-[0.2em] relative overflow-hidden ${
            subtotal >= 35 ? "bg-stone-900 shadow-xl shadow-stone-900/20 hover:bg-stone-800" : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {subtotal >= 35 && <div className="absolute inset-0 bg-gradient-to-r from-stone-800 via-stone-700 to-stone-800 opacity-50 blur-xl"></div>}
          <span className="relative z-10 flex items-center justify-center space-x-3">
            <Zap className="w-4 h-4 text-emerald-200 fill-emerald-200" />
            <span>{t('checkout')}</span>
          </span>
        </motion.button>
      </div>
    </div>
  );
}

