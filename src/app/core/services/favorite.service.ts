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

  private getKey(): string {
    return `fav_${this.sessionService.userId()}`;
  }

  private loadFromStorage(): number[] {
    try {
      const s = localStorage.getItem(this.getKey());
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }

  private saveToStorage(ids: number[]) {
    try {
      localStorage.setItem(this.getKey(), JSON.stringify(ids));
    } catch {}
  }

  loadFavorites() {
    const clientId = this.sessionService.userId();
    if (!clientId || !this.sessionService.isClient()) return;

    // ✅ Charge localStorage immédiatement
    const stored = this.loadFromStorage();
    if (stored.length > 0) {
      this.favoriteIds.set(stored);
    }

    // ✅ Sync avec backend
    this.http.get<any[]>(`${this.baseUrl}/clients/${clientId}/favorites`).subscribe({
      next: (favs) => {
        const ids = favs.map((f: any) => f.id);

        // ✅ Ne pas écraser si backend vide mais localStorage a des données
        if (ids.length > 0) {
          this.favorites.set(favs);
          this.favoriteIds.set(ids);
          this.saveToStorage(ids);
        } else if (stored.length > 0) {
          // Backend vide mais localStorage a des données → garde localStorage
          this.favoriteIds.set(stored);
        }
      },
      error: () => {
        // API down → garde localStorage
        if (stored.length > 0) {
          this.favoriteIds.set(stored);
        }
      }
    });
  }

  toggleFavorite(barberId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;

    if (this.favoriteIds().includes(barberId)) {
      const newIds = this.favoriteIds().filter(id => id !== barberId);
      this.favoriteIds.set(newIds);
      this.saveToStorage(newIds);
      this.favorites.update(favs => favs.filter((f: any) => f.id !== barberId));

      this.http.delete(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`).subscribe({
        error: () => {}
      });

    } else {
      const newIds = [...this.favoriteIds(), barberId];
      this.favoriteIds.set(newIds);
      this.saveToStorage(newIds);

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