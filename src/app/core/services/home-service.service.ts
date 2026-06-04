import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HomeServiceRequest } from '../models/barber.models';

@Injectable({ providedIn: 'root' })
export class HomeServiceService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  submitRequest(barberId: number, diplomaUrl: string, cinUrl: string, selfieUrl: string): Observable<HomeServiceRequest> {
    return this.http.post<HomeServiceRequest>(`${this.baseUrl}/home-service/submit/${barberId}`, {
      diplomaUrl, cinUrl, selfieUrl
    });
  }

  getByBarber(barberId: number): Observable<HomeServiceRequest> {
    return this.http.get<HomeServiceRequest>(`${this.baseUrl}/home-service/barber/${barberId}`);
  }

  getAllRequests(): Observable<HomeServiceRequest[]> {
    return this.http.get<HomeServiceRequest[]>(`${this.baseUrl}/home-service/all`);
  }

  getPendingRequests(): Observable<HomeServiceRequest[]> {
    return this.http.get<HomeServiceRequest[]>(`${this.baseUrl}/home-service/pending`);
  }

  approveRequest(requestId: number): Observable<HomeServiceRequest> {
    return this.http.put<HomeServiceRequest>(`${this.baseUrl}/home-service/approve/${requestId}`, {});
  }

  rejectRequest(requestId: number, reason: string): Observable<HomeServiceRequest> {
    return this.http.put<HomeServiceRequest>(`${this.baseUrl}/home-service/reject/${requestId}`, { reason });
  }
}