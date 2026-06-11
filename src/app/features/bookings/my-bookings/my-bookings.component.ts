import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { ReviewService } from '../../../core/services/review.service';

// ✅ Statuts UI enrichis
type UiBookingStatus = 'PENDING' | 'CONFIRMED' | 'AWAITING' | 'COMPLETED' | 'CANCELLED';
type FilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'AWAITING' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, TagModule,
    AvatarModule, MessageModule, LoadingSpinnerComponent,
    ErrorAlertComponent, EmptyStateComponent
  ],
  templateUrl: './my-bookings.component.html',
  styleUrl: './my-bookings.component.css'
})
export class MyBookingsComponent {
  private bookingService = inject(BookingService);
  private sessionService = inject(SessionService);
  private reviewService = inject(ReviewService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  bookings = signal<BookingResponse[]>([]);
  activeFilter = signal<FilterType>('ALL');

  reviewingBookingId = signal<number | null>(null);
  reviewStars = signal(5);
  reviewComment = signal('');
  reviewedBookings = signal<Set<number>>(new Set());

  filteredBookings = computed(() => {
    const filter = this.activeFilter();
    return this.bookings().filter(booking => {
      const mapped = this.mapStatus(booking);
      if (filter === 'ALL') return true;
      return mapped === filter;
    });
  });

  countAll = computed(() => this.bookings().length);
  countPending = computed(() => this.bookings().filter(b => this.mapStatus(b) === 'PENDING').length);
  countConfirmed = computed(() => this.bookings().filter(b => this.mapStatus(b) === 'CONFIRMED').length);
  countAwaiting = computed(() => this.bookings().filter(b => this.mapStatus(b) === 'AWAITING').length);
  countCompleted = computed(() => this.bookings().filter(b => this.mapStatus(b) === 'COMPLETED').length);
  countCancelled = computed(() => this.bookings().filter(b => this.mapStatus(b) === 'CANCELLED').length);

  upcomingBookings = computed(() =>
    this.filteredBookings().filter(booking => {
      const status = this.mapStatus(booking);
      return status === 'PENDING' || status === 'CONFIRMED' || status === 'AWAITING';
    })
  );

  pastBookings = computed(() =>
    this.filteredBookings().filter(booking => {
      const status = this.mapStatus(booking);
      return status === 'COMPLETED' || status === 'CANCELLED';
    })
  );

  constructor() { this.loadBookings(); }

  setFilter(filter: FilterType) {
    this.activeFilter.set(filter);
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
        response.forEach(b => {
          if (b.status === 'COMPLETED') {
            this.reviewService.hasReview(b.id).subscribe({
              next: (has) => {
                if (has) this.reviewedBookings.update(s => new Set([...s, b.id]));
              }
            });
          }
        });
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger les reservations.');
        this.isLoading.set(false);
      }
    });
  }

  cancelBooking(bookingId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.bookingService.cancelBookingByClient(bookingId, { clientId }).subscribe({
      next: (updatedBooking) => {
        this.bookings.update(items =>
          items.map(item => item.id === bookingId ? updatedBooking : item)
        );
        this.successMessage.set('Reservation annulee avec succes.');
        setTimeout(() => this.successMessage.set(''), 2500);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible d\'annuler la reservation.');
      }
    });
  }

  startReview(bookingId: number) {
    this.reviewingBookingId.set(bookingId);
    this.reviewStars.set(5);
    this.reviewComment.set('');
  }

  cancelReview() { this.reviewingBookingId.set(null); }

  submitReview(bookingId: number) {
    const clientId = this.sessionService.userId();
    if (!clientId) return;
    this.reviewService.addReview(
      bookingId, clientId, this.reviewStars(), this.reviewComment()
    ).subscribe({
      next: () => {
        this.reviewedBookings.update(s => new Set([...s, bookingId]));
        this.reviewingBookingId.set(null);
        this.successMessage.set('Merci pour votre avis !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible d\'envoyer l\'avis.');
      }
    });
  }

  // ✅ Labels traduits avec nouveaux statuts
  getStatusLabel(booking: BookingResponse): string {
    const mapped = this.mapStatus(booking);
    switch (mapped) {
      case 'PENDING': return this.langService.isArabic() ? 'قيد الانتظار' : 'En attente';
      case 'CONFIRMED': return this.langService.isArabic() ? 'مؤكد' : 'Confirmee';
      case 'AWAITING': return this.langService.isArabic() ? 'في انتظار الموعد' : 'En attente du RDV';
      case 'COMPLETED': return this.langService.isArabic() ? 'مكتمل' : 'Terminee';
      case 'CANCELLED': return this.langService.isArabic() ? 'ملغى' : 'Annulee';
      default: return '';
    }
  }

  getStatusSeverity(booking: BookingResponse): 'success' | 'warn' | 'danger' | 'contrast' | 'info' {
    const mapped = this.mapStatus(booking);
    switch (mapped) {
      case 'PENDING': return 'warn';
      case 'CONFIRMED': return 'success';
      case 'AWAITING': return 'info';
      case 'COMPLETED': return 'contrast';
      case 'CANCELLED': return 'danger';
      default: return 'warn';
    }
  }

  formatDate(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleDateString(locale);
  }

  formatTime(dateTime: string): string {
    const locale = this.langService.isArabic() ? 'ar-MA' : 'fr-FR';
    return new Date(dateTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('');
  }

  // ✅ Logique statut enrichie
  mapStatus(booking: BookingResponse): UiBookingStatus {
    const status = booking.status;
    const slotTime = new Date(booking.slot.startTime).getTime();
    const now = Date.now();

    switch (status) {
      case 'PENDING': return 'PENDING';
      case 'CONFIRMED':
      case 'ACCEPTED':
        // ✅ Si confirmé mais RDV pas encore passé → En attente du RDV
        if (slotTime > now) return 'AWAITING';
        // ✅ Si confirmé et RDV passé → Terminée
        return 'COMPLETED';
      case 'COMPLETED': return 'COMPLETED';
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT': return 'CANCELLED';
      default: return 'PENDING';
    }
  }
}