import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

interface UserProfile {
  name: string;
  phone: string;
  address: string;
  isLoggedIn: boolean;
  avatar?: string;
  isAdmin?: boolean;
  lat?: number;
  lng?: number;
  role?: 'Admin' | 'Merchant' | 'Rider' | 'Customer';
  points?: number;
  activeCity?: string;
  redeemedVouchers?: Array<{
    id: string;
    code: string;
    type: 'amount' | 'percentage' | 'freedelivery';
    value: number;
    used: boolean;
    description: string;
    minSubtotal?: number;
  }>;
}

interface UserContextType {
  user: UserProfile;
  login: (name: string, phone: string, avatar?: string, address?: string, isAdmin?: boolean) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  firebaseAuthReady: boolean;
  userShop: any | null;
  addPoints: (amount: number) => void;
  deductPoints: (amount: number) => void;
  redeemVoucher: (id: string, code: string, type: 'amount' | 'percentage' | 'freedelivery', value: number, costPoints: number, description: string) => boolean;
  consumeVoucher: (voucherId: string) => void;
  cities: any[];
  changeActiveCity: (cityName: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('grezto_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Strict protection: A user CANNOT be logged in without a valid non-empty phone number
        const hasValidPhone = parsed.phone && parsed.phone.trim() !== "";
        return {
          ...parsed,
          activeCity: parsed.activeCity || 'Kawarhagi',
          points: parsed.points !== undefined ? parsed.points : 150,
          isLoggedIn: hasValidPhone ? (parsed.isLoggedIn ?? false) : false,
          redeemedVouchers: parsed.redeemedVouchers || []
        };
      } catch (e) {
        // Fallback below
      }
    }
    return { 
      name: '', 
      phone: '', 
      address: '', 
      isLoggedIn: false, 
      avatar: '', 
      isAdmin: false, 
      role: 'Customer',
      lat: 26.243455,
      lng: 92.1306235,
      activeCity: '', 
      points: 150,
      redeemedVouchers: []
    };
  });

  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [userShop, setUserShop] = useState<any | null>(null);

  // Sync Rider Role Detection
  useEffect(() => {
    if (!user.isLoggedIn || !user.phone || !supabase) return;
    const cleaned = user.phone.replace(/\D/g, '').slice(-10);
    
    let sub: any;
    
    const checkRole = async () => {
      const { data } = await supabase.from('team').select('*').eq('phone', cleaned).eq('role', 'Rider').maybeSingle();
      if (data) {
        setUser(prev => ({ ...prev, role: 'Rider' }));
      } else if (user.isAdmin) {
        setUser(prev => ({ ...prev, role: 'Admin' }));
      } else if (userShop) {
        setUser(prev => ({ ...prev, role: 'Merchant' }));
      } else {
        setUser(prev => ({ ...prev, role: 'Customer' }));
      }
    };
    checkRole();
    
    if (isSupabaseConfigured()) {
      sub = supabase.channel('user_role_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: `phone=eq.${cleaned}` }, () => {
          checkRole();
        }).subscribe();
    }

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [user.isLoggedIn, user.phone, user.isAdmin, userShop]);

  useEffect(() => {
    // Force the ready state fallback after 2.5 seconds to prevent freezing on any native loading failure
    const timer = setTimeout(() => {
      setFirebaseAuthReady(true);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseAuthReady(true);
        clearTimeout(timer);
      } else {
        // Safe protection: check if we are expecting a phone-logged-in session before falling back to guest mode
        const saved = localStorage.getItem('grezto_user');
        let hasPhone = false;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.phone && parsed.phone.trim() !== "") {
              hasPhone = true;
            }
          } catch (e) {}
        }

        if (!hasPhone) {
          // Automatically trigger anonymous fallback session if there is no active logged-in credential
          signInAnonymously(auth)
            .then(() => {
              // This will shortly trigger the onAuthStateChanged subscription with a valid firebaseUser
            })
            .catch((err) => {
              console.warn("[Firebase Auth] Auto anonymous token failed during initialization:", err);
              setFirebaseAuthReady(true);
              clearTimeout(timer);
            });
        } else {
          // Let the app know Firebase is loaded and bypass anonymous degradation to preserve phone credentials
          setFirebaseAuthReady(true);
          clearTimeout(timer);
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Recover user credentials from native Preferences on mount to persist across OS-level memory clearouts
  useEffect(() => {
    async function recoverUser() {
      try {
        const { getSecureItem } = await import('../services/nativeService');
        const saved = await getSecureItem('grezto_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.phone && parsed.phone.trim() !== '') {
            setUser(prev => ({
              ...prev,
              ...parsed,
              isLoggedIn: parsed.isLoggedIn ?? false
            }));
          } else {
            // Force reset to clean guest mode if stored session is invalid/empty phone
            setUser(prev => ({
              ...prev,
              isLoggedIn: false,
              phone: ''
            }));
          }
        }
      } catch (err) {
        console.warn("[User Recovery] Could not recover native user profile:", err);
      }
    }
    recoverUser();
  }, []);

  useEffect(() => {
    localStorage.setItem('grezto_user', JSON.stringify(user));
    // Asynchronously mirror user data to native Capacitor Preferences
    import('../services/nativeService').then(({ setSecureItem }) => {
      setSecureItem('grezto_user', JSON.stringify(user)).catch(() => {});
    }).catch(() => {});
  }, [user]);

  // Dynamic real-time role configuration for registered merchants/admins/team members
  useEffect(() => {
    if (!firebaseAuthReady || !user.isLoggedIn || !user.phone) {
      setUserShop(null);
      return;
    }

    const cleaned = user.phone.replace(/\D/g, '').slice(-10);
    const predefinedAdmins = ['9864975438', '8638089161', '9101022803'];
    
    if (predefinedAdmins.includes(cleaned)) {
      if (!user.isAdmin) {
        setUser(prev => ({ ...prev, isAdmin: true }));
      }
    }

    let subShops: any;
    let subTeam: any;
    let dbShopMatched: any = null;
    let dbTeamShopMatched: any = null;

    const resolveAndSetUserShop = () => {
      let finalShop = null;
      if (dbShopMatched) {
        finalShop = dbShopMatched;
      } else if (dbTeamShopMatched) {
        finalShop = dbTeamShopMatched;
      }

      setUserShop((prev: any) => {
        if (JSON.stringify(prev) === JSON.stringify(finalShop)) return prev;
        return finalShop;
      });
    };

    const fetchShopRole = async () => {
      try {
        // Fetch cloud profile
        if (supabase) {
          const { data: profileData } = await supabase.from('profiles').select('*').eq('phone', user.phone).maybeSingle();
          if (profileData) {
             setUser(prev => {
                return { 
                   ...prev, 
                   name: profileData.name || prev.name, 
                   address: profileData.address !== null ? profileData.address : prev.address,
                   avatar: profileData.avatar !== null ? profileData.avatar : prev.avatar,
                   points: profileData.points !== undefined ? profileData.points : prev.points 
                };
             });
          }
        }

        // 1. Direct owner match
        const { data: shopsData } = await supabase.from('shops').select('*');
        if (shopsData) {
          const matchDoc = shopsData.find((d: any) => {
            const pClean = (d.ownerPhone || '').replace(/\D/g, '').slice(-10);
            return pClean === cleaned;
          });
          if (matchDoc) {
            dbShopMatched = matchDoc;
          } else {
            dbShopMatched = null;
          }
        }

        // 2. Team member match
        const { data: teamData } = await supabase.from('team').select('*').eq('phone', cleaned).maybeSingle();
        if (teamData && teamData.shopId) {
           const { data: teamShopData } = await supabase.from('shops').select('*').eq('id', teamData.shopId).maybeSingle();
           if (teamShopData) {
              dbTeamShopMatched = teamShopData;
           } else {
              dbTeamShopMatched = null;
           }
        } else {
           dbTeamShopMatched = null;
        }

        resolveAndSetUserShop();
      } catch (err) {
        console.warn("Background privilege check failed:", err);
      }
    };
    fetchShopRole();

    if (isSupabaseConfigured()) {
      subShops = supabase.channel('shop_role_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
          fetchShopRole();
        }).subscribe();
        
      subTeam = supabase.channel('team_role_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team', filter: `phone=eq.${cleaned}` }, () => {
          fetchShopRole();
        }).subscribe();
    }

    return () => {
      if (subShops) subShops.unsubscribe();
      if (subTeam) subTeam.unsubscribe();
    };
  }, [user.phone, user.isLoggedIn, firebaseAuthReady]);

  const addPoints = (amount: number) => {
    setUser(prev => {
      const currentPoints = prev.points !== undefined ? prev.points : 150;
      return { ...prev, points: currentPoints + amount };
    });
  };

  const deductPoints = (amount: number) => {
    setUser(prev => {
      const currentPoints = prev.points !== undefined ? prev.points : 150;
      return { ...prev, points: Math.max(0, currentPoints - amount) };
    });
  };

  const redeemVoucher = (
    id: string,
    code: string,
    type: 'amount' | 'percentage' | 'freedelivery',
    value: number,
    costPoints: number,
    description: string
  ) => {
    let success = false;
    setUser(prev => {
      const currentPoints = prev.points !== undefined ? prev.points : 150;
      if (currentPoints < costPoints) {
        success = false;
        return prev;
      }
      success = true;
      const nextVouchers = prev.redeemedVouchers ? [...prev.redeemedVouchers] : [];
      nextVouchers.push({
        id,
        code,
        type,
        value,
        used: false,
        description,
        minSubtotal: type === 'amount' && value === 100 ? 300 : (type === 'amount' && value === 50 ? 150 : 0)
      });
      return {
        ...prev,
        points: currentPoints - costPoints,
        redeemedVouchers: nextVouchers
      };
    });
    return success;
  };

  const consumeVoucher = (voucherId: string) => {
    setUser(prev => {
      const nextVouchers = prev.redeemedVouchers ? prev.redeemedVouchers.map(v => v.id === voucherId ? { ...v, used: true } : v) : [];
      return {
        ...prev,
        redeemedVouchers: nextVouchers
      };
    });
  };

  const login = (name: string, phone: string, avatar: string = '', address: string = '', isAdmin: boolean = false) => {
    const isOwnerNumber = phone === '9864975438' || phone === '8638089161' || phone === '9101022803';
    
    // Automatically trigger anonymous fallback session if main credential session is not active
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.warn("[Firebase Auth] Anonymous sign-in fallback active:", err);
      });
    }
    
    setUser({
      name,
      phone,
      address,
      isLoggedIn: true,
      avatar,
      isAdmin: isOwnerNumber || isAdmin,
      points: 150,
      redeemedVouchers: []
    });
  };

  const logout = () => {
    auth.signOut().catch(err => console.warn("Firebase signOut error:", err));
    localStorage.removeItem('grezto_active_merchant_shop');
    setUser({ 
      name: '', 
      phone: '', 
      address: '', 
      isLoggedIn: false, 
      avatar: '', 
      isAdmin: false,
      points: 150,
      redeemedVouchers: []
    });
    setUserShop(null);
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    let nextUser: UserProfile;
    setUser(prev => {
      const next = { ...prev, ...data };
      
      // Strict safety guard: Force isLoggedIn to false if phone is missing or empty
      if (!next.phone || next.phone.trim() === "") {
        next.isLoggedIn = false;
      }
      
      const isKnown = next.phone === '9864975438' || next.phone === '8638089161' || next.phone === '9101022803';
      next.isAdmin = isKnown || prev.isAdmin || data.isAdmin || false;
      nextUser = next;
      return next;
    });

    const activePhone = data.phone || user.phone;
    const isUserLoggedIn = data.isLoggedIn !== undefined ? data.isLoggedIn : user.isLoggedIn;

    if (isUserLoggedIn && activePhone) {
      const pName = data.name !== undefined ? (data.name || user.name || 'Grezto Member') : (user.name || 'Grezto Member');
      const pAddress = data.address !== undefined ? (data.address || user.address || '') : (user.address || '');
      const pId = auth.currentUser?.uid || null;

      import('../services/supabase').then(({ callSecureGateway }) => {
        callSecureGateway('upsert_user_profile', {
          p_phone: activePhone,
          p_name: pName,
          p_address: pAddress,
          p_id: pId
        }).then(() => {
          console.log('[SUPABASE VIA GATEWAY] Profile updated successfully!');
        }).catch((err) => {
          console.warn('[SUPABASE VIA GATEWAY] Profile update failed:', err);
        });
      }).catch(err => {
        console.warn('Failed to load secure gateway service:', err);
      });
    }
  };

  const [cities, setCities] = useState<any[]>([]);

  // Real-time Cities Collection Listeners & Bootstrap
  useEffect(() => {
    if (!supabase) return;
    
    let sub: any;
    
    const fetchCities = async () => {
       try {
         const { data } = await supabase.from('cities').select('*');
         if (data && data.length > 0) {
           setCities(data);
         } else {
           const defaultCities = [
             { id: 'kawarhagi', name: 'Kawarhagi', state: 'Assam', lat: 26.243455, lng: 92.1306235, radius: 10, managerName: 'Amina Begum', managerPhone: '8638089161', status: 'active', createdAt: new Date().toISOString() },
             { id: 'guwahati', name: 'Guwahati', state: 'Assam', lat: 26.1158, lng: 91.7086, radius: 15, managerName: 'Dhruba Jyoti', managerPhone: '7577950272', status: 'active', createdAt: new Date().toISOString() },
             { id: 'morigaon', name: 'Morigaon', state: 'Assam', lat: 26.2458, lng: 92.2618, radius: 12, managerName: 'Kabir Ahmed', managerPhone: '9876543210', status: 'active', createdAt: new Date().toISOString() }
           ];
           setCities(defaultCities);
           await supabase.from('cities').upsert(defaultCities);
         }
       } catch (err) {
         console.warn("Cities stream offline or unreadable:", err);
       }
    };
    
    fetchCities();
    
    if (isSupabaseConfigured()) {
      sub = supabase.channel('cities_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, async () => {
           const { data } = await supabase.from('cities').select('*');
           if (data) setCities(data);
        }).subscribe();
    }

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  const changeActiveCity = (cityName: string) => {
    const matchedCity = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
    if (matchedCity) {
      setUser(prev => ({
        ...prev,
        activeCity: matchedCity.name,
        lat: matchedCity.lat,
        lng: matchedCity.lng,
        address: prev.address ? prev.address.replace(/,\s*[A-Za-z0-9\s.-]+\s*\((Pin\s*-\s*\d+)\)/i, `, ${matchedCity.name}, Assam ($1)`) : `${matchedCity.name}, Assam`
      }));
    } else {
      setUser(prev => ({
        ...prev,
        activeCity: cityName
      }));
    }
  };

  return (
    <UserContext.Provider value={{ user, login, logout, updateProfile, firebaseAuthReady, userShop, addPoints, deductPoints, redeemVoucher, consumeVoucher, cities, changeActiveCity }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
