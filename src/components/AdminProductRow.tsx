import React from 'react';
import { motion } from 'motion/react';
import { Edit, Package, Trash2, AlertTriangle } from 'lucide-react';

interface ProductAdminRowProps {
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  onToggleStock: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export const ProductAdminRow = React.memo(({ name, price, stock, imageUrl, onToggleStock, onDelete, onEdit }: ProductAdminRowProps) => {
  const numStock = typeof stock === 'number' ? stock : 10;
  const isLowStock = numStock < 5;
  const [deleteStep, setDeleteStep] = React.useState(0);

  React.useEffect(() => {
    if (deleteStep > 0) {
      const timer = setTimeout(() => setDeleteStep(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteStep]);

  return (
    <div className={`p-4 rounded-xl flex items-center justify-between border transition-all ${
      isLowStock 
        ? "bg-rose-50/40 border-rose-200 shadow-xs" 
        : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
    }`} id={`admin-product-row-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center space-x-3 flex-1 min-w-0 mr-2">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shrink-0">
          <img src={imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} className="w-full h-full object-cover" alt={name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <h4 className="font-bold text-gray-800 text-xs truncate">{name}</h4>
            {isLowStock && (
              <span className="bg-red-500 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md leading-none shrink-0 animate-pulse flex items-center gap-0.5">
                <AlertTriangle className="w-2 h-2" />
                Low Stock
              </span>
            )}
          </div>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1 truncate">
            <span className="shrink-0">₹{price}</span>
            <span className="shrink-0">•</span>
            {
              numStock === 0 ? (
                <span className="text-red-650 italic font-black flex items-center shrink-0">
                  Out of Stock
                </span>
              ) : numStock < 5 ? (
                <span className="text-red-650 font-black flex items-center gap-0.5 shrink-0">
                  Low Stock ({numStock})
                </span>
              ) : (
                <span className="text-emerald-500 italic shrink-0">In Stock ({numStock})</span>
              )
            }
          </p>
        </div>
      </div>
      <div className="flex space-x-1 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleStock(); }}
          className={`p-2 rounded-lg border transition-all cursor-pointer shadow-xs active:scale-95 ${
            numStock > 0 
              ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100" 
              : "bg-red-600 border-red-600 text-white hover:bg-red-700 shadow-rose-100"
          }`}
          title={numStock > 0 ? "Mark Out of Stock" : "Mark In Stock"}
        >
          <Package className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer active:scale-95"
          title="Edit Product"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
        {deleteStep === 0 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setDeleteStep(1); }}
            className="p-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
            title="Delete Product"
            id="admin-delete-btn-base"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); setDeleteStep(0); }}
            className="px-2 bg-red-600 border border-red-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all cursor-pointer font-sans h-8 shrink-0 flex items-center justify-center animate-pulse"
            title="Confirm deletion"
            id="admin-delete-btn-confirm"
          >
            Confirm? 🚨
          </button>
        )}
      </div>
    </div>
  );
});

ProductAdminRow.displayName = 'ProductAdminRow';
