import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Review {
  id: number;
  stars: number;
  comment?: string;
  createdAt: string;
  client: { id: number; name: string; };
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  addReview(bookingId: number, clientId: number, stars: number, comment: string) {
    return this.http.post<Review>(`${this.base}/reviews`, { bookingId, clientId, stars, comment });
  }

  getBarberReviews(barberId: number) {
    return this.http.get<Review[]>(`${this.base}/reviews/barber/${barberId}`);
  }

  hasReview(bookingId: number) {
    return this.http.get<boolean>(`${this.base}/reviews/booking/${bookingId}/exists`);
  }
}