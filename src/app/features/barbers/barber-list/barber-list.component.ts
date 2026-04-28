import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';

import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { BarberListItem } from '../../../core/models/barber.models';

import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-barber-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    AvatarModule,
    TagModule,
    LoadingSpinnerComponent,
    ErrorAlertComponent,
    EmptyStateComponent
  ],
  templateUrl: './barber-list.component.html',
  styleUrl: './barber-list.component.css'
})
export class BarberListComponent {
  private barberService = inject(BarberService);
  langService = inject(LanguageService);

  searchTerm = signal('');
  isLoading = signal(true);
  errorMessage = signal('');
  barbers = signal<BarberListItem[]>([]);

  filteredBarbers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();

    return this.barbers().filter((barber) => {
      if (!term) return true;

      return (
        barber.name.toLowerCase().includes(term) ||
        (barber.shopName ?? '').toLowerCase().includes(term) ||
        (barber.bio ?? '').toLowerCase().includes(term)
      );
    });
  });

  constructor() {
    this.loadBarbers();
  }

  loadBarbers() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.barberService.getAllBarbers().subscribe({
      next: (response) => {
        this.barbers.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message || 'Impossible de charger les barbiers.'
        );
        this.isLoading.set(false);
      }
    });
  }

  setSearch(value: string) {
    this.searchTerm.set(value);
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