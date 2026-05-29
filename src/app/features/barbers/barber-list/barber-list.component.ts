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
import { FavoriteService } from '../../../core/services/favorite.service';
import { SessionService } from '../../../core/services/session.service';
import { BarberListItem } from '../../../core/models/barber.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

declare const L: any;

@Component({
  selector: 'app-barber-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    InputTextModule, ButtonModule, AvatarModule, TagModule,
    LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent
  ],
  templateUrl: './barber-list.component.html',
  styleUrl: './barber-list.component.css'
})
export class BarberListComponent implements AfterViewChecked {
  private barberService = inject(BarberService);
  private router = inject(Router);
  langService = inject(LanguageService);
  favoriteService = inject(FavoriteService);
  sessionService = inject(SessionService);

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
  private markers: any[] = [];

  isFavorite = computed(() => (barberId: number) => {
    return this.favoriteService.favoriteIds().includes(barberId);
  });

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
    this.favoriteService.loadFavorites();
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
      this.errorMessage.set('La geolocalisation n\'est pas supportee.');
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
          const userIcon = L.divIcon({
            html: `<div style="
              width:18px; height:18px; background:#3b82f6;
              border:3px solid white; border-radius:50%;
              box-shadow:0 0 0 4px rgba(59,130,246,0.3);">
            </div>`,
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });
          this.userMarker = L.marker(
            [position.coords.latitude, position.coords.longitude],
            { icon: userIcon }
          ).addTo(this.map);
          this.userMarker.bindPopup('<strong>📍 Vous êtes ici</strong>').openPopup();
          this.map.flyTo([position.coords.latitude, position.coords.longitude], 13, {
            animate: true, duration: 1.5
          });
        }
      },
      () => {
        this.isLocating.set(false);
        this.errorMessage.set('Impossible de récupérer votre position.');
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
      if (mapEl && (window as any).L) this.initMap();
    }
    if (this.viewMode() === 'list') {
      this.mapInitialized = false;
      if (this.map) {
        this.map.remove();
        this.map = null;
        this.userMarker = null;
        this.markers = [];
      }
    }
  }

  createBarberIcon(barber: BarberListItem): any {
    const initials = this.getInitials(barber.name);
    const photo = barber.photoUrl
      ? `<img src="${barber.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : `<span style="color:white;font-weight:700;font-size:0.85rem;">${initials}</span>`;

    return L.divIcon({
      html: `
        <div style="
          width:44px; height:44px;
          background:#171717;
          border:3px solid white;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 4px 12px rgba(0,0,0,0.3);
          overflow:hidden;
          cursor:pointer;
        ">
          ${photo}
        </div>
        <div style="
          width:0; height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid white;
          margin:0 auto;
          margin-top:-2px;
        "></div>
      `,
      className: '',
      iconSize: [44, 52],
      iconAnchor: [22, 52],
      popupAnchor: [0, -54]
    });
  }

  initMap() {
    this.mapInitialized = true;
    const centerLat = this.userLat() || 33.9716;
    const centerLng = this.userLng() || -6.8498;

    this.map = L.map('barbers-map', {
      zoomControl: false,
      attributionControl: true
    }).setView([centerLat, centerLng], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    if (this.userLat() && this.userLng()) {
      const userIcon = L.divIcon({
        html: `<div style="
          width:18px; height:18px; background:#3b82f6;
          border:3px solid white; border-radius:50%;
          box-shadow:0 0 0 4px rgba(59,130,246,0.3);">
        </div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      this.userMarker = L.marker([this.userLat()!, this.userLng()!], { icon: userIcon })
        .addTo(this.map);
      this.userMarker.bindPopup('<strong>📍 Vous êtes ici</strong>');
    }

    const barbersWithLocation = this.filteredBarbers().filter(b => b.latitude && b.longitude);

    barbersWithLocation.forEach(barber => {
      const dist = this.userLat() && this.userLng() && barber.latitude && barber.longitude
        ? this.calculateDistance(this.userLat()!, this.userLng()!, barber.latitude, barber.longitude).toFixed(1)
        : null;

      // ✅ URL itinéraire Google Maps
      const directionsUrl = this.userLat() && this.userLng()
        ? `https://www.google.com/maps/dir/?api=1&origin=${this.userLat()},${this.userLng()}&destination=${barber.latitude},${barber.longitude}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${barber.latitude},${barber.longitude}&travelmode=driving`;

      const icon = this.createBarberIcon(barber);
      const marker = L.marker([barber.latitude!, barber.longitude!], { icon });

      const popup = L.popup({
        maxWidth: 230,
        className: 'custom-popup'
      }).setContent(`
        <div style="padding:4px; min-width:190px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            ${barber.photoUrl
              ? `<img src="${barber.photoUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #e5e5e5;" />`
              : `<div style="width:48px;height:48px;border-radius:50%;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">${this.getInitials(barber.name)}</div>`
            }
            <div style="text-align:left;">
              <strong style="display:block;color:#171717;font-size:0.95rem;">${barber.name}</strong>
              <span style="color:#737373;font-size:0.8rem;">${barber.shopName || 'CutCut'}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="background:#f5f5f5;padding:3px 10px;border-radius:20px;font-size:0.82rem;font-weight:700;color:#171717;">
              ${barber.price ?? 0} MAD
            </span>
            ${dist ? `<span style="color:#16a34a;font-size:0.82rem;font-weight:600;">📍 ${dist} km</span>` : ''}
          </div>

          <button onclick="window.location.href='/barbers/${barber.id}'"
            style="width:100%;background:#171717;color:white;border:none;padding:9px 0;border-radius:10px;cursor:pointer;font-size:0.88rem;font-weight:600;font-family:inherit;margin-bottom:7px;">
            ✂️ Réserver
          </button>

          <a href="${directionsUrl}" target="_blank"
            style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;padding:8px 0;border-radius:10px;cursor:pointer;font-size:0.88rem;font-weight:600;font-family:inherit;text-decoration:none;box-sizing:border-box;">
            🗺️ Itinéraire
          </a>
        </div>
      `);

      marker.bindPopup(popup);
      marker.addTo(this.map);
      this.markers.push(marker);
    });

    if (barbersWithLocation.length > 0) {
      const bounds = L.latLngBounds(barbersWithLocation.map(b => [b.latitude!, b.longitude!]));
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
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

  setSearch(value: string) { this.searchTerm.set(value); }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }
}