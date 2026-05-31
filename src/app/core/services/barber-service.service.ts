import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BarberServiceItem } from '../models/booking.models';

@Injectable({ providedIn: 'root' })
export class BarberServiceService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getServices(barberId: number): Observable<BarberServiceItem[]> {
    return this.http.get<BarberServiceItem[]>(`${this.baseUrl}/barbers/${barberId}/services`);
  }

  addService(barberId: number, service: Partial<BarberServiceItem>): Observable<BarberServiceItem> {
    return this.http.post<BarberServiceItem>(`${this.baseUrl}/barbers/${barberId}/services`, service);
  }

  updateService(barberId: number, serviceId: number, service: Partial<BarberServiceItem>): Observable<BarberServiceItem> {
    return this.http.put<BarberServiceItem>(`${this.baseUrl}/barbers/${barberId}/services/${serviceId}`, service);
  }

  deleteService(barberId: number, serviceId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/barbers/${barberId}/services/${serviceId}`);
  }
}