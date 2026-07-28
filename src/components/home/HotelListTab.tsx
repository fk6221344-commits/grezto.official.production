import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ShoppingBag, MapPin, Award, Star, Utensils, ChevronRight, ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductCard from '../ProductCard';
import AestheticImage from '../AestheticImage';
import { useRegisterBackHandler } from '../../hooks/useRegisterBackHandler';

const ProductCardSkeleton = () => (
  <div className="bg-white rounded-[1.25rem] p-1 pb-2 flex flex-col justify-between border border-slate-100 shadow-sm animate-pulse select-none">
    {/* Image Skeleton */}
    <div className="aspect-[5/4] rounded-[1rem] bg-slate-100 mb-2 w-full" />
    
    {/* Content Area */}
    <div className="px-1 flex-1 flex flex-col justify-between">
      <div>
        {/* Title Lines */}
        <div className="h-3 bg-slate-200/60 rounded-md w-11/12 mb-1.5" />
        <div className="h-3 bg-slate-200/60 rounded-md w-2/3 mb-2" />
        {/* Unit Line */}
        <div className="h-2 bg-slate-100 rounded-md w-1/2 mb-3" />
      </div>
      
      {/* Price & Add Button Row */}
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="h-4 bg-slate-200/60 rounded-md w-1/4" />
        <div className="h-7 bg-slate-200/60 rounded-xl w-14" />
      </div>
    </div>
  </div>
);

const RecommendedHotelSkeleton = () => (
  <div className="space-y-3.5 pb-6 mb-6 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0">
    {/* Header Skeleton */}
    <div className="flex items-center justify-between py-2.5 px-3.5 bg-[#fffdf9] border border-amber-100/50 rounded-[1.8rem] animate-pulse relative overflow-hidden">
      <div className="flex items-center space-x-3.5 min-w-0">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-100/50 flex-shrink-0" />
        <div className="space-y-1.5 text-left">
          <div className="h-3.5 bg-slate-200/60 rounded-md w-28" />
          <div className="h-2.5 bg-slate-100 rounded-md w-36" />
        </div>
      </div>
      <div className="w-7.5 h-7.5 rounded-full bg-slate-100 flex-shrink-0" />
    </div>

    {/* Dishes Grid Skeleton */}
    <div className="grid grid-cols-2 gap-2">
      <ProductCardSkeleton />
      <ProductCardSkeleton />
    </div>
  </div>
);

const AllHotelSkeleton = () => (
  <div className="bg-slate-50 rounded-[2rem] border border-slate-100 aspect-[16/9] w-full animate-pulse flex flex-col justify-end p-6 space-y-2">
    <div className="h-5 bg-slate-200/60 rounded-md w-1/2" />
    <div className="h-3 bg-slate-150/60 rounded-md w-1/3" />
  </div>
);

