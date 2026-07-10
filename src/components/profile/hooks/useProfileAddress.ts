import { useState, useEffect } from 'react';
import { useUser } from '../../../context/UserContext';
import toast from 'react-hot-toast';

export function useProfileAddress() {
  const { user, updateProfile } = useUser();

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addrState, setAddrState] = useState('Assam');
  const [addrCity, setAddrCity] = useState('');
  const [addrStreetArea, setAddrStreetArea] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [showAddNewAddress, setShowAddNewAddress] = useState(false);

  useEffect(() => {
    if (user.address) {
      const parts = user.address.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        setAddrState(parts[parts.length - 1] || 'Assam');
        setAddrCity(parts[parts.length - 2] || '');
        setAddrStreetArea(parts.slice(0, parts.length - 2).join(', '));
      } else if (parts.length === 2) {
        setAddrStreetArea(parts[0]);
        setAddrCity(parts[1]);
        setAddrState('Assam');
      } else {
        setAddrStreetArea(user.address);
        setAddrCity('');
        setAddrState('Assam');
      }
    }
  }, [user.address]);

  useEffect(() => {
    if (user.isLoggedIn && user.phone) {
      const stored = localStorage.getItem(`grezto_saved_addresses_user_${user.phone}`);
      if (stored) {
        setSavedAddresses(JSON.parse(stored));
      } else if (user.address) {
        const seed = [user.address];
        setSavedAddresses(seed);
        localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(seed));
      } else {
        setSavedAddresses([]);
      }
    } else {
      setSavedAddresses([]);
    }
  }, [user.isLoggedIn, user.phone, user.address]);

  const handleSaveAddress = () => {
    if (!user.isLoggedIn) {
      return toast.error("Please Login or Sign up to save your address! 🌿");
    }
    if (addrState.trim() === "" || addrCity.trim() === "" || addrStreetArea.trim() === "") {
      return toast.error("All three address fields (State, City/Village, Street/Area) are absolutely required!");
    }
    const combinedAddress = `${addrStreetArea.trim()}, ${addrCity.trim()}, ${addrState.trim()}`;
    
    const updated = [...savedAddresses];
    if (!updated.includes(combinedAddress)) {
      updated.push(combinedAddress);
    }
    setSavedAddresses(updated);
    localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(updated));
    
    updateProfile({ address: combinedAddress });
    setShowAddNewAddress(false);
    toast.success("New Address Saved & Set as Default!");
    
    setAddrCity('');
    setAddrStreetArea('');
  };

  const handleSelectAddress = (addr: string) => {
    updateProfile({ address: addr });
    toast.success("Default address changed! 🚚");
  };

  const handleDeleteAddress = (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAddresses.filter(a => a !== addr);
    setSavedAddresses(updated);
    localStorage.setItem(`grezto_saved_addresses_user_${user.phone}`, JSON.stringify(updated));
    
    if (user.address === addr) {
      const nextActive = updated.length > 0 ? updated[0] : '';
      updateProfile({ address: nextActive });
    }
    toast.success("Address deleted successfully.");
  };

  return {
    isEditingAddress,
    setIsEditingAddress,
    addrState,
    setAddrState,
    addrCity,
    setAddrCity,
    addrStreetArea,
    setAddrStreetArea,
    savedAddresses,
    setSavedAddresses,
    showAddNewAddress,
    setShowAddNewAddress,
    handleSaveAddress,
    handleSelectAddress,
    handleDeleteAddress
  };
}
