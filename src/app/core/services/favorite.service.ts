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

  // ✅ Stockage en mémoire (fonctionne toujours)
  private localIds: number[] = [];

  loadFavorites() {
    const clientId = this.sessionService.userId();
    if (!clientId || !this.sessionService.isClient()) return;

    // ✅ Charge mémoire locale immédiatement
    if (this.localIds.length > 0) {
      this.favoriteIds.set([...this.localIds]);
    }

    // Sync avec backend
    this.http.get<any[]>(`${this.baseUrl}/clients/${clientId}/favorites`).subscribe({
      next: (favs) => {
        const ids = favs.map((f: any) => f.id);
        this.favorites.set(favs);
        this.favoriteIds.set(ids);
        this.localIds = [...ids];
      },
      error: () => {
        // API down → garde mémoire locale
      }
    });
  }

  toggleFavorite(barberId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;

    if (this.favoriteIds().includes(barberId)) {
      // ✅ Supprime immédiatement en mémoire
      const newIds = this.favoriteIds().filter(id => id !== barberId);
      this.favoriteIds.set(newIds);
      this.localIds = [...newIds];
      this.favorites.update(favs => favs.filter((f: any) => f.id !== barberId));

      this.http.delete(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`).subscribe({
        error: () => {}
      });

    } else {
      // ✅ Ajoute immédiatement en mémoire
      const newIds = [...this.favoriteIds(), barberId];
      this.favoriteIds.set(newIds);
      this.localIds = [...newIds];

      this.http.post(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`, {}).subscribe({
        next: () => { this.loadFavorites(); },
        error: () => {}
      });
    }
  }

  isFavorite = computed(() => (barberId: number) => {
    return this.favoriteIds().includes(barberId);
  });
}