import React from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  ...props
}) => {
  const baseStyle = "font-black uppercase tracking-widest inline-flex items-center justify-center rounded-2xl transition-all duration-250 cursor-pointer border select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:shadow-lg shadow-md",
    secondary: "bg-white hover:bg-stone-50 text-stone-700 border-stone-200 shadow-sm",
    danger: "bg-red-650 hover:bg-red-600 text-white border-red-500 shadow-md",
    ghost: "bg-transparent text-stone-600 border-transparent hover:bg-stone-100",
    emerald: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[9px]",
    md: "px-5 py-3 text-[10.5px]",
    lg: "px-6 py-4 text-xs"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(props as any)}
    >
      {isLoading ? (
        <span className="flex items-center space-x-2">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processing...</span>
        </span>
      ) : children}
    </motion.button>
  );
};
