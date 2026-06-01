import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddSlotRequest, AvailabilitySlot } from '../models/availability.models';

export interface DaySchedulePayload {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  // ✅ Slots disponibles seulement (pour compatibilité)
  getAvailableSlotsByBarber(barberId: number): Observable<AvailabilitySlot[]> {
    return this.http.get<AvailabilitySlot[]>(`${this.baseUrl}/availability/barber/${barberId}`);
  }

  // ✅ TOUS les slots (disponibles + réservés) pour affichage grisé
  getAllSlotsByBarber(barberId: number): Observable<AvailabilitySlot[]> {
    return this.http.get<AvailabilitySlot[]>(`${this.baseUrl}/availability/barber/${barberId}/all`);
  }

  updateSchedule(barberId: number, payload: DaySchedulePayload[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/availability/barber/${barberId}/schedule`, payload);
  }

  addSlot(barberId: number, payload: AddSlotRequest): Observable<AvailabilitySlot> {
    return this.http.post<AvailabilitySlot>(`${this.baseUrl}/availability/barber/${barberId}`, payload);
  }
}