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
  // ✅ Nouveau champ
  category?: string;
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
  // ✅ Nouveau champ
  category?: string;
}