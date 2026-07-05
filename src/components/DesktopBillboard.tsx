import React from 'react';

/**
 * Beautiful Left Landing Billboard for Desktop resolutions.
 * Showcases Grezto branding, bento grid organic features, and local Assam stats.
 */
export function DesktopBillboard() {
  return (
    <div className="hidden lg:flex flex-col justify-between max-w-[460px] h-full py-10 text-white font-sans shrink-1 select-none">
      <div className="space-y-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-13 h-13 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-[0_15px_30px_rgba(16,185,129,0.35)] border border-emerald-400">
            <span className="text-2xl">🌿</span>
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest leading-none bg-gradient-to-r from-emerald-100 to-emerald-400 bg-clip-text text-transparent">
              Grezto
            </h1>
            <span className="text-[9.5px] text-emerald-300 font-extrabold uppercase tracking-widest block mt-1.5 leading-none">
              Guwahati's Organic Web Hub
            </span>
          </div>
        </div>

        <div className="space-y-4 pt-8">
          <h2 className="text-4xl font-black leading-[1.125] tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-200 bg-clip-text text-transparent italic">
            Pure Farms.<br />Minutes Dispatch.
          </h2>
          <p className="text-xs text-emerald-100/70 leading-relaxed font-bold">
            Guwahati's most premium 30-minute organic vegetable and farm supply platform is now easily accessible live on the web!
          </p>
          <p className="text-xs text-emerald-100/50 leading-relaxed font-medium">
            Add fresh vegetables and organic products to your cart, set live real-time GPS coordinates, and complete safe order simulations!
          </p>
        </div>
      </div>

      {/* Bento Grid highlighting dynamic features */}
      <div className="grid grid-cols-2 gap-3.5 my-6">
        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] space-y-2 group hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all duration-300">
          <span className="text-xl">🥬</span>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-400">100% Organic</h4>
          <p className="text-[10px] text-emerald-100/55 leading-snug font-medium">
            Certified source pure village produce.
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] space-y-2 group hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all duration-300">
          <span className="text-xl">⚡</span>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-500">30 Min Delivery</h4>
          <p className="text-[10px] text-emerald-100/55 leading-snug font-medium">
            Doorstep express hub transit.
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] space-y-2 group hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all duration-300">
          <span className="text-xl">🛰️</span>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-sky-400">GPS tracking</h4>
          <p className="text-[10px] text-emerald-100/55 leading-snug font-medium">
            Track rider paths with active simulation.
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] space-y-2 group hover:bg-emerald-500/[0.05] hover:border-emerald-500/20 transition-all duration-300">
          <span className="text-xl">💬</span>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-500">Gemini AI</h4>
          <p className="text-[10px] text-emerald-100/55 leading-snug font-medium">
            Smart AI shopping chatbot right inside.
          </p>
        </div>
      </div>

      {/* Dynamic Live Trust Statistics Footer bar */}
      <div className="flex items-center justify-between border-t border-white/10 pt-6">
        <div>
          <p className="text-xl font-black tracking-tight text-white/95">★ 4.9</p>
          <p className="text-[8.5px] text-emerald-300 font-black uppercase tracking-widest mt-0.5">Average Rating</p>
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-white/95">25k+</p>
          <p className="text-[8.5px] text-emerald-300 font-black uppercase tracking-widest mt-0.5">Assam Families</p>
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-white/95">100%</p>
          <p className="text-[8.5px] text-emerald-300 font-black uppercase tracking-widest mt-0.5">Farm Sourced</p>
        </div>
      </div>
    </div>
  );
}
