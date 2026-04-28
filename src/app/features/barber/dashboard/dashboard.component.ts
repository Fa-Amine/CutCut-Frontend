import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../../core/services/language.service';
import { SessionService } from '../../../core/services/session.service';
import { BarberService } from '../../../core/services/barber.service';
import { BookingService } from '../../../core/services/booking.service';
import { BarberDashboardResponse } from '../../../core/models/dashboard.models';
import { BookingResponse } from '../../../core/models/booking.models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    CardModule,
    TagModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  langService = inject(LanguageService);
  private sessionService = inject(SessionService);
  private barberService = inject(BarberService);
  private bookingService = inject(BookingService);

  isLoading = signal(true);
  errorMessage = signal('');
  dashboard = signal<BarberDashboardResponse | null>(null);
  recentBookings = signal<BookingResponse[]>([]);

  upcomingBookings = computed(() =>
    this.recentBookings()
      .filter(booking => {
        const start = new Date(booking.slot.startTime).getTime();
        return start >= Date.now() &&
          booking.status !== 'REJECTED' &&
          booking.status !== 'CANCELLED' &&
          booking.status !== 'CANCELLED_BY_CLIENT' &&
          booking.status !== 'COMPLETED';
      })
      .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime))
      .slice(0, 3)
  );

  constructor() {
    this.loadDashboard();
  }

  loadDashboard() {
    const barberId = this.sessionService.userId();

    if (!barberId) {
      this.errorMessage.set('Barbier introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.barberService.getBarberDashboard(barberId).subscribe({
      next: (dashboardResponse) => {
        this.dashboard.set(dashboardResponse);

        this.bookingService.getBarberBookings(barberId).subscribe({
          next: (bookingsResponse) => {
            this.recentBookings.set(bookingsResponse);
            this.isLoading.set(false);
          },
          error: () => {
            this.recentBookings.set([]);
            this.isLoading.set(false);
          }
        });
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger le tableau de bord.'
        );
        this.isLoading.set(false);
      }
    });
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

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'contrast' {
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED':
        return 'success';
      case 'COMPLETED':
        return 'contrast';
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
        return 'danger';
      default:
        return 'warn';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACCEPTED':
      case 'CONFIRMED':
        return this.langService.t().confirmed;
      case 'COMPLETED':
        return this.langService.t().completed;
      case 'REJECTED':
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
        return this.langService.t().cancelled;
      default:
        return this.langService.t().pending;
    }
  }
}