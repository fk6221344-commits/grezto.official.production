import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-4.5 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-gray-50 text-stone-900 placeholder:text-gray-400 text-sm font-semibold rounded-[1.25rem] border transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
            icon ? 'pl-11.5' : 'pl-5'
          } ${error ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-200 focus:border-emerald-500'} py-3.5 ${className}`}
          {...props}
        />
      </div>
      {error && (
        <span className="text-[9.5px] text-red-550 font-semibold tracking-tight pl-1">
          {error}
        </span>
      )}
    </div>
  );
};
