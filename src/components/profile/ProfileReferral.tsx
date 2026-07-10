import React from 'react';
import { Share2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileReferralProps {
  user: any;
}

export default function ProfileReferral({ user }: ProfileReferralProps) {
  return (
    <div className="px-1 pt-2.5">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-2.5 rounded-xl text-white shadow-xs relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <p className="text-[8.5px] text-emerald-50 font-extrabold leading-tight tracking-wide text-left">
            share Grezto with friends.. to get upto 20% off 🎉 your next order
          </p>

          <div className="bg-black/20 p-2 rounded-lg flex items-center justify-center border border-white/5 font-sans mt-1">
            <span className="text-[8.5px] font-extrabold tracking-widest text-[#d1fae5] font-mono">
              CODE: {user.phone ? `GREZ${user.phone.slice(-4)}` : 'GREZ100'}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 pt-0.5">
            <button 
              onClick={async () => {
                const uPhoneSuffix = user.phone ? user.phone.slice(-4) : '100';
                const refCode = `GREZ${uPhoneSuffix}`;
                const refUrl = `${window.location.origin}/?download=grezto-app&ref=${refCode}`;
                const text = `*Grezto - 100% Fresh & Organic Grocery* 🥬🚀\n\nClick the invite link to safely download the Grezto Android App and instantly receive an upto 20% discount coupon!\n\n👉 *Click here to Download:* ${refUrl}\n\nCode: *${refCode}* 🌿🎁`;
                try {
                  const { Share } = await import('@capacitor/share');
                  const { Capacitor } = await import('@capacitor/core');
                  if (Capacitor.isNativePlatform()) {
                     await Share.share({ title: 'Grezto App', text: text });
                     return;
                  }
                } catch(e) {}
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                toast.success("Opening WhatsApp... 📲");
              }}
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-[7.5px] uppercase tracking-wider py-1 px-2 rounded-md flex items-center justify-center gap-1 transition-all border-0 cursor-pointer shadow-2xs"
            >
              <Share2 className="w-2.5 h-2.5 text-white" />
              WhatsApp
            </button>
            <button 
              onClick={async () => {
                const uPhoneSuffix = user.phone ? user.phone.slice(-4) : '100';
                const refCode = `GREZ${uPhoneSuffix}`;
                const refUrl = `${window.location.origin}/?download=grezto-app&ref=${refCode}`;
                const text = `Grezto - 100% Fresh & Organic Grocery 🥬🚀\n\nClick the invite link to safely download the Grezto Android App and instantly receive an upto 20% discount coupon!\n\nCode: ${refCode} 🌿🎁`;
                try {
                  const { Share } = await import('@capacitor/share');
                  const { Capacitor } = await import('@capacitor/core');
                  if (Capacitor.isNativePlatform()) {
                     await Share.share({ title: 'Grezto App', text: text, url: refUrl });
                     return;
                  }
                } catch(e) {}
                window.open(`https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent(text)}`, '_blank');
                toast.success("Opening Telegram... ✈️");
              }}
              className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-[7.5px] uppercase tracking-wider py-1 px-2 rounded-md flex items-center justify-center gap-1 transition-all border-0 cursor-pointer shadow-2xs"
            >
              <Send className="w-2.5 h-2.5 text-white" />
              Telegram
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
