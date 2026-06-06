import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { BarberDetails } from '../../../core/models/barber.models';
import { AvailabilityService } from '../../../core/services/availability.service';
import { AvailabilitySlot } from '../../../core/models/availability.models';
import { BookingService } from '../../../core/services/booking.service';
import { BarberServiceService } from '../../../core/services/barber-service.service';
import { SessionService } from '../../../core/services/session.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { SafeUrlPipe } from '../../../core/pipes/safe-url.pipe';
import { BarberPhotoService, BarberPhoto } from '../../../core/services/barber-photo.service';
import { ReviewService, Review } from '../../../core/services/review.service';
import { BarberServiceItem } from '../../../core/models/booking.models';

declare const L: any;

interface DayGroup {
  dateKey: string;
  label: string;
  slots: AvailabilitySlot[];
}

@Component({
  selector: 'app-barber-details',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ButtonModule, CardModule,
    AvatarModule, TagModule, MessageModule, ToastModule,
    LoadingSpinnerComponent, ErrorAlertComponent, SafeUrlPipe
  ],
  providers: [MessageService],
  templateUrl: './barber-details.component.html',
  styleUrl: './barber-details.component.css'
})
export class BarberDetailsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private barberService = inject(BarberService);
  private availabilityService = inject(AvailabilityService);
  private bookingService = inject(BookingService);
  private barberServiceService = inject(BarberServiceService);
  private messageService = inject(MessageService);
  sessionService = inject(SessionService);
  private barberPhotoService = inject(BarberPhotoService);
  private reviewService = inject(ReviewService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  isBooking = signal(false);
  errorMessage = signal('');
  successMessage = signal(false);

  barber = signal<BarberDetails | null>(null);
  slots = signal<AvailabilitySlot[]>([]);
  photos = signal<BarberPhoto[]>([]);
  reviews = signal<Review[]>([]);

  services = signal<BarberServiceItem[]>([]);
  selectedServiceIds = signal<number[]>([]);
  lightboxPhoto = signal<string | null>(null);
  selectedDay = signal<string | null>(null);
  selectedSlot = signal<AvailabilitySlot | null>(null);

  private viewMap: any = null;
  private mapInitialized = false;

  totalPrice = computed(() => {
    const selected = this.services().filter(s =>
      this.selectedServiceIds().includes(s.id)
    );
    if (selected.length === 0) return 0;
    return selected.reduce((sum, s) => sum + s.price, 0);
  });

  dayGroups = computed<DayGroup[]>(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const map = new Map<string, AvailabilitySlot[]>();

    for (const slot of this.slots()) {
      const dateKey = slot.startTime.slice(0, 10);
      if (dateKey < todayKey) continue;
      if (dateKey === todayKey) {
        const slotTime = new Date(slot.startTime);
        if (slotTime <= now) continue;
      }
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(slot);
    }

    return Array.from(map.entries())
      .map(([dateKey, slots]) => ({
        dateKey,
        label: this.formatDateLabel(dateKey),
        slots: slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  });

  availableSlots = computed(() => {
    const day = this.selectedDay();
    if (!day) return [];
    const group = this.dayGroups().find((g) => g.dateKey === day);
    return group?.slots ?? [];
  });

  constructor() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }
    this.loadPageData(id);
  }

  // ✅ tryInitMap simplifié - Leaflet déjà chargé dans index.html
  tryInitMap() {
    const barber = this.barber();
    if (!barber?.latitude || !barber?.longitude) return;
    if (this.mapInitialized) return;

    const mapEl = document.getElementById('view-map');
    if (!mapEl) {
      setTimeout(() => this.tryInitMap(), 200);
      return;
    }

    this.mapInitialized = true;
    this.viewMap = L.map('view-map', {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([barber.latitude, barber.longitude], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.viewMap);

    L.marker([barber.latitude, barber.longitude]).addTo(this.viewMap);
  }

  loadPageData(barberId: number) {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.barberService.getBarberById(barberId).subscribe({
      next: (barberResponse) => {
        this.barber.set(barberResponse);
        this.reloadSlots(barberId, () => {
          this.isLoading.set(false);
          // ✅ Init map après rendu
          setTimeout(() => this.tryInitMap(), 300);
        });
        this.loadPhotos(barberId);
        this.loadReviews(barberId);
        this.loadServices(barberId);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger les details du barbier.');
        this.isLoading.set(false);
      }
    });
  }

  loadServices(barberId: number) {
    this.barberServiceService.getServices(barberId).subscribe({
      next: (services) => this.services.set(services),
      error: () => {}
    });
  }

  toggleService(serviceId: number) {
    const current = this.selectedServiceIds();
    if (current.includes(serviceId)) {
      this.selectedServiceIds.set(current.filter(id => id !== serviceId));
    } else {
      this.selectedServiceIds.set([...current, serviceId]);
    }
  }

  isServiceSelected(serviceId: number): boolean {
    return this.selectedServiceIds().includes(serviceId);
  }

  openLightbox(url: string) { this.lightboxPhoto.set(url); }
  closeLightbox() { this.lightboxPhoto.set(null); }

  loadPhotos(barberId: number) {
    this.barberPhotoService.getBarberPhotos(barberId).subscribe({
      next: (photos) => this.photos.set(photos),
      error: () => {}
    });
  }

  loadReviews(barberId: number) {
    this.reviewService.getBarberReviews(barberId).subscribe({
      next: (reviews) => this.reviews.set(reviews),
      error: () => {}
    });
  }

  getStars(count: number): string { return '⭐'.repeat(count); }

  private reloadSlots(barberId: number, onDone?: () => void) {
    this.availabilityService.getAllSlotsByBarber(barberId).subscribe({
      next: (slotsResponse) => {
        this.slots.set(slotsResponse);
        const stillValidSelectedDay = this.selectedDay()
          && this.dayGroups().some((g) => g.dateKey === this.selectedDay());
        if (!stillValidSelectedDay) {
          this.selectedDay.set(this.dayGroups()[0]?.dateKey ?? null);
        }
        const currentSelectedSlot = this.selectedSlot();
        if (currentSelectedSlot) {
          const stillExists = slotsResponse.some(
            (slot) => slot.id === currentSelectedSlot.id && !slot.booked
          );
          if (!stillExists) this.selectedSlot.set(null);
        }
        onDone?.();
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de recharger les disponibilites.');
        onDone?.();
      }
    });
  }

  chooseDay(day: string) {
    this.selectedDay.set(day);
    this.selectedSlot.set(null);
    this.errorMessage.set('');
  }

  chooseSlot(slot: AvailabilitySlot) {
    if (slot.booked) return;
    this.selectedSlot.set(slot);
    this.errorMessage.set('');
  }

  confirmBooking() {
    const barber = this.barber();
    const slot = this.selectedSlot();

    if (this.sessionService.isGuest()) {
      this.router.navigate(['/login'], {
        queryParams: { redirect: '/barbers/' + barber?.id }
      });
      return;
    }

    const clientId = this.sessionService.userId();
    if (!barber || !slot || !clientId) {
      this.errorMessage.set('Impossible de confirmer la reservation.');
      return;
    }

    this.isBooking.set(true);
    this.errorMessage.set('');

    this.bookingService.createBooking({
      clientId,
      barberId: barber.id,
      slotId: slot.id,
      serviceIds: this.selectedServiceIds().length > 0 ? this.selectedServiceIds() : undefined
    }).subscribe({
      next: () => {
        this.isBooking.set(false);
        this.successMessage.set(true);
        this.reloadSlots(barber.id);
        this.selectedSlot.set(null);
        this.selectedServiceIds.set([]);
        this.messageService.add({
          severity: 'success',
          summary: 'Reservation confirmee !',
          detail: `Votre rendez-vous a ete enregistre. Total : ${this.totalPrice()} MAD`,
          life: 4000
        });
        setTimeout(() => this.successMessage.set(false), 2500);
      },
      error: (error) => {
        this.isBooking.set(false);
        const rawMessage = error?.error?.message || error?.error?.error || error?.message || '';
        const normalized = String(rawMessage).toLowerCase();
        if (normalized.includes('slot') || normalized.includes('booked') ||
            normalized.includes('invalid') || normalized.includes('missing')) {
          this.errorMessage.set('Ce creneau n\'est plus disponible. Veuillez en choisir un autre.');
          this.selectedSlot.set(null);
          this.reloadSlots(barber.id);
          return;
        }
        this.errorMessage.set(error?.error?.message || 'Impossible de creer la reservation.');
      }
    });
  }

  formatTime(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleTimeString(locale, {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  formatDateLabel(dateKey: string): string {
    const date = new Date(dateKey);
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
  }

  formatDate(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleDateString(locale);
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }

  getMapUrl(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}`;
  }
}