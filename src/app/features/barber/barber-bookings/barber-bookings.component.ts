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

@Component({
  selector: 'app-barber-bookings',
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
  templateUrl: './barber-bookings.component.html',
  styleUrl: './barber-bookings.component.css'
})
export class BarberBookingsComponent {
  private bookingService = inject(BookingService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  bookings = signal<BookingResponse[]>([]);

  todayBookings = computed(() => {
    const today = new Date().toISOString().slice(0, 10);

    return this.bookings().filter(
      (booking) => booking.slot.startTime.slice(0, 10) === today
    );
  });

  upcomingClientsCount = computed(() =>
    this.bookings().filter((booking) => {
      const status = booking.status;
      return status === 'PENDING' || status === 'ACCEPTED' || status === 'CONFIRMED';
    }).length
  );

  constructor() {
    this.loadBookings();
  }

  loadBookings() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.bookingService.getBarberBookings(barberId).subscribe({
      next: (response) => {
        this.bookings.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les réservations du barbier.'
        );
        this.isLoading.set(false);
      }
    });
  }

  acceptBooking(bookingId: number) {
    this.bookingService.acceptBooking(bookingId).subscribe({
      next: (updatedBooking) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === bookingId ? updatedBooking : item))
        );
        this.errorMessage.set('');
        this.successMessage.set('Réservation acceptée.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible d’accepter la réservation.'
        );
      }
    });
  }

  rejectBooking(bookingId: number) {
    this.bookingService.rejectBooking(bookingId).subscribe({
      next: (updatedBooking) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === bookingId ? updatedBooking : item))
        );
        this.errorMessage.set('');
        this.successMessage.set('Réservation rejetée.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de rejeter la réservation.'
        );
      }
    });
  }

  completeBooking(bookingId: number) {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      return;
    }

    this.bookingService.completeBookingByBarber(bookingId, {
      barberId: Number(barberId)
    }).subscribe({
      next: (updatedBooking) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === bookingId ? updatedBooking : item))
        );
        this.errorMessage.set('');
        this.successMessage.set('Réservation marquée comme terminée.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de terminer la réservation.'
        );
      }
    });
  }

  getStatusLabel(status: BookingResponse['status']) {
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED':
        return this.langService.t().confirmed;
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
        return this.langService.t().cancelled;
      case 'COMPLETED':
        return this.langService.t().completed;
      default:
        return this.langService.t().pending;
    }
  }

  getStatusSeverity(status: BookingResponse['status']): 'warn' | 'success' | 'contrast' | 'danger' {
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED':
        return 'success';
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
        return 'danger';
      case 'COMPLETED':
        return 'contrast';
      default:
        return 'warn';
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
}