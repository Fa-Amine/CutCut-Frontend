export interface ClientProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  role?: 'CLIENT';
  photoUrl?: string;
}

export interface BarberProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  shopName?: string;
  bio?: string;
  photoUrl?: string;
  price?: number;
  averageRating?: number;
  reviewCount?: number;
  walletBalance?: number;
  role?: 'BARBER';
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateClientRequest {
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
}

export interface UpdateBarberRequest {
  name: string;
  email: string;
  phone: string;
  shopName: string;
  bio?: string;
  photoUrl?: string;
  price: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}