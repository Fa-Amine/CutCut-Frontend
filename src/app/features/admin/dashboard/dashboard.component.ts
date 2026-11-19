import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { AdminDashboardResponse } from '../../../core/models/admin.models';
import { PrivateHomeService } from '../../../core/services/private-home-service.service';
import { HomeServiceAdminComponent } from '../home-service/home-service-admin.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  // ✅ FormsModule ajouté ici
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent, ErrorAlertComponent, HomeServiceAdminComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  readonly privateApi = inject(PrivateHomeService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  errorMessage = signal('');
  dashboard = signal<AdminDashboardResponse | null>(null);

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
      { label: this.langService.t().totalRevenueLabel, value: `${data.totalRevenue} DH` }
    ];
  });

  constructor() {
    if (this.privateApi.ready()) this.loadDashboard();
    else this.isLoading.set(false);
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.privateApi.adminDashboard().subscribe({
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

}
