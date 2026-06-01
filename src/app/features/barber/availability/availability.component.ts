import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageModule } from 'primeng/message';
import { LanguageService } from '../../../core/services/language.service';
import { AvailabilityService, DaySchedulePayload } from '../../../core/services/availability.service';
import { SessionService } from '../../../core/services/session.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert/error-alert.component';

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
    CommonModule, FormsModule, ButtonModule,
    InputSwitchModule, MessageModule,
    LoadingSpinnerComponent, ErrorAlertComponent
  ],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.css'
})
export class AvailabilityComponent implements OnInit {
  private availabilityService = inject(AvailabilityService);
  private sessionService = inject(SessionService);
  langService = inject(LanguageService);

  isLoading = signal(true);
  isSaving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  configMode = signal<'global' | 'individual'>('global');

  globalConfig = signal({
    startTime: '08:00',
    endTime: '20:00',
    breakStart: '12:00',
    breakEnd: '13:00'
  });

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
    this.loadSavedSchedule();
  }

  // ✅ Charger le schedule sauvegardé depuis la BDD
  loadSavedSchedule() {
    const barberId = this.sessionService.userId();
    if (!barberId) { this.isLoading.set(false); return; }

    this.availabilityService.getSchedule(barberId).subscribe({
      next: (savedSchedule) => {
        if (savedSchedule && savedSchedule.length > 0) {
          this.weeklySchedule.update(days =>
            days.map(day => {
              const saved = savedSchedule.find(s => s.dayOfWeek === day.id);
              if (saved) {
                return {
                  ...day,
                  active: saved.active,
                  startTime: saved.startTime?.slice(0, 5) || day.startTime,
                  endTime: saved.endTime?.slice(0, 5) || day.endTime,
                  breakStart: saved.breakStart?.slice(0, 5) || day.breakStart,
                  breakEnd: saved.breakEnd?.slice(0, 5) || day.breakEnd
                };
              }
              return day;
            })
          );
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  setMode(mode: 'global' | 'individual') {
    this.configMode.set(mode);
    if (mode === 'global') this.applyGlobalToAll();
  }

  applyGlobalToAll() {
    const global = this.globalConfig();
    this.weeklySchedule.update(days =>
      days.map(day => ({
        ...day,
        startTime: global.startTime,
        endTime: global.endTime,
        breakStart: global.breakStart,
        breakEnd: global.breakEnd
      }))
    );
  }

  updateGlobal(field: string, value: string) {
    this.globalConfig.update(config => ({ ...config, [field]: value }));
    this.applyGlobalToAll();
  }

  toggleDay(dayId: number) {
    this.weeklySchedule.update(days =>
      days.map(day => day.id === dayId ? { ...day, active: !day.active } : day)
    );
  }

  saveFullSchedule() {
    const barberId = this.sessionService.userId();
    if (!barberId) {
      this.errorMessage.set('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    if (this.configMode() === 'global') this.applyGlobalToAll();

    this.isSaving.set(true);
    this.errorMessage.set('');

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
        this.successMessage.set('✅ Disponibilité mise à jour avec succès !');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || 'Une erreur est survenue.');
      }
    });
  }
}