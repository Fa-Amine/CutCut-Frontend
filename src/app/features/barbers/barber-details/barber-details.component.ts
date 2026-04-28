import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';

import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { BarberDetails } from '../../../core/models/barber.models';
import { AvailabilityService } from '../../../core/services/availability.service';
import { AvailabilitySlot } from '../../../core/models/availability.models';
import { BookingService } from '../../../core/services/booking.service';
import { SessionService } from '../../../core/services/session.service';

import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

interface DayGroup {
  dateKey: string;
  label: string;
  slots: AvailabilitySlot[];
}

@Component({
  selector: 'app-barber-details',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    AvatarModule,
    TagModule,
    MessageModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent
  ],
  templateUrl: './barber-details.component.html',
  styleUrl: './barber-details.component.css'
})
export class BarberDetailsComponent {
  private route = inject(ActivatedRoute);
  private barberService = inject(BarberService);
  private availabilityService = inject(AvailabilityService);
  private bookingService = inject(BookingService);
  private sessionService = inject(SessionService);

  langService = inject(LanguageService);

  isLoading = signal(true);
  isBooking = signal(false);
  errorMessage = signal('');
  successMessage = signal(false);

  barber = signal<BarberDetails | null>(null);
  slots = signal<AvailabilitySlot[]>([]);

  selectedDay = signal<string | null>(null);
  selectedSlot = signal<AvailabilitySlot | null>(null);

  dayGroups = computed<DayGroup[]>(() => {
    const map = new Map<string, AvailabilitySlot[]>();

    for (const slot of this.slots()) {
      if (slot.booked) continue;

      const dateKey = slot.startTime.slice(0, 10);

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }

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
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!id || Number.isNaN(id)) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.loadPageData(id);
  }

  loadPageData(barberId: number) {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.barberService.getBarberById(barberId).subscribe({
      next: (barberResponse) => {
        this.barber.set(barberResponse);

        this.reloadSlots(barberId, () => {
          this.isLoading.set(false);
        });
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les détails du barbier.'
        );
        this.isLoading.set(false);
      }
    });
  }

  private reloadSlots(barberId: number, onDone?: () => void) {
    this.availabilityService.getAvailableSlotsByBarber(barberId).subscribe({
      next: (slotsResponse) => {
        const onlyAvailable = slotsResponse.filter((slot) => !slot.booked);
        this.slots.set(onlyAvailable);

        const stillValidSelectedDay = this.selectedDay()
          && this.dayGroups().some((g) => g.dateKey === this.selectedDay());

        if (!stillValidSelectedDay) {
          this.selectedDay.set(this.dayGroups()[0]?.dateKey ?? null);
        }

        const currentSelectedSlot = this.selectedSlot();
        if (currentSelectedSlot) {
          const stillExists = onlyAvailable.some((slot) => slot.id === currentSelectedSlot.id);
          if (!stillExists) {
            this.selectedSlot.set(null);
          }
        }

        onDone?.();
      },
      error: () => {
        this.errorMessage.set('Impossible de recharger les disponibilités.');
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
    this.selectedSlot.set(slot);
    this.errorMessage.set('');
  }

  confirmBooking() {
    const barber = this.barber();
    const slot = this.selectedSlot();
    const clientId = this.sessionService.userId();

    if (!barber || !slot || !clientId) {
      this.errorMessage.set('Impossible de confirmer la réservation.');
      return;
    }

    this.isBooking.set(true);
    this.errorMessage.set('');

    this.bookingService.createBooking({
      clientId,
      barberId: barber.id,
      slotId: slot.id
    }).subscribe({
      next: () => {
        this.isBooking.set(false);
        this.successMessage.set(true);

        this.reloadSlots(barber.id);
        this.selectedSlot.set(null);

        setTimeout(() => this.successMessage.set(false), 2500);
      },
      error: (error) => {
        this.isBooking.set(false);

        const rawMessage =
          error?.error?.message ||
          error?.error?.error ||
          error?.message ||
          '';

        const normalized = String(rawMessage).toLowerCase();

        if (
          normalized.includes('slot') ||
          normalized.includes('booked') ||
          normalized.includes('invalid') ||
          normalized.includes('missing')
        ) {
          this.errorMessage.set('Ce créneau n’est plus disponible. Veuillez en choisir un autre.');
          this.selectedSlot.set(null);
          this.reloadSlots(barber.id);
          return;
        }

        this.errorMessage.set(
          error?.error?.message || 'Impossible de créer la réservation.'
        );
      }
    });
  }

  formatTime(dateTime: string): string {
    return new Date(dateTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateLabel(dateKey: string): string {
    const date = new Date(dateKey);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
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