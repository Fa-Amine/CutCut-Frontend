import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../core/services/admin.service';
import { LanguageService } from '../../../core/services/language.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { AdminDashboardResponse } from '../../../core/models/admin.models';
import { HomeServiceService } from '../../../core/services/home-service.service';
import { HomeServiceRequest } from '../../../core/models/barber.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, ErrorAlertComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  private adminService = inject(AdminService);
  private homeServiceService = inject(HomeServiceService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  dashboard = signal<AdminDashboardResponse | null>(null);

  // ✅ Home Service Requests
  homeRequests = signal<HomeServiceRequest[]>([]);
  isLoadingRequests = signal(true);
  successMessage = signal('');
  rejectingId = signal<number | null>(null);
  rejectReason = signal('');

  statCards = computed(() => {
    const data = this.dashboard();
    if (!data) return [];
    return [
      { label: this.langService.t().totalUsersLabel, value: data.totalUsers },
      { label: this.langService.t().totalClientsLabel, value: data.totalClients },
      { label: this.langService.t().totalBarbersLabel, value: data.totalBarbers },
      { label: this.langService.t().totalBookingsLabel, value: data.totalBookings },
      { label: this.langService.t().confirmedBookingsLabel, value: data.confirmedBookings },
      { label: this.langService.t().rejectedBookingsLabel, value: data.rejectedBookings },
      { label: this.langService.t().totalRevenueLabel, value: `${data.totalRevenue} MAD` }
    ];
  });

  constructor() {
    this.loadDashboard();
    this.loadHomeRequests();
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.adminService.getDashboard().subscribe({
      next: (response) => {
        this.dashboard.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Impossible de charger le tableau de bord admin.');
        this.isLoading.set(false);
      }
    });
  }

  loadHomeRequests() {
    this.isLoadingRequests.set(true);
    this.homeServiceService.getAllRequests().subscribe({
      next: (requests) => {
        this.homeRequests.set(requests);
        this.isLoadingRequests.set(false);
      },
      error: () => this.isLoadingRequests.set(false)
    });
  }

  approveRequest(requestId: number) {
    this.homeServiceService.approveRequest(requestId).subscribe({
      next: (updated) => {
        this.homeRequests.update(reqs =>
          reqs.map(r => r.id === requestId ? updated : r)
        );
        this.successMessage.set('✅ Demande approuvée !');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    });
  }

  startReject(requestId: number) {
    this.rejectingId.set(requestId);
    this.rejectReason.set('');
  }

  cancelReject() {
    this.rejectingId.set(null);
    this.rejectReason.set('');
  }

  confirmReject(requestId: number) {
    this.homeServiceService.rejectRequest(requestId, this.rejectReason()).subscribe({
      next: (updated) => {
        this.homeRequests.update(reqs =>
          reqs.map(r => r.id === requestId ? updated : r)
        );
        this.rejectingId.set(null);
        this.successMessage.set('❌ Demande refusée.');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    });
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'PENDING': return '⏳ En attente';
      case 'APPROVED': return '✅ Approuvée';
      case 'REJECTED': return '❌ Refusée';
      default: return status;
    }
  }
}