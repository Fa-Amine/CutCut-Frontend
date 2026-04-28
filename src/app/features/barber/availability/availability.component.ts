import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { InputTextModule } from 'primeng/inputtext';

import { LanguageService } from '../../../core/services/language.service';
import { AvailabilityService } from '../../../core/services/availability.service';
import { SessionService } from '../../../core/services/session.service';
import { AvailabilitySlot } from '../../../core/models/availability.models';

import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface DayGroup {
  dateKey: string;
  label: string;
  slots: AvailabilitySlot[];
}

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    MessageModule,
    InputTextModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent
  ],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.css'
})
export class AvailabilityComponent {
  private availabilityService = inject(AvailabilityService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  slots = signal<AvailabilitySlot[]>([]);

  newDate = signal('');
  newStartTime = signal('');

  groupedSlots = computed<DayGroup[]>(() => {
    const map = new Map<string, AvailabilitySlot[]>();

    for (const slot of this.slots()) {
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

  constructor() {
    this.loadSlots();
  }

  loadSlots() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.availabilityService.getAvailableSlotsByBarber(barberId).subscribe({
      next: (response) => {
        this.slots.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les disponibilités.'
        );
        this.isLoading.set(false);
      }
    });
  }

  addSlot() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      return;
    }

    if (!this.newDate() || !this.newStartTime()) {
      this.errorMessage.set('Veuillez choisir une date et une heure de début.');
      return;
    }

    const normalizedStartTime = this.normalizeTime(this.newStartTime());
    if (!normalizedStartTime) {
      this.errorMessage.set('Heure de début invalide.');
      return;
    }

    const roundedStartTime = this.roundToNearestHalfHour(normalizedStartTime);
    const endTimeOnly = this.addThirtyMinutesToTime(roundedStartTime);

    const startTime = `${this.newDate()}T${roundedStartTime}:00`;
    const endTime = `${this.newDate()}T${endTimeOnly}:00`;

    const hasOverlap = this.slots().some((slot) => {
      const slotDate = slot.startTime.slice(0, 10);
      if (slotDate !== this.newDate()) {
        return false;
      }

      const existingStart = slot.startTime.slice(11, 16);
      const existingEnd = slot.endTime.slice(11, 16);

      return roundedStartTime < existingEnd && endTimeOnly > existingStart;
    });

    if (hasOverlap) {
      this.errorMessage.set('Ce créneau existe déjà ou chevauche un créneau existant.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    this.availabilityService.addSlot(barberId, { startTime, endTime }).subscribe({
      next: (response) => {
        this.slots.update((items) => [...items, response]);
        this.newDate.set('');
        this.newStartTime.set('');
        this.isSaving.set(false);
        this.successMessage.set('Créneau ajouté avec succès.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(
          error?.error?.message || 'Impossible d’ajouter le créneau.'
        );
      }
    });
  }

  private normalizeTime(value: string): string | null {
    const trimmed = value.trim();

    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return null;
    }

    let hours = Number(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();

    if (period === 'AM' && hours === 12) {
      hours = 0;
    } else if (period === 'PM' && hours !== 12) {
      hours += 12;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  private roundToNearestHalfHour(time: string): string {
    const [hoursStr, minutesStr] = time.split(':');
    let hours = Number(hoursStr);
    let minutes = Number(minutesStr);

    if (minutes === 0 || minutes === 30) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    if (minutes < 30) {
      minutes = 30;
    } else {
      minutes = 0;
      hours += 1;
    }

    if (hours === 24) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private addThirtyMinutesToTime(time: string): string {
    let [hours, minutes] = time.split(':').map(Number);

    minutes += 30;
    if (minutes >= 60) {
      minutes -= 60;
      hours += 1;
    }

    if (hours >= 24) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
      weekday: 'long',
      day: '2-digit',
      month: 'short'
    });
  }

  clearError() {
    this.errorMessage.set('');
  }
}