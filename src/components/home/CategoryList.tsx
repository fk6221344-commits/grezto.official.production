import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Phone } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface CategoryItem {
  id: string;
  name: string;
  displayName?: string;
  imageUrl?: string;
  bgColor?: string;
}

interface CategoryListProps {
  categories: CategoryItem[];
  activeCategory: string;
  onSelectCategory: (catId: string) => void;
  isLoading?: boolean;
}

export default function CategoryList({
  categories,
  activeCategory,
  onSelectCategory,
  isLoading = false
}: CategoryListProps) {
  const { t } = useLanguage();

  // Gesture stabilizers to distinguish vertical/horizontal scrolling from clean single-tap selection
  const lastTouchCoords = useRef<{ x: number; y: number } | null>(null);
  const dragTriggered = useRef<boolean>(false);
  const [pressedCategoryId, setPressedCategoryId] = useState<string | null>(null);

  const handleCategoryTouchStart = (catId: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    lastTouchCoords.current = { x: touch.clientX, y: touch.clientY };
    dragTriggered.current = false;
    setPressedCategoryId(catId);
  };

  const handleCategoryTouchMove = (e: React.TouchEvent) => {
    if (!lastTouchCoords.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - lastTouchCoords.current.x);
    const dy = Math.abs(touch.clientY - lastTouchCoords.current.y);
    // If the movement passes a small threshold (e.g., 7px), trigger drag/scrolling state and abort click selection
    if (dx > 7 || dy > 7) {
      dragTriggered.current = true;
      setPressedCategoryId(null);
    }
  };

  const handleCategoryTouchEnd = () => {
    setPressedCategoryId(null);
  };

  const handleCategoryClick = useCallback((catId: string, e: React.MouseEvent) => {
    if (dragTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelectCategory(catId);
  }, [onSelectCategory]);

  return (
    <div className="mx-2 mb-1" id="quick-categories-card">
      <div className="flex gap-4 overflow-x-auto pt-3 pb-3 px-1.5 no-scrollbar justify-start items-center category-scroll-container" id="category-scroll-inner">
        {categories.filter(Boolean).map((cat) => {
          return (
            <motion.div
              key={cat.id}
              role="button"
              tabIndex={0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={(e) => onSelectCategory(cat.id)}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 cursor-pointer group text-center min-w-[56px] category-scroll-item select-none outline-none"
              id={`category-item-${cat.id}`}
            >
              <div className={`w-[54px] h-[54px] rounded-[16px] overflow-hidden flex items-center justify-center transition-all duration-300 ${
                activeCategory === cat.id 
                  ? "border-[2px] border-[#ef233c] bg-rose-50/40 shadow-[0_8px_24px_rgba(239,35,60,0.25)] scale-105 ring-4 ring-rose-100/50" 
                  : "border-[1.5px] border-slate-900 bg-white shadow-sm hover:border-slate-700"
              }`} id={`category-img-container-${cat.id}`}>
                <img 
                   src={cat.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} 
                  alt={cat.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-110" 
                  id={`category-img-${cat.id}`}
                />
              </div>
              <div className="flex flex-col items-center min-h-[22px] justify-start" id={`category-label-wrap-${cat.id}`}>
                <span className={`text-[9.5px] font-black tracking-wider uppercase text-center max-w-[62px] truncate block transition-colors duration-200 ${
                  activeCategory === cat.id ? "text-amber-300" : "text-emerald-50/90 font-extrabold"
                }`} id={`category-label-${cat.id}`}>
                  {cat.id === 'Cake' ? t('cake') : (cat.displayName || t(cat.name as any) || cat.name || cat.id)}
                </span>
                {activeCategory === cat.id && (
                  <motion.div 
                    layoutId="activeCategoryIndicator"
                    className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0" 
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {activeCategory === 'Cake' && (
        <div className="space-y-2 mt-3.5" id="cake-custom-card">
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-2.5 px-3 bg-pink-900 border border-pink-950 rounded-2xl text-center text-[10px] font-black text-white tracking-widest flex items-center justify-center gap-2 shadow-sm"
            id="cake-custom-banner"
          >
            <span className="w-2 h-2 bg-pink-200 rounded-full animate-ping shrink-0" style={{ animationDuration: '2s' }} id="cake-custom-ping"></span>
            <span>FOR CUSTOM CAKE DESIGNS, CONTACT US DIRECTLY!</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-2"
            id="cake-contact-grid"
          >
            <a 
              href="https://wa.me/919101776403?text=Hello%20I%20am%20connecting%20you%20from%20Grezto!%20%F0%9F%8D%B0%0AI'm%20interested%20in%20custom%20cake%20designs...."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 px-3 bg-[#25D366] hover:bg-[#20ba5a] hover:scale-[1.02] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md border-0 active:scale-95 transition-all text-center no-underline cursor-pointer"
              id="cake-whatsapp-btn"
            >
              <MessageCircle className="w-4 h-4 text-white shrink-0" />
              <span>WhatsApp</span>
            </a>

            <a 
              href="tel:9101776403"
              className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md border-0 active:scale-95 transition-all text-center no-underline cursor-pointer"
              id="cake-call-btn"
            >
              <Phone className="w-4 h-4 text-white shrink-0" />
              <span>Call Now</span>
            </a>
          </motion.div>
        </div>
      )}

      {activeCategory === 'Medicine' && (
        <div className="space-y-2 mt-3.5" id="medicine-custom-card">
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-2.5 px-3 bg-red-950 border border-red-900 rounded-2xl text-center text-[10px] font-black text-white tracking-widest flex items-center justify-center gap-2 shadow-sm"
            id="medicine-custom-banner"
          >
            <span className="w-2 h-2 bg-red-400 rounded-full animate-ping shrink-0" style={{ animationDuration: '2s' }} id="medicine-custom-ping"></span>
            <span>FOR MEDICINE CONTACT US DIRECTLY!</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-2"
            id="medicine-contact-grid"
          >
            <a 
              href="https://wa.me/919365908084?text=Hello!%20I%20am%20contacting%20you%20through%20the%20Grezto%20app%20to%20order%20medicines."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 px-3 bg-[#25D366] hover:bg-[#20ba5a] hover:scale-[1.02] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md border-0 active:scale-95 transition-all text-center no-underline cursor-pointer"
              id="medicine-whatsapp-btn"
            >
              <MessageCircle className="w-4 h-4 text-white shrink-0" />
              <span>WhatsApp</span>
            </a>

            <a 
              href="tel:9365908084"
              className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md border-0 active:scale-95 transition-all text-center no-underline cursor-pointer"
              id="medicine-call-btn"
            >
              <Phone className="w-4 h-4 text-white shrink-0" />
              <span>Call Now</span>
            </a>
          </motion.div>
        </div>
      )}

      {activeCategory === 'Non-Veg' && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3.5 py-2 px-3 bg-red-900 border border-red-950 rounded-2xl text-center text-[10.5px] font-black text-white tracking-widest flex items-center justify-center gap-2 shadow-sm"
          id="nonveg-guarantee-banner"
        >
          <span className="w-2 h-2 bg-red-200 rounded-full animate-ping shrink-0" style={{ animationDuration: '2s' }} id="nonveg-guarantee-ping"></span>
          <span>100% PURE NON-VEG</span>
        </motion.div>
      )}
      
      {activeCategory === 'Vegetables' && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3.5 py-2 px-3 bg-green-900 border border-green-950 rounded-2xl text-center text-[10.5px] font-black text-white tracking-widest flex items-center justify-center gap-2 shadow-sm"
          id="vegetables-guarantee-banner"
        >
          <span className="w-2 h-2 bg-green-200 rounded-full animate-ping shrink-0" style={{ animationDuration: '2s' }} id="vegetables-guarantee-ping"></span>
          <span>100% FRESH VEGETABLES</span>
        </motion.div>
      )}
    </div>
  );
}