interface HotelListTabProps {
  activeHotels: any[];
  isSystemOnline: boolean;
  calculateGeodistance: (lat: number, lng: number) => string;
  setSelectedHotelForDetails: (hotel: any) => void;
  getDishesForHotel: (hotelId: string) => any[];
  isLoading?: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function HotelListTab({
  activeHotels,
  isSystemOnline,
  calculateGeodistance,
  setSelectedHotelForDetails,
  getDishesForHotel,
  isLoading = false,
  onClose,
  searchQuery,
  setSearchQuery
}: HotelListTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'recommended' | 'all'>('recommended');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Register hardware back button
  useRegisterBackHandler(() => {
    if (isSearchFocused) {
      setIsSearchFocused(false);
      return true; // Consume event just to close keyboard/dropdown
    }
    onClose();
    return true; // Consume event
  }, 50, [isSearchFocused]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Generate suggestions for dropdown
  const searchSuggestions = React.useMemo(() => {
    if (!normalizedQuery) return [];
    
    const suggestions: any[] = [];
    const seen = new Set();
    
    activeHotels.forEach(hotel => {
      const hName = (hotel.name || '').toLowerCase();
      // If hotel name matches, add hotel suggestion
      if (hName.includes(normalizedQuery) && !seen.has(hName)) {
        seen.add(hName);
        suggestions.push({ type: 'hotel', text: hotel.name, hotelId: hotel.id });
      }
      
      const dishes = getDishesForHotel(hotel.id) || [];
      dishes.forEach((dish: any) => {
        const dName = (dish.name || '').toLowerCase();
        if (dName.includes(normalizedQuery) && !seen.has(dName)) {
          seen.add(dName);
          suggestions.push({ type: 'dish', text: dish.name, hotelId: hotel.id, hotelName: hotel.name });
        }
      });
    });
    
    return suggestions.slice(0, 10);
  }, [normalizedQuery, activeHotels, getDishesForHotel]);

  const filteredHotels = activeHotels.filter(hotel => {
    if (!normalizedQuery) return true;
    
    const hotelName = (hotel.name || '').toLowerCase();
    const hotelCategory = (hotel.category || '').toLowerCase();
    
    // Check if hotel name or category includes query
    if (hotelName.includes(normalizedQuery) || hotelCategory.includes(normalizedQuery)) {
      return true;
    }
    
    // Check dishes if available
    const dishes = getDishesForHotel(hotel.id) || [];
    const hasMatchingDish = dishes.some((dish: any) => 
      (dish.name || '').toLowerCase().includes(normalizedQuery) ||
      (dish.description || '').toLowerCase().includes(normalizedQuery)
    );
    
    return hasMatchingDish;
  });

  // Filter and sort recommended hotels: Only show those that are exclusive (pinned)
  // sorted by rating descending (highest rating first)
  const recommendedHotels = filteredHotels
    .filter(hotel => hotel.pinned === true || hotel.pinned === 'true' || hotel.pinned === 1 || hotel.pinned === '1')
    .sort((a, b) => {
      const ratingA = a.rating !== undefined ? parseFloat(a.rating) : 0;
      const ratingB = b.rating !== undefined ? parseFloat(b.rating) : 0;
      return ratingB - ratingA;
    });

  const allHotelsSorted = [...filteredHotels];

  const content = (
    <motion.div
      key="hotel_mode"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9999] bg-white overflow-y-auto pb-6 text-left flex flex-col"
    >
      {/* Top Header Section */}
      <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 shadow-sm px-4 pt-[max(env(safe-area-inset-top),42px)] pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[14px] font-black uppercase tracking-wider text-slate-800">
            Hotels & Restaurants
          </h2>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-2xl block pl-10 pr-4 py-3 font-medium placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ef233c]/20 focus:border-[#ef233c]/50 transition-all shadow-sm"
            placeholder="Search Biryani, Burger, Pizza..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              // Delay hiding suggestions to allow clicking them
              setTimeout(() => setIsSearchFocused(false), 200);
            }}
          />
          
