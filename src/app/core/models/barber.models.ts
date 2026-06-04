export interface BarberListItem {
  id: number;
  name: string;
  shopName?: string;
  bio?: string;
  photoUrl?: string;
  price?: number;
  averageRating?: number;
  reviewCount?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  // ✅ Service à domicile
  homeService?: boolean;
}

export interface BarberDetails {
  id: number;
  name: string;
  shopName?: string;
  bio?: string;
  photoUrl?: string;
  price?: number;
  averageRating?: number;
  reviewCount?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  // ✅ Service à domicile
  homeService?: boolean;
}

export interface HomeServiceRequest {
  id?: number;
  status?: string;
  diplomaUrl?: string;
  cinUrl?: string;
  selfieUrl?: string;
  rejectionReason?: string;
  barber?: {
    id: number;
    name: string;
    shopName?: string;
    photoUrl?: string;
  };
}