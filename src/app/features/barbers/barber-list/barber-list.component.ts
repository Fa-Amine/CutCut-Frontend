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

  private map: any = null;
  private mapInitialized = false;

  filteredBarbers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.barbers().filter((barber) => {
      if (!term) return true;
      return (
        barber.name.toLowerCase().includes(term) ||
        (barber.shopName ?? '').toLowerCase().includes(term) ||
        (barber.bio ?? '').toLowerCase().includes(term)
      );
    });
  });

  constructor() {
    this.loadLeaflet();
    this.loadBarbers();
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
      }
    }
  }

  initMap() {
    this.mapInitialized = true;
    this.map = L.map('barbers-map').setView([33.9716, -6.8498], 12);
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  attribution: '© Google Maps'
}).addTo(this.map);
    const barbersWithLocation = this.filteredBarbers().filter(
      b => b.latitude && b.longitude
    );

    barbersWithLocation.forEach(barber => {
      const marker = L.marker([barber.latitude!, barber.longitude!]);

      const popup = `
        <div style="text-align:center; min-width:150px;">
          ${barber.photoUrl
            ? `<img src="${barber.photoUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin-bottom:8px;" />`
            : `<div style="width:60px;height:60px;border-radius:50%;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin:0 auto 8px;">${this.getInitials(barber.name)}</div>`
          }
          <strong style="display:block;color:#0f172a;">${barber.name}</strong>
          <span style="color:#64748b;font-size:0.85rem;">${barber.shopName || 'CutCut'}</span>
          <br/>
          <span style="color:#2563eb;font-weight:700;">${barber.price ?? 0} MAD</span>
          <br/>
          <button onclick="window.location.href='/barbers/${barber.id}'"
            style="margin-top:8px;background:#2563eb;color:white;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;">
            Voir le profil
          </button>
        </div>
      `;

      marker.bindPopup(popup).addTo(this.map);
    });

    if (barbersWithLocation.length > 0) {
      const bounds = L.latLngBounds(
        barbersWithLocation.map(b => [b.latitude!, b.longitude!])
      );
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
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les barbiers.'
        );
        this.isLoading.set(false);
      }
    });
  }

  setSearch(value: string) {
    this.searchTerm.set(value);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}