          {/* Autocomplete Suggestions Dropdown */}
          {isSearchFocused && searchQuery.length > 0 && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden">
              <ul className="max-h-64 overflow-y-auto py-1">
                {searchSuggestions.map((item, idx) => (
                  <li 
                    key={idx}
                    onClick={() => {
                       setSearchQuery(item.text);
                       setIsSearchFocused(false);
                    }}
                    className="px-4 py-3 hover:bg-slate-50 active:bg-slate-100 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <Search className="w-4 h-4 text-slate-300" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-700">{item.text}</span>
                      {item.type === 'dish' && (
                        <span className="text-[10px] font-semibold text-emerald-600">from {item.hotelName}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 mt-5 space-y-5 flex-1">
      {/* Elegant segment control under Hotels & Restaurants */}
      <div className="flex items-center justify-center space-x-3 max-w-[320px] mx-auto mb-6" id="hotel-sub-tabs-container">
        <button
          id="sub-tab-recommended"
          onClick={() => setActiveSubTab('recommended')}
          className={`flex-1 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 select-none cursor-pointer flex items-center justify-center space-x-1 border ${
            activeSubTab === 'recommended'
              ? 'bg-gradient-to-r from-[#1b4332] via-[#2d6a4f] to-[#1b4332] text-white border-emerald-950 shadow-[0_8px_20px_rgba(27,67,50,0.45),_0_2px_8px_rgba(27,67,50,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]'
              : 'bg-white text-slate-600 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:text-slate-800'
          }`}
        >
          <span className={`transition-transform duration-300 ${activeSubTab === 'recommended' ? 'scale-110' : 'scale-100'}`}>⭐</span>
          <span>RECOMMENDED</span>
        </button>
        <button
          id="sub-tab-all"
          onClick={() => setActiveSubTab('all')}
          className={`flex-1 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 select-none cursor-pointer flex items-center justify-center space-x-1 border ${
            activeSubTab === 'all'
              ? 'bg-gradient-to-r from-[#c25100] via-[#e65c00] to-[#b34700] text-white border-orange-900 shadow-[0_8px_20px_rgba(230,92,0,0.4),_0_2px_8px_rgba(230,92,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.25)]'
              : 'bg-white text-slate-600 border-slate-200 shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:text-slate-800'
          }`}
        >
          <span className={`transition-transform duration-300 ${activeSubTab === 'all' ? 'scale-110' : 'scale-100'}`}>🍽️</span>
          <span>ALL RESTAURANTS</span>
        </button>
      </div>

      {activeSubTab === 'recommended' ? (
        /* Recommended View: Top Rated First with Products displayed below name */
        <div className="space-y-6" id="recommended-hotels-section">
          {/* Elegant header segment exact replica of the user screenshot */}
          <div className="flex items-center space-x-3 mb-5 mt-2 px-1 select-none" id="exclusive-recommendations-header">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <Star className="w-4.5 h-4.5 fill-emerald-500 text-emerald-500" />
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-[11.5px] font-black uppercase tracking-wider text-emerald-800 leading-none">
                EXCLUSIVE RECOMMENDATIONS
              </h3>
              <div className="h-0.75 bg-emerald-500 w-11 rounded-full mt-1"></div>
            </div>
          </div>

          {isLoading ? (
            <>
              <RecommendedHotelSkeleton />
              <RecommendedHotelSkeleton />
            </>
          ) : recommendedHotels.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-transparent select-none" id="no-hotels-placeholder">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100/50 rounded-[1.5rem] flex items-center justify-center mb-4 text-slate-300 shadow-xs">
                <ShoppingBag className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="text-[11px] font-black text-slate-750 uppercase tracking-widest mb-2">
                NO RECOMMENDED SHOPS ACTIVE!
              </h3>
              <p className="text-[9.5px] text-gray-400 font-extrabold uppercase tracking-widest px-8 max-w-xs leading-relaxed">
                We couldn't find any exclusive recommended outlets online right now. Try looking at All Restaurants.
              </p>
            </div>
          ) : (
            recommendedHotels.map((hotel) => {
              const rating = hotel.rating !== undefined ? parseFloat(hotel.rating) : 1.0;
              const count = hotel.ratingCount !== undefined ? parseInt(hotel.ratingCount) : 0;
              const distance = calculateGeodistance(hotel.lat, hotel.lng);
              const isClosed = !isSystemOnline || hotel.isOpen === false;
              const dishes = getDishesForHotel(hotel.id) || [];
              
              // Only display up to 6 dishes on the homepage feed of recommended
              const displayDishes = dishes.slice(0, 6);
              const hasMoreDishes = dishes.length > 6;

              return (
                <div 
                  key={hotel.id} 
                  id={`recommended-card-${hotel.id}`}
                  className="space-y-3.5 pb-6 mb-6 border-b border-slate-100 last:border-b-0 last:pb-0 last:mb-0"
                >
                  {/* Compact Header Panel */}
                  <div 
                    id={`hotel-header-${hotel.id}`}
                    onClick={() => {
                      if (isClosed) {
                        toast.error("This merchant is currently OFF DUTY.", { duration: 3000, position: 'top-center' });
                        return;
                      }
                      setSelectedHotelForDetails(hotel);
                    }}
                    className={`flex items-center justify-between py-2.5 px-3.5 bg-[#fffdf9] border border-amber-100 rounded-[1.8rem] cursor-pointer hover:bg-[#fffcf4] shadow-[0_6px_20px_rgba(0,0,0,0.15),_0_2px_8px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.22),_0_4px_12px_rgba(0,0,0,0.15)] hover:scale-[1.005] transition-all relative overflow-hidden ${
                      isClosed ? 'opacity-[0.85] saturate-[0.85]' : ''
                    }`}
                  >
                    {/* Subtle Radial Shine */}
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-amber-50/10 to-transparent pointer-events-none"></div>

                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden relative flex-shrink-0 bg-amber-50 border border-amber-100/50">
                        <AestheticImage 
                          src={hotel.image || hotel.imageUrl || ""} 
                          className="w-full h-full" 
                          alt="Hotel photo"
                          referrerPolicy="no-referrer"
                        />
                        {isClosed && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                            <span className="text-[7px] font-black text-red-500 uppercase tracking-wider bg-white/95 px-1 rounded-sm">CLOSED</span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 text-left">
                        <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase truncate flex items-center gap-1.5 leading-tight">
                          {hotel.name}
                          {hotel.pinned && (
                            <span className="text-[7.5px] bg-amber-500/10 text-amber-700 border border-amber-500/20 font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-0.5">
                              ⭐ EXCLUSIVE
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[10px] font-bold mt-1">
                          <span className="flex items-center gap-0.5 text-slate-800">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {rating.toFixed(1)}
                          </span>
                          <span className="text-slate-300 font-normal">•</span>
                          <span className="text-slate-400 font-semibold truncate">({count} reviews)</span>
                          <span className="text-slate-300 font-normal">•</span>
                          <span className="flex items-center gap-0.5 font-mono text-[9.5px] text-[#ef233c]">
                            <MapPin className="w-3.5 h-3.5" />
                            {distance}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center bg-amber-50 text-amber-700 border border-amber-100/50 w-7.5 h-7.5 rounded-full flex-shrink-0 hover:bg-amber-100 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Dishes List */}
                  {dishes.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-[9px] font-bold uppercase tracking-widest" id={`empty-menu-${hotel.id}`}>
                      🍽️ Menu coming soon!
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2" id={`grid-dishes-${hotel.id}`}>
                        {displayDishes.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>

                      {hasMoreDishes && (
                        <button
                          id={`btn-more-dishes-${hotel.id}`}
                          onClick={() => {
                            if (isClosed) {
                              toast.error("This merchant is currently OFF DUTY.", { duration: 3000, position: 'top-center' });
                              return;
                            }
                            setSelectedHotelForDetails(hotel);
                          }}
                          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black uppercase tracking-wider rounded-2xl border border-slate-200/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>VIEW ALL {dishes.length} ITEMS</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* List of active Restaurants sorted by reviews (Original View) */
        <div className="space-y-4" id="all-hotels-section">
          {isLoading ? (
            <>
              <AllHotelSkeleton />
              <AllHotelSkeleton />
              <AllHotelSkeleton />
            </>
          ) : activeHotels.length === 0 ? (
            <div className="py-20 text-center text-gray-400 space-y-2 select-none">
              <ShoppingBag className="w-10 h-10 mx-auto text-gray-305 stroke-[1.5]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No matching hotels registered!</p>
            </div>
          ) : (
            activeHotels.map((hotel) => {
              const rating = hotel.rating !== undefined ? parseFloat(hotel.rating) : 1.0;
              const count = hotel.ratingCount !== undefined ? parseInt(hotel.ratingCount) : 0;
              const distance = calculateGeodistance(hotel.lat, hotel.lng);
              const isClosed = !isSystemOnline || hotel.isOpen === false;
              
              return (
                <motion.div
                  key={hotel.id}
                  id={`all-hotel-card-${hotel.id}`}
                  onClick={() => {
                    if (isClosed) {
                      toast.error("This merchant is currently OFF DUTY.", { duration: 3000, position: 'top-center' });
                      return;
                    }
                    setSelectedHotelForDetails(hotel);
                  }}
                  whileHover={{ y: -3, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className={`bg-gray-900 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer relative flex flex-col aspect-[16/9] w-full ${isClosed ? 'opacity-[0.85] saturate-[0.85]' : ''}`}
                >
                  {/* Banner Picture Frame */}
                  <div className="absolute inset-0 w-full h-full overflow-hidden">
                    <AestheticImage 
                       src={hotel.image || hotel.imageUrl || ""} 
                       className="w-full h-full hover:scale-105 transition-transform duration-500" 
                       alt="Hotel photo"
                       referrerPolicy="no-referrer"
                    />
                    {/* Deep Smooth Shading Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent"></div>
                    
                    {isClosed && (
                      <div className="absolute inset-0 bg-white/10 flex items-center justify-center z-20">
                        <span className="text-xs font-black text-red-600 uppercase tracking-[0.2em] bg-white/95 px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(225,29,72,0.3)] border border-red-500">CLOSED</span>
                      </div>
                    )}

                    {/* Special Tag overlays at Top-Left */}
                    {hotel.category && (
                      <div className="absolute top-5 left-5 z-10 flex items-center">
                        <span className="bg-[#e11d48] text-white px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                          <Utensils className="w-3 h-3 text-white stroke-[2.5]" />
                          {hotel.category}
                        </span>
                      </div>
                    )}

                    {/* Rating Badge Overlay at Top-Right if Top Rated */}
                    <div className="absolute top-5 right-5 flex flex-wrap gap-1 text-[8px] font-black uppercase tracking-wider text-white z-10">
                      {rating >= 4.7 && (
                        <span className="bg-amber-500/95 px-3 py-1.5 rounded-full border border-amber-400/20 shadow-lg flex items-center gap-1 text-slate-900">
                          <Award className="w-3 h-3 fill-slate-900" /> Top Rated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Info overlay matching Drawer Style */}
                  <div className="absolute bottom-5 left-6 right-6 text-white text-left space-y-1 z-10">
                    <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight uppercase truncate">
                      {hotel.name}
                    </h3>

                    <div className="flex items-center space-x-2 text-white/90 text-[10.5px] font-bold">
                      <p className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-extrabold">{rating.toFixed(1)}</span>
                        <span className="text-white/70">({count} reviews)</span>
                      </p>
                      <span className="text-white/50">•</span>
                      <p className="flex items-center gap-1 font-mono text-white/90">
                        <MapPin className="w-3.5 h-3.5 text-[#e11d48]" />
                        {distance} distance
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}
      </div>
    </motion.div>
  );

  // Use createPortal to mount this full-screen view at the root of the document
  // This completely escapes any stacking contexts (like transform/opacity) from App.tsx page transitions
  // ensuring that z-[9999] actually sits on top of TopHeader and BottomNav.
  return createPortal(content, document.body);
}
