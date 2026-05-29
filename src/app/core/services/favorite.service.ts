import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { BarberListItem } from '../models/barber.models';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  favoriteIds = signal<Set<number>>(new Set());
  favorites = signal<BarberListItem[]>([]);

  loadFavorites() {
    const clientId = this.sessionService.userId();
    if (!clientId || !this.sessionService.isClient()) return;

    this.http.get<any[]>(`${this.baseUrl}/clients/${clientId}/favorites`).subscribe({
      next: (favs) => {
        this.favorites.set(favs);
        this.favoriteIds.set(new Set(favs.map((f: any) => f.id)));
      },
      error: () => {}
    });
  }

  toggleFavorite(barberId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;

    if (this.favoriteIds().has(barberId)) {
      this.http.delete(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`).subscribe({
        next: () => {
          this.favoriteIds.update(ids => {
            const newIds = new Set(ids);
            newIds.delete(barberId);
            return newIds;
          });
          this.favorites.update(favs => favs.filter((f: any) => f.id !== barberId));
        }
      });
    } else {
      this.http.post(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`, {}).subscribe({
        next: () => {
          this.favoriteIds.update(ids => new Set([...ids, barberId]));
          this.loadFavorites();
        }
      });
    }
  }

  isFavorite(barberId: number): boolean {
    return this.favoriteIds().has(barberId);
  }
}