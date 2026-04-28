export type UserRole = 'CLIENT' | 'BARBER' | 'ADMIN';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterClientRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterBarberRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  shopName: string;
  bio?: string;
  photoUrl?: string;
  price: number;
}

export interface AuthResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}