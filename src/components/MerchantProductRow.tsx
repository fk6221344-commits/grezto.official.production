import React from 'react';
import { Edit, Package, Trash2 } from 'lucide-react';

interface MerchantProductRowProps {
  item: any;
  handleToggleStock: (id: string, currentStock: number) => void;
  setEditingItem: (item: any) => void;
  setNewItem: (fields: any) => void;
  setShowAddMenuModal: (show: boolean) => void;
  handleDeleteItem: (id: string) => void;
}

export const MerchantProductRow = React.memo(({ 
  item, 
  handleToggleStock, 
  setEditingItem, 
  setNewItem, 
  setShowAddMenuModal, 
  handleDeleteItem 
}: MerchantProductRowProps) => {
  const [deleteStep, setDeleteStep] = React.useState(0);

  React.useEffect(() => {
    if (deleteStep > 0) {
      const timer = setTimeout(() => setDeleteStep(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteStep]);

  const numStock = typeof item.stock === 'number' ? item.stock : 15;
  const isLowStock = numStock < 5;

  return (
    <div className={`p-4 rounded-xl flex items-center justify-between border transition-all gap-2.5 relative group ${
      isLowStock 
        ? "bg-rose-50/40 border-rose-200 shadow-xs" 
        : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
    }`} id={`merchant-product-row-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        <img 
          src={item.image || item.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} 
          className="w-12 h-12 object-cover rounded-xl border border-slate-150 bg-slate-50 shrink-0"
          alt={item.name} 
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1 text-left">
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none truncate">{item.name}</h4>
          <span className="text-[6.5px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded tracking-wide leading-none mt-1 inline-block truncate max-w-full">{item.category}</span>
          <p className="text-[10px] font-black text-slate-900 mt-1 truncate max-w-full">₹{item.price} <span className="text-[8.5px] font-medium text-slate-400">/ {item.unit || 'serving'}</span></p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); handleToggleStock(item.id, numStock); }}
          className={`p-2 rounded-lg border transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center shrink-0 ${
            numStock > 0 
              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
              : 'bg-red-600 border-red-600 text-white hover:bg-red-700 shadow-rose-100'
          }`}
          title={numStock > 0 ? "Mark Out of Stock" : "Mark In Stock"}
        >
          <Package className="w-3.5 h-3.5" />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setEditingItem(item);
            setNewItem({
              name: item.name,
              price: String(item.price),
              category: item.category || 'Fast Food',
              imageUrl: item.image || item.imageUrl || '',
              description: item.description || '',
              unit: item.unit || '1 serving',
              stock: numStock
            });
            setShowAddMenuModal(true);
          }}
          className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition flex items-center justify-center shrink-0 active:scale-95"
          title="Edit Product"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>

        {deleteStep === 0 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setDeleteStep(1); }}
            className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition flex items-center justify-center shrink-0 active:scale-95"
            title="Delete product"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteItem(item.id);
              setDeleteStep(0);
            }}
            className="px-2 bg-red-600 border border-red-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all cursor-pointer h-8 shrink-0 flex items-center justify-center animate-pulse font-sans"
            title="Confirm deletion"
          >
            Confirm? 🚨
          </button>
        )}
      </div>
    </div>
  );
});

MerchantProductRow.displayName = 'MerchantProductRow';
