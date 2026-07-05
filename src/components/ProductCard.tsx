import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

const ProductCardBody = React.memo(({ 
  product, 
  cartItem, 
  addToCart, 
  updateQuantity, 
  t,
  isShopClosed = false
}: { 
  product: any, 
  cartItem: any, 
  addToCart: Function, 
  updateQuantity: Function, 
  t: Function,
  isShopClosed?: boolean
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [modalImgLoaded, setModalImgLoaded] = useState(false);

  // Reset modal image load state when switching images
  React.useEffect(() => {
    setModalImgLoaded(false);
  }, [activeImgIdx, showDetails]);

  if (!product) return null;

  const isClosed = product.isClosed === true || isShopClosed;
  const isOutOfStock = product.stock <= 0;
  const isDisabled = isOutOfStock || isClosed;

  // Check if shop is exclusive (pinned)
  let isExclusive = false;
  try {
    const cached = localStorage.getItem('grezto_cached_shops');
    if (cached) {
      const shopsList = JSON.parse(cached);
      const targetShopId = product.shopId || product.productShopId;
      const shopObj = shopsList.find((s: any) => s.id === targetShopId);
      isExclusive = !!(shopObj?.pinned === true || shopObj?.pinned === 'true' || shopObj?.pinned === 1 || shopObj?.pinned === '1');
    }
  } catch (e) {
    console.error(e);
  }

  // Build the up to 5 images list safely
  const images: string[] = [
    product.image || product.imageUrl,
    product.imageUrl2,
    product.imageUrl3,
    product.imageUrl4,
    product.imageUrl5
  ].filter(Boolean);

  return (
    <>
      <div 
        className={`bg-white rounded-[1.25rem] p-1 pb-0 flex flex-col justify-between border border-gray-100 shadow-sm transition-all duration-100 group ${isDisabled ? 'opacity-[0.85] saturate-[0.85] pointer-events-none' : ''}`}
      >
        {/* Static Area for Image (pointer-events: none and strictly non-interactive) */}
        <div 
          className="relative aspect-[5/4] rounded-[1rem] overflow-hidden bg-gray-50 mb-0.5 border border-gray-50 flex items-center justify-center select-none"
        >
          {/* Default Skeleton Pulse Loader */}
          {!isImgLoaded && (product.image || product.imageUrl) && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse z-0" />
          )}

          <img 
            src={product.image || product.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} 
            alt={product.name} 
            onLoad={() => setIsImgLoaded(true)}
            className={`relative z-10 w-full h-full object-cover transition-all duration-700 pointer-events-none select-none group-hover:scale-105 ${isImgLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
          />
          {isClosed ? (
            <div className="absolute inset-0 z-20 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
              <span className="text-[12px] font-black text-red-600 uppercase tracking-widest bg-white/95 px-4 py-1.5 rounded-xl border border-red-500 shadow-lg">CLOSED</span>
            </div>
          ) : isOutOfStock ? (
            <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
              <span className="text-[10px] font-black text-white uppercase tracking-widest bg-gray-900/50 px-2 py-1 rounded-lg">Out of Stock</span>
            </div>
          ) : null}
          {product.discount && !isDisabled && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-widest shadow-lg z-10">
              -{product.discount}%
            </div>
          )}
        </div>

        <div className="px-1 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-800 leading-tight h-8 overflow-hidden line-clamp-2 transition-colors">
              {product.name}
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5 font-bold tracking-tight h-3 line-clamp-1 uppercase">{product.unit || '1 Kg / Pkt'}</p>
          </div>
          
          <div className="mt-0.5 mb-1 flex items-center justify-between">
            <span className="text-xs font-black text-gray-900 tracking-tight">₹{product.price}</span>
            
            {cartItem ? (
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200 shadow-sm">
                <button 
                  onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                  className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors border-0 cursor-pointer"
                  disabled={isDisabled}
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="text-[9px] font-black text-gray-900 px-1.5 min-w-[16px] text-center">
                  {cartItem.quantity}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                  className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors border-0 cursor-pointer"
                  disabled={isDisabled}
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); if (!isDisabled) addToCart(product); }}
                disabled={isDisabled}
                className={`px-3 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                  isDisabled 
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed" 
                  : "bg-red-600 text-white border border-red-700 hover:bg-red-700 hover:scale-105 shadow-[0_0_12px_rgba(220,38,38,0.7)] animate-pulse"
                }`}
              >
                {isClosed ? 'CLOSED' : (isOutOfStock ? 'SOLD' : 'ADD')}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Product Details Modal & Slider Carousel */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            {/* Click backdrop to exit */}
            <div className="absolute inset-0" onClick={() => setShowDetails(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 500, damping: 33 }}
              className="relative w-full max-w-[340px] bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden p-5 flex flex-col font-sans z-10"
            >
              {/* Close button */}
              <button 
                type="button" 
                onClick={() => setShowDetails(false)} 
                className="absolute top-4 right-4 z-20 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 hover:text-black transition-all border-0 shadow-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Interactive Draggable/Snappable Photo Area */}
              <div className="relative w-full aspect-square bg-gray-50 rounded-[1.5rem] overflow-hidden flex items-center justify-center border border-gray-150 mb-3 select-none group/modal cursor-grab active:cursor-grabbing">
                {/* Premium Modal Skeleton Loader */}
                {!modalImgLoaded && images[activeImgIdx] && (
                  <div className="absolute inset-0 bg-gray-200 animate-pulse z-0" />
                )}

                <motion.img 
                  key={activeImgIdx}
                  src={images[activeImgIdx] || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} 
                  alt={product.name} 
                  drag
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  dragElastic={0.6}
                  onLoad={() => setModalImgLoaded(true)}
                  whileTap={{ scale: 1.05 }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`relative z-10 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-500 ${modalImgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  title="Drag image to move or scroll"
                />

                {/* Drag instruction notice */}
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-xs text-[7px] text-white/90 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Drag with fingers / mouse to pan ↔
                </div>

                {/* Left / Right Navigation chevrons (Only if multiple photos exist) */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImgIdx(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                      className="absolute left-2.5 p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md backdrop-blur-xs transition-transform border-0 cursor-pointer active:scale-95 z-20"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImgIdx(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-2.5 p-2 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md backdrop-blur-xs transition-transform border-0 cursor-pointer active:scale-95 z-20"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Multiple Thumbnails Circle Row for selection */}
              {images.length > 1 && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImgIdx(idx)}
                      className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all p-0.5 ${
                        activeImgIdx === idx ? 'border-purple-600 scale-110 shadow-sm' : 'border-gray-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} className="w-full h-full object-cover rounded-full" alt="thumbnail" />
                    </button>
                  ))}
                </div>
              )}

              {/* Product Info Space */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-50 text-emerald-700 text-[8.5px] font-black uppercase px-2.5 py-1 rounded-xl tracking-widest border border-emerald-100">
                    {product.category || 'Grocery'}
                  </span>
                  {product.unit && (
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                      {product.unit}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-gray-900 tracking-tight leading-snug">
                  {product.name}
                </h3>

                <p className="text-xs font-semibold text-gray-500 leading-relaxed italic pr-2">
                  {product.description || 'Quality checked premium farm selection, pure raw source hygienic packing.'}
                </p>

                <div className="h-px bg-gray-100 my-4" />

                {/* Dynamic Bottom Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Our Best Price</span>
                    <span className="text-lg font-black text-gray-950 tracking-tight">₹{product.price}</span>
                  </div>

                  {cartItem ? (
                    <div className="flex items-center bg-gray-100 rounded-2xl p-1 border border-gray-200 shadow-inner">
                      <button 
                        onClick={() => updateQuantity(product.id, -1)}
                        className="p-1.5 hover:bg-white rounded-xl text-gray-600 transition-colors shadow-xs border-0 cursor-pointer"
                        disabled={isOutOfStock}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-gray-900 px-3 min-w-[32px] text-center">
                        {cartItem.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(product.id, 1)}
                        className="p-1.5 hover:bg-white rounded-xl text-gray-600 transition-colors shadow-xs border-0 cursor-pointer"
                        disabled={isOutOfStock}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      disabled={isOutOfStock}
                      className={`px-6 py-3.5 rounded-2xl text-[10.5px] font-black uppercase tracking-widest transition-all shadow-md border cursor-pointer ${
                        isOutOfStock 
                        ? "bg-gray-100 text-gray-450 border-gray-200 cursor-not-allowed shadow-none" 
                        : "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 hover:shadow-lg"
                      }`}
                    >
                      {isOutOfStock ? 'OUT OF STOCK' : 'ADD TO BASKET'}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}, (prev, next) => {
  return prev.product.id === next.product.id && 
         prev.product.stock === next.product.stock &&
         prev.product.price === next.product.price &&
         prev.product.isClosed === next.product.isClosed &&
         prev.isShopClosed === next.isShopClosed &&
         (prev.product.image || prev.product.imageUrl) === (next.product.image || next.product.imageUrl) &&
         prev.cartItem?.quantity === next.cartItem?.quantity;
});

const ProductCard = ({ product }: { product: any }) => {
  if (!product) return null;
  const { addToCart, items, updateQuantity } = useCart();
  const { t } = useLanguage();
  
  const cartItem = (product && product.id) ? items.find(i => i.id === product.id) : undefined;

  // Calculate isShopClosed here dynamically so ProductCard responds instantly
  let isShopClosed = false;
  try {
    const cached = localStorage.getItem('grezto_cached_shops');
    const systemOnlineCached = localStorage.getItem('grezto_system_online');
    const isSysOnline = systemOnlineCached !== null ? JSON.parse(systemOnlineCached) !== false : true;

    if (cached) {
      const shopsList = JSON.parse(cached);
      const targetShopId = product.shopId || product.productShopId;
      const shopObj = shopsList.find((s: any) => s.id === targetShopId);
      if (shopObj) {
        isShopClosed = !isSysOnline || shopObj.isOpen === false;
      }
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <ProductCardBody 
      product={product} 
      cartItem={cartItem} 
      addToCart={addToCart} 
      updateQuantity={updateQuantity} 
      t={t} 
      isShopClosed={isShopClosed}
    />
  );
};

export default ProductCard;
