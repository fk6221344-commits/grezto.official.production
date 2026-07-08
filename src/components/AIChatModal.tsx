import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, ShieldCheck, Clock } from 'lucide-react';
import { useRegisterBackHandler } from '../hooks/useRegisterBackHandler';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  // Catch native back button to close the help & support modal cleanly
  useRegisterBackHandler(() => {
    if (isOpen) {
      onClose();
      return true;
    }
    return false;
  }, 50, [isOpen, onClose]);

  // WhatsApp Support State
  const [supportMessage, setSupportMessage] = useState('');

  const handleWhatsAppChat = () => {
    const defaultText = `*🌿 GREZTO CARE HELP & SUPPORT* 🌿\n\nHello Grezto Team, I need help with my Grezto experience. Please assist me!`;
    const userText = supportMessage.trim() 
      ? `*🌿 GREZTO CARE HELP & SUPPORT* 🌿\n\n*My Message:* ${supportMessage.trim()}\n\nPlease help me resolve this issue as soon as possible. Thank you!`
      : defaultText;
    
    const encodedText = encodeURIComponent(userText);
    const whatsappUrl = `https://wa.me/917577950272?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-5"
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] h-[80vh] sm:h-[70vh] flex flex-col relative z-[110] shadow-2xl overflow-hidden text-display"
          >
            {/* Header with Deep Burgundy Gradient */}
            <div className="bg-gradient-to-r from-[#2a0812] via-[#1a040b] to-[#0c0104] p-5 pb-6 flex items-center justify-between shadow-md text-white relative">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative shadow-inner">
                  <Heart className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1a040b] animate-pulse"></div>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Grezto Care</h3>
                  <p className="text-[7.5px] font-black text-stone-300 uppercase tracking-widest mt-0.5">Always there to support you 🤝</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all border-0 cursor-pointer"
              >
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pt-6 pb-5 px-6 flex flex-col bg-white">
              <div className="flex flex-col flex-1 gap-5">
                <div className="text-center">
                  <p className="text-[9.5px] font-black text-emerald-600 uppercase tracking-widest">✨ Happiness Guarantee</p>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight mt-1">
                    How can we help you today? 🙌
                  </h4>
                </div>

                {/* Informational Card */}
                <div className="bg-slate-50/75 border border-slate-100 rounded-3xl p-5 text-center flex flex-col items-center gap-3.5 shadow-xs">
                  <p className="text-gray-600 text-[10.5px] font-bold leading-relaxed">
                    At <span className="text-emerald-600 font-black">Grezto Organics</span>, we treat you like family! Your satisfaction is our absolute priority. If you face any issues with your order, payment, delivery, or if you simply want to share some feedback, we are here to make things perfect.
                  </p>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-[#0d5c4b] px-4 py-1.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border border-emerald-100/50">
                    <span>🌿</span> We usually reply in less than 5 minutes!
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-800 leading-none uppercase tracking-wider">100% Safe</p>
                      <p className="text-[7.5px] text-gray-400 font-extrabold mt-1 uppercase tracking-wider leading-none">Secure Support</p>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-800 leading-none uppercase tracking-wider">Support Hours</p>
                      <p className="text-[7.5px] text-gray-400 font-extrabold mt-1 uppercase tracking-wider leading-none">6 AM - 10 PM</p>
                    </div>
                  </div>
                </div>

                {/* Input and Call-to-Action */}
                <div className="mt-auto flex flex-col gap-4 bg-slate-50/40 border border-slate-100 rounded-3xl p-5 text-center">
                  <div>
                    <p className="text-[8.5px] font-black text-emerald-600 uppercase tracking-widest">Instant Resolution</p>
                    <h5 className="text-[11px] font-black text-gray-800 uppercase tracking-wider mt-1 flex items-center justify-center gap-1.5">
                      Connect Directly with Grezto Team 💬
                    </h5>
                  </div>

                  {/* WhatsApp Button */}
                  <button 
                    onClick={handleWhatsAppChat}
                    className="w-full bg-[#0d5c4b] hover:bg-[#0a483a] text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-100/50 active:scale-[0.99] border-0"
                  >
                    <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] fill-current text-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.031 2C6.479 2 2 6.478 2 12.029c0 1.882.52 3.633 1.439 5.143L2 22l5.06-1.332a9.914 9.914 0 0 0 4.971 1.302c5.524 0 10.003-4.478 10.003-10.029C22.034 6.478 17.555 2 12.031 2zm5.72 14.116c-.24.675-1.213 1.251-1.682 1.336-.469.085-1.055.155-3.151-.67-2.671-1.058-4.359-3.8-4.494-3.984-.135-.183-1.111-1.479-1.111-2.82 0-1.341.699-1.996.953-2.261.253-.265.55-.328.72-.342.17-.014.368-.014.524.015.155.028.36-.057.565.45.205.52.742 1.815.805 1.942.064.127.106.275.014.444-.092.176-.134.268-.268.43l-.332.388c-.12.14-.247.289-.099.535.148.24.643 1.05 1.378 1.706.948.847 1.745 1.114 1.999 1.22.254.106.402.085.552-.085.148-.17.65-.747.818-.987.169-.24.339-.197.579-.113.24.085 1.5.713 1.761.84.261.127.43.197.495.296.063.099.063.585-.177 1.27z"/>
                    </svg>
                    <span>Chat on WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
