import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface BarberPhoto {
  id: number;
  imageUrl: string;
  caption?: string;
  likeCount: number;
  createdAt: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class BarberPhotoService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  getBarberPhotos(barberId: number) {
    return this.http.get<BarberPhoto[]>(`${this.base}/barbers/${barberId}/photos`);
  }

  getBarberPhotosByCategory(barberId: number, category: string) {
    return this.http.get<BarberPhoto[]>(`${this.base}/barbers/${barberId}/photos/category/${category}`);
  }

  addBarberPhoto(barberId: number, imageUrl: string, caption: string, category: string) {
    return this.http.post<BarberPhoto>(`${this.base}/barbers/${barberId}/photos`, { imageUrl, caption, category });
  }

  deleteBarberPhoto(barberId: number, photoId: number) {
    return this.http.delete(`${this.base}/barbers/${barberId}/photos/${photoId}`);
  }
}