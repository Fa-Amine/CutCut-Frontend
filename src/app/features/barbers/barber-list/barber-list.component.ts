import { Component, computed, inject, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { BarberListItem } from '../../../core/models/barber.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

declare const L: any;

@Component({
  selector: 'app-barber-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    AvatarModule,
    TagModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent
  ],
  templateUrl: './barber-list.component.html',
  styleUrl: './barber-list.component.css'
})
export class BarberListComponent implements AfterViewChecked {
  private barberService = inject(BarberService);
  private router = inject(Router);
  langService = inject(LanguageService);

  searchTerm = signal('');
  isLoading = signal(true);
  errorMessage = signal('');
  barbers = signal<BarberListItem[]>([]);
  viewMode = signal<'list' | 'map'>('list');
  userLat = signal<number | null>(null);
  userLng = signal<number | null>(null);
  isLocating = signal(false);
  sortByDistance = signal(false);

  private map: any = null;
  private mapInitialized = false;
  private userMarker: any = null;

  filteredBarbers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    let result = this.barbers().filter((barber) => {
      if (!term) return true;
      return (
        barber.name.toLowerCase().includes(term) ||
        (barber.shopName ?? '').toLowerCase().includes(term) ||
        (barber.bio ?? '').toLowerCase().includes(term)
      );
    });

    if (this.sortByDistance() && this.userLat() && this.userLng()) {
      result = [...result].sort((a, b) => {
        const distA = this.calculateDistance(this.userLat()!, this.userLng()!, a.latitude ?? 0, a.longitude ?? 0);
        const distB = this.calculateDistance(this.userLat()!, this.userLng()!, b.latitude ?? 0, b.longitude ?? 0);
        return distA - distB;
      });
    }

    return result;
  });

  barbersWithDistance = computed(() => {
    return this.filteredBarbers().map(barber => ({
      ...barber,
      distance: this.userLat() && this.userLng() && barber.latitude && barber.longitude
        ? this.calculateDistance(this.userLat()!, this.userLng()!, barber.latitude, barber.longitude)
        : null
    }));
  });

  constructor() {
    this.loadLeaflet();
    this.loadBarbers();
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  locateMe() {
    if (!navigator.geolocation) {
      this.errorMessage.set('La geolocalisation n\'est pas supportee par votre navigateur.');
      return;
    }
    this.isLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.userLat.set(position.coords.latitude);
        this.userLng.set(position.coords.longitude);
        this.sortByDistance.set(true);
        this.isLocating.set(false);

        if (this.map && this.viewMode() === 'map') {
          if (this.userMarker) this.userMarker.remove();
          this.userMarker = L.marker(
            [position.coords.latitude, position.coords.longitude],
            { title: 'Votre position' }
          ).addTo(this.map);
          this.userMarker.bindPopup('Vous etes ici').openPopup();
          this.map.setView([position.coords.latitude, position.coords.longitude], 13);
        }
      },
      () => {
        this.isLocating.set(false);
        this.errorMessage.set('Impossible de recuperer votre position.');
      }
    );
  }

  loadLeaflet() {
    if (!(window as any).L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(script);
    }
  }

  ngAfterViewChecked() {
    if (this.viewMode() === 'map' && !this.mapInitialized && !this.isLoading()) {
      const mapEl = document.getElementById('barbers-map');
      if (mapEl && (window as any).L) {
        this.initMap();
      }
    }
    if (this.viewMode() === 'list') {
      this.mapInitialized = false;
      if (this.map) {
        this.map.remove();
        this.map = null;
        this.userMarker = null;
      }
    }
  }

  initMap() {
    this.mapInitialized = true;
    const centerLat = this.userLat() || 33.9716;
    const centerLng = this.userLng() || -6.8498;
    this.map = L.map('barbers-map').setView([centerLat, centerLng], 12);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 19
    }).addTo(this.map);

    if (this.userLat() && this.userLng()) {
      this.userMarker = L.marker([this.userLat()!, this.userLng()!])
        .addTo(this.map);
      this.userMarker.bindPopup('Vous etes ici').openPopup();
    }

    const barbersWithLocation = this.filteredBarbers().filter(b => b.latitude && b.longitude);

    barbersWithLocation.forEach(barber => {
      const dist = this.userLat() && this.userLng() && barber.latitude && barber.longitude
        ? this.calculateDistance(this.userLat()!, this.userLng()!, barber.latitude, barber.longitude).toFixed(1)
        : null;

      const marker = L.marker([barber.latitude!, barber.longitude!]);
      const popup = `
        <div style="text-align:center; min-width:150px;">
          ${barber.photoUrl
            ? `<img src="${barber.photoUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin-bottom:8px;" />`
            : `<div style="width:60px;height:60px;border-radius:50%;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin:0 auto 8px;">${this.getInitials(barber.name)}</div>`
          }
          <strong style="display:block;color:#171717;">${barber.name}</strong>
          <span style="color:#737373;font-size:0.85rem;">${barber.shopName || 'CutCut'}</span>
          <br/>
          <span style="color:#171717;font-weight:700;">${barber.price ?? 0} MAD</span>
          ${dist ? `<br/><span style="color:#16a34a;font-size:0.85rem;">${dist} km</span>` : ''}
          <br/>
          <button onclick="window.location.href='/barbers/${barber.id}'"
            style="margin-top:8px;background:#171717;color:white;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;">
            Voir le profil
          </button>
        </div>
      `;
      marker.bindPopup(popup).addTo(this.map);
    });

    if (barbersWithLocation.length > 0) {
      const bounds = L.latLngBounds(barbersWithLocation.map(b => [b.latitude!, b.longitude!]));
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  setViewMode(mode: 'list' | 'map') {
    this.viewMode.set(mode);
    this.mapInitialized = false;
  }

  loadBarbers() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.barberService.getAllBarbers().subscribe({
      next: (response) => {
        this.barbers.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger les barbiers.');
        this.isLoading.set(false);
      }
    });
  }

  setSearch(value: string) {
    this.searchTerm.set(value);
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }
}