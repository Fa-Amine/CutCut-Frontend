import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddSlotRequest, AvailabilitySlot } from '../models/availability.models';

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getAvailableSlotsByBarber(barberId: number): Observable<AvailabilitySlot[]> {
    return this.http.get<AvailabilitySlot[]>(`${this.baseUrl}/availability/barber/${barberId}`);
  }

  addSlot(barberId: number, payload: AddSlotRequest): Observable<AvailabilitySlot> {
    return this.http.post<AvailabilitySlot>(`${this.baseUrl}/availability/barber/${barberId}`, payload);
  }
}