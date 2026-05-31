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

  private getStorageKey(): string {
    return `favorites_${this.sessionService.userId()}`;
  }

  // ✅ Charge depuis localStorage d'abord
  private loadFromStorage(): number[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  // ✅ Sauvegarde dans localStorage
  private saveToStorage(ids: number[]) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(ids));
    } catch {}
  }

  loadFavorites() {
    const clientId = this.sessionService.userId();
    if (!clientId || !this.sessionService.isClient()) return;

    // ✅ Charge localStorage immédiatement
    const storedIds = this.loadFromStorage();
    if (storedIds.length > 0) {
      this.favoriteIds.set(storedIds);
    }

    // Puis sync avec le backend
    this.http.get<any[]>(`${this.baseUrl}/clients/${clientId}/favorites`).subscribe({
      next: (favs) => {
        const ids = favs.map((f: any) => f.id);
        this.favorites.set(favs);
        this.favoriteIds.set(ids);
        this.saveToStorage(ids);
      },
      error: () => {
        // EC2 down → garde localStorage
      }
    });
  }

  toggleFavorite(barberId: number, barber?: BarberListItem) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;

    if (this.favoriteIds().includes(barberId)) {
      // ✅ Supprime immédiatement
      const newIds = this.favoriteIds().filter(id => id !== barberId);
      this.favoriteIds.set(newIds);
      this.favorites.update(favs => favs.filter((f: any) => f.id !== barberId));
      this.saveToStorage(newIds);

      this.http.delete(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`).subscribe({
        error: () => {
          // EC2 down → garde localStorage
        }
      });
    } else {
      // ✅ Ajoute immédiatement
      const newIds = [...this.favoriteIds(), barberId];
      this.favoriteIds.set(newIds);
      this.saveToStorage(newIds);

      this.http.post(`${this.baseUrl}/clients/${clientId}/favorites/${barberId}`, {}).subscribe({
        next: () => { this.loadFavorites(); },
        error: () => {
          // EC2 down → garde localStorage
        }
      });
    }
  }

  isFavorite = computed(() => (barberId: number) => {
    return this.favoriteIds().includes(barberId);
  });
}