export interface ClientProfile {
    id: number;
    name: string;
    email: string;
    phone: string;
    role?: 'CLIENT';
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
  }
  
  export interface UpdateClientRequest {
    name: string;
    email: string;
    phone: string;
  }
  
  export interface UpdateBarberRequest {
    name: string;
    email: string;
    phone: string;
    shopName: string;
    bio?: string;
    photoUrl?: string;
    price: number;
  }