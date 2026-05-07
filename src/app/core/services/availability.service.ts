import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddSlotRequest, AvailabilitySlot } from '../models/availability.models';

// Interface matching the payload we built in the component
export interface DaySchedulePayload {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Fetches already generated slots (useful for the client booking view)
   */
  getAvailableSlotsByBarber(barberId: number): Observable<AvailabilitySlot[]> {
    return this.http.get<AvailabilitySlot[]>(`${this.baseUrl}/availability/barber/${barberId}`);
  }

  /**
   * New Method: Sends the weekly rules to the backend to 
   * update the schedule and trigger slot generation.
   */
  updateSchedule(barberId: number, payload: DaySchedulePayload[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/availability/barber/${barberId}/schedule`, payload);
  }

  /**
   * Legacy Method: Still keeps the ability to add a one-off custom slot if needed.
   */
  addSlot(barberId: number, payload: AddSlotRequest): Observable<AvailabilitySlot> {
    return this.http.post<AvailabilitySlot>(`${this.baseUrl}/availability/barber/${barberId}`, payload);
  }
}