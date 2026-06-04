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

interface DayConfig {
  id: number;
  nameFr: string;
  nameAr: string;
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

  weeklySchedule = signal<DayConfig[]>([
    { id: 1, nameFr: 'Lundi',    nameAr: 'الإثنين',   active: true,  startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 2, nameFr: 'Mardi',    nameAr: 'الثلاثاء',  active: true,  startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 3, nameFr: 'Mercredi', nameAr: 'الأربعاء',  active: true,  startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 4, nameFr: 'Jeudi',    nameAr: 'الخميس',    active: true,  startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 5, nameFr: 'Vendredi', nameAr: 'الجمعة',    active: true,  startTime: '08:00', endTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 6, nameFr: 'Samedi',   nameAr: 'السبت',     active: false, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    { id: 7, nameFr: 'Dimanche', nameAr: 'الأحد',     active: false, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' },
  ]);

  private getStorageKey(): string {
    return `schedule_${this.sessionService.userId()}`;
  }

  private saveToStorage(schedule: DayConfig[]) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(schedule));
    } catch {}
  }

  private loadFromStorage(): DayConfig[] | null {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }

  getDayName(day: DayConfig): string {
    return this.langService.isArabic() ? day.nameAr : day.nameFr;
  }

  ngOnInit() {
    this.loadSavedSchedule();
  }

  loadSavedSchedule() {
    const barberId = this.sessionService.userId();
    if (!barberId) { this.isLoading.set(false); return; }

    // ✅ Charger localStorage immédiatement
    const stored = this.loadFromStorage();
    if (stored) {
      // Merge avec les noms FR/AR car localStorage ne les a pas forcément
      const merged = this.weeklySchedule().map(day => {
        const saved = stored.find((s: any) => s.id === day.id);
        return saved ? { ...day, ...saved, nameFr: day.nameFr, nameAr: day.nameAr } : day;
      });
      this.weeklySchedule.set(merged);
    }

    // ✅ Sync avec backend
    this.availabilityService.getSchedule(barberId).subscribe({
      next: (savedSchedule) => {
        if (savedSchedule && savedSchedule.length > 0) {
          const updated = this.weeklySchedule().map(day => {
            const saved = savedSchedule.find((s: any) => s.dayOfWeek === day.id);
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
          });
          this.weeklySchedule.set(updated);
          this.saveToStorage(updated);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
    });
  }

  // ✅ Copier l'horaire du 1er jour actif vers tous les autres
  applyFirstDayToAll() {
    const schedule = this.weeklySchedule();
    const firstDay = schedule.find(d => d.active) || schedule[0];

    this.weeklySchedule.update(days =>
      days.map(day => ({
        ...day,
        startTime: firstDay.startTime,
        endTime: firstDay.endTime,
        breakStart: firstDay.breakStart,
        breakEnd: firstDay.breakEnd
      }))
    );
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

    // ✅ Force signal update
    const currentSchedule = this.weeklySchedule().map(day => ({ ...day }));
    this.weeklySchedule.set(currentSchedule);
    this.saveToStorage(currentSchedule);

    this.isSaving.set(true);
    this.errorMessage.set('');

    const payload: DaySchedulePayload[] = currentSchedule.map(day => ({
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
      error: () => {
        this.isSaving.set(false);
        this.successMessage.set('✅ Sauvegardé localement !');
        setTimeout(() => this.successMessage.set(''), 3000);
      }
    });
  }
}