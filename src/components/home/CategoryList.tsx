import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Phone, Grid, Carrot, Cake, Pizza, Pill, ShoppingBag, Apple, Drumstick, CupSoda, Shirt, Shapes, LucideIcon, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const CATEGORY_ICONS: Record<string, { icon: LucideIcon, color: string }> = {
  'all': { icon: Grid, color: 'text-slate-700' },
  'vegetables': { icon: Carrot, color: 'text-green-600' },
  'cake': { icon: Cake, color: 'text-pink-600' },
  'fast food': { icon: Pizza, color: 'text-orange-500' },
  'medicine': { icon: Pill, color: 'text-blue-500' },
  'grocery': { icon: ShoppingBag, color: 'text-emerald-600' },
  'fruits': { icon: Apple, color: 'text-red-500' },
  'non-veg': { icon: Drumstick, color: 'text-amber-700' },
  'cold drinks': { icon: CupSoda, color: 'text-cyan-500' },
  'clothes': { icon: Shirt, color: 'text-indigo-500' },
  'others': { icon: Shapes, color: 'text-purple-500' },
};

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
    <div className="w-full pb-0" id="quick-categories-card">
      <div className="flex gap-4 overflow-x-auto pt-2 px-3 no-scrollbar justify-start items-start category-scroll-container" id="category-scroll-inner">
        {categories.filter(Boolean).map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <motion.div
              key={cat.id}
              role="button"
              tabIndex={0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => onSelectCategory(cat.id)}
              className="flex-shrink-0 flex flex-col items-center justify-start gap-1 cursor-pointer group text-center min-w-[52px] relative pb-1 select-none outline-none"
              id={`category-item-${cat.id}`}
            >
              <div className={`w-8 h-8 flex items-center justify-center transition-all duration-300 ${
                isActive 
                  ? "opacity-100" 
                  : "opacity-75 hover:opacity-100"
              }`} id={`category-img-container-${cat.id}`}>
                {(() => {
                  const conf = CATEGORY_ICONS[(cat.name || cat.id).toLowerCase()];
                  const Icon = conf?.icon || ImageIcon;
                  const colorClass = conf?.color || 'text-slate-700';
                  return <Icon className={`w-[22px] h-[22px] ${colorClass} transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-95 group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 1.75} />;
                })()}
              </div>
              <div className="flex flex-col items-center justify-start" id={`category-label-wrap-${cat.id}`}>
                <span className={`text-[10px] tracking-wide text-center max-w-[62px] truncate block transition-colors duration-200 ${
                  isActive ? "text-[#2874f0] font-bold" : "text-gray-600 font-medium"
                }`} id={`category-label-${cat.id}`}>
                  {cat.id === 'Cake' ? t('cake') : (cat.displayName || t(cat.name as any) || cat.name || cat.id)}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="activeCategoryIndicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#2874f0] rounded-t-full" 
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>


    </div>
  );
}
