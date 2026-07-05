export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  imageUrl2?: string;
  imageUrl3?: string;
  imageUrl4?: string;
  imageUrl5?: string;
  description?: string;
  unit?: string;
  stock: number;
  discount?: number;
  shopId?: string;
  shopName?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface Shop {
  id: string;
  name: string;
  type: 'grocery' | 'hotel';
  category: string;
  address: string;
  ownerPhone: string;
  ownerName: string;
  isOpen?: boolean;
  status: 'active' | 'blocked' | string;
  imageUrl?: string;
  rating: string;
  ratingCount: number;
  lat: number;
  lng: number;
  pinned: boolean;
  joinedAt?: string;
  description?: string;
}

export interface TeamMember {
  id?: string;
  name: string;
  phone: string;
  role: 'Rider' | 'Store Manager' | 'Picker/Packer' | string;
  vehicle: string;
  status: 'Online' | 'Offline' | 'Busy' | string;
  rating: string;
  completedOrders: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  amount?: number;
  totalAmount?: number;
  status: 'Pending' | 'Accepted' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | string;
  items: OrderItem[] | string[];
  partnerName?: string;
  partnerPhone?: string;
  createdAt?: any;
  parsedCreatedAt?: string;
  paymentMethod?: string;
  lat?: number;
  lng?: number;
}

export interface UserProfile {
  name: string;
  phone: string;
  isLoggedIn: boolean;
  photoUrl?: string;
  address?: string;
  points?: number;
  redeemedVouchers?: any[];
}
