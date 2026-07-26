import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  MapPin, 
  Check, 
  Minus, 
  Plus, 
  Info 
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';
import { getApiUrl, getAuthHeaders } from '../../utils/api';
import AestheticImage from '../AestheticImage';
import { useRegisterBackHandler } from '../../hooks/useRegisterBackHandler';

interface HotelDetailsDrawerProps {
  hotel: any;
  onClose: () => void;
  calculateGeodistance: (lat: number, lng: number) => string;
  getDishesForHotel: (hotelId: string) => any[];
  onRatingUpdated?: (hotelId: string, newAvg: string, newCount: number) => void;
}

export default function HotelDetailsDrawer({
  hotel,
  onClose,
  calculateGeodistance,
  getDishesForHotel,
  onRatingUpdated
}: HotelDetailsDrawerProps) {
  const { addToCart, items: cartItems, updateQuantity } = useCart();
  
  const [activeHotelImgIdx, setActiveHotelImgIdx] = useState(0);
  const [activeUserRating, setActiveUserRating] = useState<number>(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmittedForThisSession, setRatingSubmittedForThisSession] = useState<{ [key: string]: boolean }>({});
  
  const [currentHotelState, setCurrentHotelState] = useState(hotel);
  const [dishes, setDishes] = useState<any[]>(() => getDishesForHotel(hotel.id));
  const [dishesLoading, setDishesLoading] = useState(true);

  // Register hardware back button handler to close hotel menu instead of exiting app
  useRegisterBackHandler(() => {
    if (hotel) {
      onClose();
      return true; // consumed
    }
    return false;
  }, 100, [hotel, onClose]);

  useEffect(() => {
    setCurrentHotelState(hotel);
  }, [hotel]);

  useEffect(() => {
    let isMounted = true;
    
    // Initialize/sync with local fallback
    const initialDishes = getDishesForHotel(currentHotelState.id);
    setDishes(initialDishes);
    setDishesLoading(true);

    fetch(getApiUrl(`/api/products?shopId=${encodeURIComponent(currentHotelState.id)}&_cb=${Date.now()}`))
      .then(res => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          const fetchedDishes = data.products || [];
          setDishes(fetchedDishes);
          setDishesLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch shop dishes inside drawer:", err);
        if (isMounted) {
          setDishesLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [currentHotelState.id]);

  const handleSubmitRatingFeedback = async (h: any) => {
    if (activeUserRating === 0) {
      toast.error("Please select a rating first! ⭐");
      return;
    }
    setRatingSubmitting(true);
    const mockDelay = new Promise(resolve => setTimeout(resolve, 300));
    await mockDelay;

    const currentCount = h.ratingCount !== undefined ? parseInt(h.ratingCount) : 0;
    const currentRatingVal = h.rating !== undefined ? parseFloat(h.rating) : 1.0;
    const newCount = currentCount + 1;
    const calculatedNewAvg = currentCount === 0 
      ? activeUserRating 
      : parseFloat(((currentRatingVal * currentCount + activeUserRating) / newCount).toFixed(1));

    try {
      const response = await fetch(getApiUrl('/api/shops/update'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopId: h.id,
          city: h.city,
          updateData: {
            rating: String(calculatedNewAvg),
            ratingCount: newCount
          }
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
      
      setRatingSubmittedForThisSession(prev => ({ ...prev, [h.id]: true }));
      
      const updated = {
        ...h,
        rating: String(calculatedNewAvg),
        ratingCount: newCount
      };
      setCurrentHotelState(updated);
      
      if (onRatingUpdated) {
        onRatingUpdated(h.id, String(calculatedNewAvg), newCount);
      }
      
      toast.success(`Thank you! Rating submitted: ${activeUserRating} Stars ⭐`);
    } catch (err: any) {
      console.warn("[Firebase Backup Sync] Rating synced locally as backup fallback:", err);
      
      setRatingSubmittedForThisSession(prev => ({ ...prev, [h.id]: true }));
      
      const updated = {
        ...h,
        rating: String(calculatedNewAvg),
        ratingCount: newCount
      };
      setCurrentHotelState(updated);
      
      if (onRatingUpdated) {
        onRatingUpdated(h.id, String(calculatedNewAvg), newCount);
      }
      
      try {
        const cachedRatings = JSON.parse(localStorage.getItem('grezto_offline_ratings') || '{}');
        cachedRatings[h.id] = { rating: String(calculatedNewAvg), ratingCount: newCount };
        localStorage.setItem('grezto_offline_ratings', JSON.stringify(cachedRatings));
      } catch (localStoreErr) {}

      toast.success(`Thank you! Rating saved (Local Backup Mode) ⭐`);
    } finally {
      setRatingSubmitting(false);
    }
  };

  useEffect(() => {
    // Scroll container ko wapis top par reset karein taaki header/photo hamesha shuruat mein dikhe
    const scrollContainer = document.getElementById('hotel-drawer-scroll-body');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
    // Kuch devices ya layout shift ke liye secondary timeout backup
    const timer = setTimeout(() => {
      const el = document.getElementById('hotel-drawer-scroll-body');
      if (el) el.scrollTop = 0;
    }, 150);

    // Lock background scroll when drawer is open
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [currentHotelState.id]);

  if (!currentHotelState) return null;

  const hotelPhotos = [
    currentHotelState.image || currentHotelState.imageUrl,
    currentHotelState.image2 || currentHotelState.imageUrl2,
    currentHotelState.image3 || currentHotelState.imageUrl3,
    currentHotelState.image4 || currentHotelState.imageUrl4
  ].filter(Boolean);
  if (hotelPhotos.length === 0) {
    hotelPhotos.push("https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800");
  }

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center" 
      id="hotel-details-drawer-overlay"
    >
      <motion.div 
        initial={{ y: '100%', opacity: 0.95 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.95 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white w-full max-w-none lg:max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[100dvh] sm:h-[88vh] sm:max-h-[90vh]"
        id="hotel-details-drawer-body"
      >
        <div className="relative h-48 bg-stone-900 shrink-0" id="hotel-photos-carousel">
          <div className="w-full h-full relative" id="hotel-photo-container">
            <AestheticImage 
              key={activeHotelImgIdx}
              src={hotelPhotos[activeHotelImgIdx % hotelPhotos.length]} 
              className="w-full h-full opacity-85" 
              alt="Restaurant logo"
              referrerPolicy="no-referrer"
              id="hotel-active-photo"
            />
            {hotelPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveHotelImgIdx(prev => prev === 0 ? hotelPhotos.length - 1 : prev - 1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white border-0 z-10 cursor-pointer shadow-md backdrop-blur-sm"
                  id="hotel-photo-prev-btn"
                >
                  <ChevronLeft className="w-5 h-5 pr-[2px]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveHotelImgIdx(prev => prev === hotelPhotos.length - 1 ? 0 : prev + 1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white border-0 z-10 cursor-pointer shadow-md backdrop-blur-sm"
                  id="hotel-photo-next-btn"
                >
                  <ChevronRight className="w-5 h-5 pl-[2px]" />
                </button>
                
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-10" id="hotel-photo-dots">
                  {hotelPhotos.map((_, idx) => (
                     <div 
                       key={idx} 
                       className={`h-1.5 rounded-full transition-all duration-300 drop-shadow-md ${activeHotelImgIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                       id={`hotel-photo-dot-${idx}`}
                     />
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Close Button overlay */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-10 h-10 bg-black/50 hover:bg-black/75 rounded-full flex items-center justify-center text-white border-0 cursor-pointer shadow-lg active:scale-90 transition-colors z-20"
            id="hotel-details-close-btn"
          >
            <X className="w-5 h-5 text-stone-50" />
          </button>

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" id="hotel-overlay-gradient"></div>

          <div className="absolute bottom-5 left-6 text-white text-left max-w-[85%] space-y-1" id="hotel-header-metadata">
            <span className="text-[8.5px] font-black uppercase bg-rose-600 text-white px-2.5 py-1 rounded-md tracking-wider border border-rose-500/10 inline-block" id="hotel-category-badge">
              {currentHotelState.category}
            </span>
            
            <h3 className="text-lg font-black tracking-tight leading-tight uppercase font-display select-text" id="hotel-name-display">
              {currentHotelState.name}
            </h3>

            <div className="flex items-center space-x-3 text-white/85 text-[10px] font-bold" id="hotel-stats-display">
              <p className="flex items-center gap-1" id="hotel-rating-p">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-extrabold">{parseFloat(currentHotelState.rating || '1.0').toFixed(1)}</span>
                <span className="text-white/60">({currentHotelState.ratingCount || 0} reviews)</span>
              </p>
              <span>•</span>
              <p className="flex items-center gap-0.5 font-mono" id="hotel-distance-p">
                <MapPin className="w-3.5 h-3.5 text-rose-300" />
                {calculateGeodistance(currentHotelState.lat, currentHotelState.lng)} distance
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Food Menu card segment list */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-6 [webkit-overflow-scrolling:touch] touch-pan-y" id="hotel-drawer-scroll-body">
          
          {/* Feedback live Rating console */}
          <div className="bg-slate-50 border border-slate-150/80 p-4.5 rounded-3xl select-none text-center" id="hotel-rating-console">
            <div className="text-left mb-3" id="hotel-rating-console-header">
              <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-3">Customer Rating Console ⭐</h5>
              <p className="text-[8px] text-gray-400 uppercase tracking-widest leading-none mt-1">Submit reviews to auto-adjust partner showcase rank</p>
            </div>

            {ratingSubmittedForThisSession[currentHotelState.id] ? (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-1 px-3.5 bg-emerald-50/55 border border-emerald-100 rounded-2xl inline-flex items-center gap-1.5 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide"
                id="rating-success-badge"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3.5]" />
                <span>Review registered indefinitely! Thanks!</span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-3" id="rating-stars-wrapper">
                <div className="flex gap-2" id="rating-stars-row">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const active = activeUserRating >= starIdx;
                    return (
                      <button
                        key={starIdx}
                        type="button"
                        onClick={() => setActiveUserRating(starIdx)}
                        className="focus:outline-none bg-transparent border-0 cursor-pointer p-0.5 tracking-normal inline-block"
                        id={`rating-star-btn-${starIdx}`}
                      >
                        <Star className={`w-8 h-8 transition-transform duration-200 active:scale-125 ${
                          active ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                        }`} />
                      </button>
                    );
                  })}
                </div>

                {activeUserRating > 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleSubmitRatingFeedback(currentHotelState)}
                    className="px-5 py-2 bg-slate-900 border-0 text-white font-black text-[9px] uppercase tracking-wider rounded-xl cursor-pointer hover:bg-slate-800"
                    id="submit-rating-btn"
                  >
                    {ratingSubmitting ? "Uploading..." : `Submit ${activeUserRating} Star Review`}
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {/* Dishes lists */}
          <div className="space-y-4" id="hotel-menu-dishes-section">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1.5 flex items-center justify-between" id="hotel-menu-subtitle">
              <span>Restaurant Dishes Menu</span>
              <span>{dishesLoading && dishes.length === 0 ? "Loading..." : `${dishes.length} Dishes available`}</span>
            </p>

            <div className="space-y-4 text-left" id="hotel-dishes-list">
              {dishesLoading && dishes.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3" id="dishes-loading-indicator">
                  <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest animate-pulse">
                    Warming up kitchen & loading dishes... 🍳
                  </p>
                </div>
              ) : dishes.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-gray-400" id="dishes-empty-state">
                  <p className="text-3xl">📭</p>
                  <p className="text-[11px] font-black uppercase tracking-wider">No dishes available at the moment</p>
                  <p className="text-[9px] text-gray-400">Please check back later or contact the shop owner.</p>
                </div>
              ) : (
                dishes.map((dish: any) => {
                  const isVeg = !dish.name.toLowerCase().includes("chicken") && !dish.name.toLowerCase().includes("mutton") && !dish.name.toLowerCase().includes("egg");
                  
                  // Check count of this item in local cart context
                  const matchInCart = (dish && dish.id) ? cartItems.find((ci: any) => ci.id === dish.id) : undefined;
                  const quantityInCart = matchInCart ? matchInCart.quantity : 0;

                  return (
                    <div 
                      key={dish.id} 
                      className="bg-gray-50/50 p-4.5 rounded-3xl border border-gray-100 flex justify-between items-start gap-4 transition-all hover:bg-white hover:border-gray-150"
                      id={`dish-item-card-${dish.id}`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1" id={`dish-info-${dish.id}`}>
                        {/* Veg / Non-Veg Icon dot */}
                        <div className={`w-4 h-4 border-2 rounded-md flex items-center justify-center shrink-0 ${
                          isVeg ? 'border-emerald-600' : 'border-red-600'
                        }`} id={`dish-diet-border-${dish.id}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isVeg ? 'bg-emerald-600' : 'bg-red-600'
                          }`} id={`dish-diet-dot-${dish.id}`}></span>
                        </div>

                        <h4 className="font-black text-[12px] text-gray-800 uppercase tracking-tight leading-snug" id={`dish-name-${dish.id}`}>{dish.name}</h4>
                        <p className="text-[10.5px] font-black text-gray-950 font-sans leading-none" id={`dish-price-${dish.id}`}>₹{dish.price}</p>
                        <p className="text-[9.5px] text-gray-450 font-medium leading-relaxed line-clamp-2 select-text" id={`dish-desc-${dish.id}`}>{dish.description || "Freshly cooked specialty dish seasoned with fine local ingredients."}</p>
                      </div>

                      {/* Food Image and Cart Modifier Row */}
                      <div className="flex flex-col items-center shrink-0 space-y-2.5" id={`dish-interactive-column-${dish.id}`}>
                        <div className="relative w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden border border-gray-150" id={`dish-img-wrap-${dish.id}`}>
                          <img src={dish.image || dish.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="} className="w-full h-full object-cover" alt="Dish photo" referrerPolicy="no-referrer" id={`dish-image-${dish.id}`} />
                        </div>

                        {quantityInCart > 0 ? (
                          <div className="flex items-center bg-rose-600 border border-rose-500/20 text-white rounded-xl py-1.5 px-3 space-x-3.5 text-xs font-black shadow-md select-none" id={`dish-quantity-selector-${dish.id}`}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(dish.id, -1)}
                              className="text-white hover:text-red-250 bg-transparent border-0 cursor-pointer p-0 font-bold"
                              id={`dish-qty-dec-${dish.id}`}
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3.5]" />
                            </button>
                            <span className="font-black font-mono w-4 text-center" id={`dish-count-num-${dish.id}`}>{quantityInCart}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(dish.id, 1)}
                              className="text-white hover:text-red-250 bg-transparent border-0 cursor-pointer p-0 font-bold"
                              id={`dish-qty-inc-${dish.id}`}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3.5]" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              addToCart(dish);
                              toast.success(`${dish.name} added to cart! 🛒`);
                            }}
                            className="px-4.5 py-1.5 bg-white border border-rose-150 hover:bg-rose-50 text-rose-700 font-extrabold text-[9px] uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center"
                            id={`dish-add-to-cart-btn-${dish.id}`}
                          >
                            Add item
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Additional detailed notes */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-3xl flex items-start space-x-3.5 mb-24" id="freshness-guarantee-slate">
            <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-emerald-950 font-bold leading-normal" id="freshness-guarantee-desc">
              <p className="uppercase tracking-wide text-emerald-900 border-b border-emerald-100/35 pb-1 mb-1 font-black text-[9px]" id="freshness-guarantee-heading">Grezto Fresh Food Guarantee 🛡️</p>
              Delivery is directly assigned to professional hot-box insulation riders near Kawarhagi regions to ensure pipeline freshness.
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
