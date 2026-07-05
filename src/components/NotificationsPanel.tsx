import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

interface NotificationsPanelProps {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const notifications = [
    { id: 1, title: 'New Order Received', msg: 'Order #GRZT-882 awaits preparation', time: '2m ago' },
    { id: 2, title: 'Inventory Alert', msg: 'Fresh Tomatoes are low in stock', time: '1h ago' },
    { id: 3, title: 'System Update', msg: 'Grezto Admin Panel v2.0 is now live', time: '3h ago' },
  ];

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[400] bg-white p-8 flex flex-col font-sans"
    >
      <div className="flex items-center justify-between mb-10">
        <button onClick={onClose} className="p-3 bg-gray-50 rounded-2xl border-none cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Notifications</h3>
        <div className="w-10"></div>
      </div>

      <div className="space-y-4">
        {notifications.map(n => (
          <div key={n.id} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 relative overflow-hidden group hover:bg-white transition-all hover:shadow-xl hover:shadow-gray-100 text-left">
             <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
             <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{n.title}</p>
             <p className="text-sm font-bold text-gray-800 mb-2">{n.msg}</p>
             <p className="text-[9px] text-gray-400 font-medium uppercase">{n.time}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
