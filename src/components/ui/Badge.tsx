import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'red' | 'blue' | 'stone' | 'purple';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'stone',
  className = ''
}) => {
  const baseStyle = "text-[8.5px] font-black uppercase px-2.5 py-1 rounded-xl tracking-widest border shrink-0 inline-block text-center";
  
  const variants = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-650 border-red-100",
    blue: "bg-blue-50 text-blue-705 border-blue-105",
    stone: "bg-stone-50 text-stone-700 border-stone-200",
    purple: "bg-purple-50 text-purple-700 border-purple-100"
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
