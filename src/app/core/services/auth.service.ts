import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterBarberRequest,
  RegisterClientRequest
} from '../models/auth.models';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);

  private readonly baseUrl = environment.apiBaseUrl;

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, payload).pipe(
      tap((response) => {
        this.sessionService.setSession(response);
      })
    );
  }

  registerClient(payload: RegisterClientRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register/client`, payload).pipe(
      tap((response) => {
        this.sessionService.setSession(response);
      })
    );
  }

  registerBarber(payload: RegisterBarberRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register/barber`, payload).pipe(
      tap((response) => {
        this.sessionService.setSession(response);
      })
    );
  }

  logout(): void {
    this.sessionService.logout();
  }
}