import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CancelBookingRequest,
  CompleteBookingRequest,
  CreateBookingRequest,
  BookingResponse
} from '../models/booking.models';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  createBooking(payload: CreateBookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.baseUrl}/bookings`, payload);
  }

  getClientBookings(clientId: number): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(`${this.baseUrl}/bookings/client/${clientId}`);
  }

  getBarberBookings(barberId: number): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(`${this.baseUrl}/bookings/barber/${barberId}`);
  }

  acceptBooking(bookingId: number): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.baseUrl}/bookings/${bookingId}/accept`, {});
  }

  rejectBooking(bookingId: number): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.baseUrl}/bookings/${bookingId}/reject`, {});
  }

  completeBookingByBarber(
    bookingId: number,
    payload: CompleteBookingRequest
  ): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.baseUrl}/bookings/${bookingId}/complete`, payload);
  }

  cancelBookingByClient(
    bookingId: number,
    payload: CancelBookingRequest
  ): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.baseUrl}/bookings/${bookingId}/cancel`, payload);
  }
}