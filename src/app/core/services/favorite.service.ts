import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { BarberListItem } from '../models/barber.models';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  favoriteIds = signal<number[]>([]);
  favorites = signal<BarberListItem[]>([]);

  loadFavorites() {
    const clientId = this.sessionService.userId();
    if (!clientId || !this.sessionService.isClient()) return;
    this.http.get<any[]>(`${this.baseUrl}/clients/${clientId}/favorites`).subscribe({
      next: (favs) => {
        this.favorites.set(favs);
        this.favoriteIds.set(favs.map((f: any) => f.id));
      },
      error: () => {}
    });
  }

  toggleFavorite(barberId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;

    if (this.favoriteIds().includes(barberId)) {
      // ✅ Mise à jour immédiate AVANT la requête
      this.favoriteIds.update(ids => ids.filter(id => id !== barberId));
      this.favorites.update(favs => favs.filter((f: any) => f.id !== barberId));

      this.http.delete(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`).subscribe({
        error: () => {
          // ❌ Si erreur → on remet
          this.favoriteIds.update(ids => [...ids, barberId]);
          this.loadFavorites();
        }
      });
    } else {
      // ✅ Mise à jour immédiate AVANT la requête
      this.favoriteIds.update(ids => [...ids, barberId]);

      this.http.post(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`, {}).subscribe({
        next: () => {
          this.loadFavorites();
        },
        error: () => {
          // ❌ Si erreur → on remet
          this.favoriteIds.update(ids => ids.filter(id => id !== barberId));
        }
      });
    }
  }

  isFavorite = computed(() => (barberId: number) => {
    return this.favoriteIds().includes(barberId);
  });
}