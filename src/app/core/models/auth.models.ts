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

// ✅ Interface service pour l'onboarding
export interface OnboardingService {
  name: string;
  price: number;
  description?: string;
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
  category?: string;
  // ✅ Services onboarding
  services?: OnboardingService[];
}

export interface AuthResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}