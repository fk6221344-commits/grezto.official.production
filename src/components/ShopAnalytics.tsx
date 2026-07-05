import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

export default function ShopAnalytics({ orders, shopId }: { orders: any[], shopId: string }) {
  const chartData = useMemo(() => {
    // Generate last 7 days
    const days = Array.from({ length: 7 }).map((_, i) => {
      return format(subDays(new Date(), 6 - i), 'MMM dd');
    });

    const dataMap: Record<string, number> = {};
    days.forEach(day => dataMap[day] = 0);

    orders.forEach(order => {
      // Only count completed/delivered orders, or any order based on requirement. Let's say all orders, or only 'Delivered'.
      // If we want total revenue for the shop
      if (order.status !== 'Delivered') return;

      const orderDate = new Date(order.timestamp || Date.now());
      const dayKey = format(orderDate, 'MMM dd');
      
      if (dataMap[dayKey] !== undefined) {
        // Calculate the revenue for this specific shop from this order
        let orderShopRevenue = 0;
        const items = order.items || order.fullItems;
        if (items) {
           items.forEach((item: any) => {
             if (item.shopId === shopId || item.productShopId === shopId) {
               orderShopRevenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
             }
           });
        }
        dataMap[dayKey] += orderShopRevenue;
      }
    });

    return days.map(day => ({
      name: day,
      revenue: dataMap[day]
    }));
  }, [orders, shopId]);

  return (
    <div className="-mx-5 bg-white border-y border-slate-150 p-4 shadow-sm space-y-3 rounded-none">
      <div>
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">Shop Analytics</h3>
        <p className="text-[9px] text-slate-400 font-medium">Sales trends over the last 7 days</p>
      </div>
      
      <div className="h-44 mt-2 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="5 5" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} dx={-5} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
              labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
