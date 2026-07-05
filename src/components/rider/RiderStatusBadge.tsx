import React from 'react';

export const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { bg: string, text: string, border: string }> = {
    'Out for Delivery': { bg: 'bg-indigo-50/70', text: 'text-indigo-600', border: 'border-indigo-100' },
    'Delivered': { bg: 'bg-emerald-50/70', text: 'text-emerald-600', border: 'border-emerald-100' },
    'Cancelled': { bg: 'bg-rose-50/70', text: 'text-rose-600', border: 'border-rose-100' }
  };
  const config = configs[status] || { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100' };
  return (
    <span className={`text-[8.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${config.bg} ${config.border} ${config.text}`}>
      {status}
    </span>
  );
};
