import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BarberDetails, BarberListItem } from '../models/barber.models';
import { BarberDashboardResponse } from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class BarberService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getAllBarbers(): Observable<BarberListItem[]> {
    return this.http.get<BarberListItem[]>(`${this.baseUrl}/barbers`);
  }

  getBarberById(id: number): Observable<BarberDetails> {
    return this.http.get<BarberDetails>(`${this.baseUrl}/barbers/${id}`);
  }

  getBarberDashboard(barberId: number): Observable<BarberDashboardResponse> {
    return this.http.get<BarberDashboardResponse>(`${this.baseUrl}/barbers/${barberId}/dashboard`);
  }
}