import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
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
    CommonModule, ButtonModule, TagModule, AvatarModule, MessageModule,
    LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent
  ],
  templateUrl: './barber-bookings.component.html',
  styleUrl: './barber-bookings.component.css'
})
export class BarberBookingsComponent implements OnDestroy {
  private bookingService = inject(BookingService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  bookings = signal<BookingResponse[]>([]);
  now = signal(Date.now());

  private timer: any;

  sortedBookings = computed(() => {
    const order: Record<string, number> = {
      'PENDING': 0,
      'CONFIRMED': 1,
      'ACCEPTED': 1,
      'COMPLETED': 2,
      'REJECTED': 3,
      'CANCELLED': 3,
      'CANCELLED_BY_CLIENT': 3
    };
    return [...this.bookings()].sort((a, b) => {
      const statusDiff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.slot.startTime).getTime() - new Date(a.slot.startTime).getTime();
    });
  });

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
    this.timer = setInterval(() => {
      this.now.set(Date.now());
    }, 30000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  canCancelBooking(booking: BookingResponse): boolean {
    if (booking.status === 'PENDING') return true;
    if (booking.status !== 'CONFIRMED' && booking.status !== 'ACCEPTED') return false;
    if (!booking.confirmedAt) return true;
    const confirmedAt = new Date(booking.confirmedAt).getTime();
    const tenMinutes = 10 * 60 * 1000;
    return (this.now() - confirmedAt) < tenMinutes;
  }

  canCompleteBooking(booking: BookingResponse): boolean {
    if (booking.status !== 'CONFIRMED' && booking.status !== 'ACCEPTED') return false;
    const slotTime = new Date(booking.slot.startTime).getTime();
    return this.now() >= slotTime;
  }

  getRemainingTime(booking: BookingResponse): string {
    if (!booking.confirmedAt) return '';
    const confirmedAt = new Date(booking.confirmedAt).getTime();
    const tenMinutes = 10 * 60 * 1000;
    const remaining = tenMinutes - (this.now() - confirmedAt);
    if (remaining <= 0) return '';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        this.errorMessage.set(error?.error?.message || 'Impossible de charger les reservations.');
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
        this.successMessage.set('Reservation acceptee.');
        setTimeout(() => this.successMessage.set(''), 2500);
        this.loadBookings();
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible d\'accepter la reservation.');
      }
    });
  }

  rejectBooking(bookingId: number, booking: BookingResponse) {
    const barberId = this.sessionService.userId();
    if (!barberId) return;

    if (booking.status === 'CONFIRMED' || booking.status === 'ACCEPTED') {
      this.bookingService.cancelBookingByBarber(bookingId, Number(barberId)).subscribe({
        next: (updatedBooking) => {
          this.bookings.update((items) =>
            items.map((item) => (item.id === bookingId ? updatedBooking : item))
          );
          this.successMessage.set('Reservation annulee.');
          setTimeout(() => this.successMessage.set(''), 2500);
          this.loadBookings();
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Impossible d\'annuler la reservation.');
        }
      });
    } else {
      this.bookingService.rejectBooking(bookingId).subscribe({
        next: (updatedBooking) => {
          this.bookings.update((items) =>
            items.map((item) => (item.id === bookingId ? updatedBooking : item))
          );
          this.successMessage.set('Reservation rejetee.');
          setTimeout(() => this.successMessage.set(''), 2500);
          this.loadBookings();
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message || 'Impossible de rejeter la reservation.');
        }
      });
    }
  }

  completeBooking(bookingId: number) {
    const barberId = this.sessionService.userId();
    if (!barberId) return;
    this.bookingService.completeBookingByBarber(bookingId, {
      barberId: Number(barberId)
    }).subscribe({
      next: (updatedBooking) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === bookingId ? updatedBooking : item))
        );
        this.successMessage.set('Reservation marquee comme terminee.');
        setTimeout(() => this.successMessage.set(''), 2500);
        this.loadBookings();
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de terminer la reservation.');
      }
    });
  }

  getStatusLabel(booking: BookingResponse): string {
    const status = booking.status;
    const slotTime = new Date(booking.slot.startTime).getTime();
    const now = this.now();

    if ((status === 'CONFIRMED' || status === 'ACCEPTED') && slotTime > now) {
      return this.langService.isArabic() ? 'في انتظار الموعد' : 'En attente du RDV';
    }
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED': return this.langService.t().confirmed;
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT': return this.langService.t().cancelled;
      case 'COMPLETED': return this.langService.t().completed;
      default: return this.langService.t().pending;
    }
  }

  getStatusSeverity(booking: BookingResponse): 'warn' | 'success' | 'contrast' | 'danger' | 'info' {
    const status = booking.status;
    const slotTime = new Date(booking.slot.startTime).getTime();
    const now = this.now();

    if ((status === 'CONFIRMED' || status === 'ACCEPTED') && slotTime > now) {
      return 'info';
    }
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED': return 'success';
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT': return 'danger';
      case 'COMPLETED': return 'contrast';
      default: return 'warn';
    }
  }

  formatDate(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleDateString(locale);
  }

  formatTime(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleTimeString(locale, {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }
}