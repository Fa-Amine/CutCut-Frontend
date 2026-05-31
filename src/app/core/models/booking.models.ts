export interface CreateBookingRequest {
  clientId: number;
  barberId: number;
  slotId: number;
  serviceIds?: number[];
}

export interface CancelBookingRequest {
  clientId: number;
}

export interface CompleteBookingRequest {
  barberId: number;
}

export interface BookingSlot {
  id: number;
  startTime: string;
  endTime: string;
  booked: boolean;
}

export interface BookingBarber {
  id: number;
  name: string;
  shopName?: string;
  photoUrl?: string;
}

export interface BookingClient {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

// ✅ Nouveau modèle service
export interface BarberServiceItem {
  id: number;
  name: string;
  price: number;
  description?: string;
}

export interface BookingResponse {
  id: number;
  client: BookingClient;
  barber: BookingBarber;
  slot: BookingSlot;
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'CANCELLED_BY_CLIENT';
  servicePrice: number;
  commissionAmount: number;
  createdAt: string;
  confirmedAt?: string;
  services?: BarberServiceItem[];
}