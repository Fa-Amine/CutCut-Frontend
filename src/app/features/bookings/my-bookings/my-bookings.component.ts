import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { MessageModule } from 'primeng/message';

import { LanguageService } from '../../../core/services/language.service';
import { BookingService } from '../../../core/services/booking.service';
import { SessionService } from '../../../core/services/session.service';
import { BookingResponse } from '../../../core/models/booking.models';

import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

type UiBookingStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    AvatarModule,
    MessageModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent
  ],
  templateUrl: './my-bookings.component.html',
  styleUrl: './my-bookings.component.css'
})
export class MyBookingsComponent {
  private bookingService = inject(BookingService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  bookings = signal<BookingResponse[]>([]);

  upcomingBookings = computed(() =>
    this.bookings().filter((booking) => {
      const start = new Date(booking.slot.startTime).getTime();
      const status = booking.status;

      return (
        start >= Date.now() &&
        status !== 'REJECTED' &&
        status !== 'CANCELLED' &&
        status !== 'CANCELLED_BY_CLIENT'
      );
    })
  );

  pastBookings = computed(() =>
    this.bookings().filter((booking) => {
      const start = new Date(booking.slot.startTime).getTime();
      const status = booking.status;

      return (
        start < Date.now() ||
        status === 'REJECTED' ||
        status === 'CANCELLED' ||
        status === 'CANCELLED_BY_CLIENT' ||
        status === 'COMPLETED'
      );
    })
  );

  constructor() {
    this.loadBookings();
  }

  loadBookings() {
    const clientId = this.sessionService.userId();

    if (!clientId) {
      this.errorMessage.set('Utilisateur introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.bookingService.getClientBookings(clientId).subscribe({
      next: (response) => {
        this.bookings.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les réservations.'
        );
        this.isLoading.set(false);
      }
    });
  }

  cancelBooking(bookingId: number) {
    const clientId = this.sessionService.userId();

    if (!clientId) {
      this.errorMessage.set('Utilisateur introuvable.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    this.bookingService.cancelBookingByClient(bookingId, { clientId }).subscribe({
      next: (updatedBooking) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === bookingId ? updatedBooking : item))
        );
        this.successMessage.set('Réservation annulée avec succès.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible d’annuler la réservation.'
        );
      }
    });
  }

  getStatusLabel(status: BookingResponse['status']) {
    const mapped = this.mapStatus(status);

    switch (mapped) {
      case 'CONFIRMED':
        return this.langService.t().confirmed;
      case 'PENDING':
        return this.langService.t().pending;
      case 'CANCELLED':
        return this.langService.t().cancelled;
      case 'COMPLETED':
        return this.langService.t().completed;
    }
  }

  getStatusSeverity(status: BookingResponse['status']): 'success' | 'warn' | 'danger' | 'contrast' {
    const mapped = this.mapStatus(status);

    switch (mapped) {
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warn';
      case 'CANCELLED':
        return 'danger';
      case 'COMPLETED':
        return 'contrast';
    }
  }

  formatDate(dateTime: string): string {
    return new Date(dateTime).toLocaleDateString();
  }

  formatTime(dateTime: string): string {
    return new Date(dateTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
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

  private mapStatus(status: BookingResponse['status']): UiBookingStatus {
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED':
        return 'CONFIRMED';
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
        return 'CANCELLED';
      case 'COMPLETED':
        return 'COMPLETED';
      default:
        return 'PENDING';
    }
  }
}