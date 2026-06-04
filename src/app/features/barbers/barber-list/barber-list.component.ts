import { Component, computed, inject, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);
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
  selectedCategory = signal<'ALL' | 'HOMME' | 'FEMME'>('ALL');

  private map: any = null;
  private mapInitialized = false;
  private userMarker: any = null;
  private markers: any[] = [];
  private currentRoute: any = null;

  isFavorite = computed(() => (barberId: number) => {
    return this.favoriteService.favoriteIds().includes(barberId);
  });

  filteredBarbers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();
    let result = this.barbers().filter((barber) => {
      if (category !== 'ALL' && barber.category !== category) return false;
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
    const category = this.route.snapshot.queryParamMap.get('category');
    if (category === 'FEMME') this.selectedCategory.set('FEMME');
    if (category === 'HOMME') this.selectedCategory.set('HOMME');
    (window as any).showRoute = (destLat: number, destLng: number) => {
      this.showRouteOnMap(destLat, destLng);
    };
  }

  setCategory(category: 'ALL' | 'HOMME' | 'FEMME') {
    this.selectedCategory.set(category);
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

  showRouteOnMap(destLat: number, destLng: number) {
    const userLat = this.userLat();
    const userLng = this.userLng();
    if (!userLat || !userLng) {
      alert('📍 Activez votre localisation d\'abord !');
      return;
    }
    if (this.currentRoute) {
      this.map.removeLayer(this.currentRoute);
      this.currentRoute = null;
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
          this.currentRoute = L.polyline(coords, {
            color: '#171717', weight: 5, opacity: 0.9,
            lineJoin: 'round', lineCap: 'round'
          }).addTo(this.map);
          this.map.fitBounds(this.currentRoute.getBounds(), { padding: [50, 50] });
          const duration = Math.round(data.routes[0].duration / 60);
          const distance = (data.routes[0].distance / 1000).toFixed(1);
          L.popup()
            .setLatLng([destLat, destLng])
            .setContent(`
              <div style="font-family:inherit;padding:4px;">
                <strong style="color:#171717;">🗺️ Itinéraire</strong><br>
                <span style="color:#16a34a;font-weight:600;">📏 ${distance} km</span> &nbsp;
                <span style="color:#737373;">⏱ ~${duration} min</span>
              </div>
            `)
            .openOn(this.map);
        }
      })
      .catch(() => alert('Impossible de calculer l\'itinéraire.'));
  }

  locateMe() {
    if (!navigator.geolocation) {
      this.errorMessage.set('La géolocalisation n\'est pas supportée.');
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
            { icon: this.createUserIcon() }
          ).addTo(this.map);
          this.userMarker.bindPopup('<strong>📍 Vous êtes ici</strong>').openPopup();
          this.map.flyTo([position.coords.latitude, position.coords.longitude], 14, {
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

  createUserIcon() {
    return L.divIcon({
      html: `
        <div style="
          width:20px; height:20px;
          background:#3b82f6;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 0 5px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      className: '', iconSize: [20, 20], iconAnchor: [10, 10]
    });
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
        this.currentRoute = null;
      }
    }
  }

  createBarberIcon(barber: BarberListItem): any {
    const initials = this.getInitials(barber.name);
    const isFemale = barber.category === 'FEMME';
    const bgColor = isFemale ? '#ec4899' : '#171717';
    const photo = barber.photoUrl
      ? `<img src="${barber.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : `<span style="color:white;font-weight:700;font-size:0.85rem;">${initials}</span>`;

    return L.divIcon({
      html: `
        <div style="position:relative;">
          <div style="
            width:48px; height:48px;
            background:${bgColor};
            border:3px solid white;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 4px 16px rgba(0,0,0,0.35);
            overflow:hidden;
            cursor:pointer;
            transition:transform 0.2s;
          ">
            ${photo}
          </div>
          <div style="
            position:absolute;
            bottom:-8px;
            left:50%;
            transform:translateX(-50%);
            width:0; height:0;
            border-left:7px solid transparent;
            border-right:7px solid transparent;
            border-top:10px solid ${bgColor};
          "></div>
        </div>
      `,
      className: '', iconSize: [48, 58], iconAnchor: [24, 58], popupAnchor: [0, -60]
    });
  }

  initMap() {
    this.mapInitialized = true;
    const centerLat = this.userLat() || 31.7917;
    const centerLng = this.userLng() || -7.0926;

    this.map = L.map('barbers-map', {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 19
    }).setView([centerLat, centerLng], 6);

    // ✅ Tile CartoDB — affiche le Maroc correctement (Sahara inclus)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Zoom controls modernes
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Marqueur utilisateur
    if (this.userLat() && this.userLng()) {
      this.userMarker = L.marker(
        [this.userLat()!, this.userLng()!],
        { icon: this.createUserIcon() }
      ).addTo(this.map);
      this.userMarker.bindPopup('<strong>📍 Vous êtes ici</strong>');
    }

    // Marqueurs barbiers
    const barbersWithLocation = this.filteredBarbers().filter(b => b.latitude && b.longitude);
    barbersWithLocation.forEach(barber => {
      const dist = this.userLat() && this.userLng() && barber.latitude && barber.longitude
        ? this.calculateDistance(this.userLat()!, this.userLng()!, barber.latitude, barber.longitude).toFixed(1)
        : null;

      const icon = this.createBarberIcon(barber);
      const marker = L.marker([barber.latitude!, barber.longitude!], { icon });

      const popup = L.popup({
        maxWidth: 240,
        className: 'cutcut-popup',
        closeButton: true
      }).setContent(`
        <div style="padding:8px; min-width:200px; font-family:'Inter',sans-serif;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            ${barber.photoUrl
              ? `<img src="${barber.photoUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #e5e5e5;flex-shrink:0;" />`
              : `<div style="width:52px;height:52px;border-radius:50%;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;flex-shrink:0;">${this.getInitials(barber.name)}</div>`
            }
            <div>
              <strong style="display:block;color:#171717;font-size:1rem;margin-bottom:2px;">${barber.name}</strong>
              <span style="color:#737373;font-size:0.82rem;">${barber.shopName || 'CutCut'}</span><br>
              <span style="font-size:0.75rem;">${barber.category === 'FEMME' ? '💇‍♀️ Coiffeuse' : '🧔 Barbier'}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:8px;background:#f9f9f9;border-radius:10px;">
            <span style="font-weight:700;color:#171717;font-size:0.9rem;">${barber.price ?? 0} MAD</span>
            ${barber.averageRating ? `<span style="color:#f59e0b;font-size:0.82rem;">⭐ ${barber.averageRating}</span>` : ''}
            ${dist ? `<span style="color:#16a34a;font-size:0.82rem;font-weight:600;">📍 ${dist} km</span>` : ''}
          </div>

          <button onclick="window.location.href='/barbers/${barber.id}'"
            style="width:100%;background:#171717;color:white;border:none;padding:10px 0;border-radius:12px;cursor:pointer;font-size:0.9rem;font-weight:700;font-family:inherit;margin-bottom:8px;transition:opacity 0.2s;"
            onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
            ✂️ Voir & Réserver
          </button>

          <button onclick="window.showRoute(${barber.latitude}, ${barber.longitude})"
            style="width:100%;background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;padding:9px 0;border-radius:12px;cursor:pointer;font-size:0.88rem;font-weight:600;font-family:inherit;">
            🗺️ Itinéraire
          </button>
        </div>
      `);

      marker.bindPopup(popup);
      marker.addTo(this.map);
      this.markers.push(marker);
    });

    // ✅ Centrer sur les barbiers s'ils existent, sinon sur le Maroc complet
    if (barbersWithLocation.length > 0) {
      const bounds = L.latLngBounds(barbersWithLocation.map(b => [b.latitude!, b.longitude!]));
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else {
      // ✅ Vue complète du Maroc (Sahara inclus)
      this.map.fitBounds([
        [20.7, -17.1], // Sud-Ouest (Sahara)
        [35.9, -1.0]   // Nord-Est
      ]);
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