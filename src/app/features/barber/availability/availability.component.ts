import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageModule } from 'primeng/message';

// Core Services
import { LanguageService } from '../../../core/services/language.service';
import { AvailabilityService, DaySchedulePayload } from '../../../core/services/availability.service';
import { SessionService } from '../../../core/services/session.service';

// Shared Components
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

// Define the translation key type to avoid the 'any' index error
type TranslationKey = keyof ReturnType<LanguageService['t']>;

interface DayConfig {
  id: number;
  name: TranslationKey;
  active: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ButtonModule, 
    InputSwitchModule, 
    MessageModule,
    LoadingSpinnerComponent, 
    ErrorAlertComponent
  ],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.css'
})
export class AvailabilityComponent implements OnInit {
  private availabilityService = inject(AvailabilityService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  // State Management
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Default Weekly Template (The "Rules")
  weeklySchedule = signal<DayConfig[]>([
    { id: 1, name: 'monday' as TranslationKey, active: true, startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 2, name: 'tuesday' as TranslationKey, active: true, startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 3, name: 'wednesday' as TranslationKey, active: true, startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 4, name: 'thursday' as TranslationKey, active: true, startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 5, name: 'friday' as TranslationKey, active: true, startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 6, name: 'saturday' as TranslationKey, active: false, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 7, name: 'sunday' as TranslationKey, active: false, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  ]);

  ngOnInit() {
    // You could call a getWeeklyRules() service here to load saved data from the DB
  }

  /**
   * Maps the UI state to the DTO expected by Spring Boot
   * and sends it to the backend.
   */
  saveFullSchedule() {
    const barberId = this.sessionService.userId();
    if (!barberId) {
      this.errorMessage.set("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    // Transform local DayConfig to DaySchedulePayload (DTO)
    const payload: DaySchedulePayload[] = this.weeklySchedule().map(day => ({
      dayOfWeek: day.id,
      startTime: day.startTime,
      endTime: day.endTime,
      breakStart: day.breakStart,
      breakEnd: day.breakEnd,
      active: day.active
    }));

    this.availabilityService.updateSchedule(barberId, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set(this.langService.t().availabilitySaved || "Disponibilité mise à jour !");
        
        // Clear success message after a few seconds
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || "Une erreur est survenue lors de l'enregistrement.");
      }
    });
  }
}