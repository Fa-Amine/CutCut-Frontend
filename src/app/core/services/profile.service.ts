import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BarberProfile,
  ClientProfile,
  UpdateBarberRequest,
  UpdateClientRequest
} from '../models/profile.models';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getClientProfile(clientId: number): Observable<ClientProfile> {
    return this.http.get<ClientProfile>(`${this.baseUrl}/clients/${clientId}`);
  }

  updateClientProfile(clientId: number, payload: UpdateClientRequest): Observable<ClientProfile> {
    return this.http.put<ClientProfile>(`${this.baseUrl}/clients/${clientId}`, payload);
  }

  getBarberProfile(barberId: number): Observable<BarberProfile> {
    return this.http.get<BarberProfile>(`${this.baseUrl}/barbers/${barberId}`);
  }

  updateBarberProfile(barberId: number, payload: UpdateBarberRequest): Observable<BarberProfile> {
    return this.http.put<BarberProfile>(`${this.baseUrl}/barbers/${barberId}`, payload);
  }
}