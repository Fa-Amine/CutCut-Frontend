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
import { PrivateHomeService } from './private-home-service.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private privateHome = inject(PrivateHomeService);
  private readonly baseUrl = environment.apiBaseUrl;

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, payload).pipe(
      tap((response) => {
        this.privateHome.lock();
        this.sessionService.setSession(response);
        this.privateHome.acceptLogin(response);
      })
    );
  }

  registerClient(payload: RegisterClientRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register/client`, payload).pipe(
      tap((response) => {
        this.privateHome.lock();
        this.sessionService.setSession(response);
        this.privateHome.acceptLogin(response);
      })
    );
  }

  registerBarber(payload: RegisterBarberRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register/barber`, payload).pipe(
      tap((response) => {
        this.privateHome.lock();
        this.sessionService.setSession(response);
        this.privateHome.acceptLogin(response);
      })
    );
  }

  // ✅ Demande de code de réinitialisation
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/auth/password-reset/request`,
      { email }
    );
  }

  // ✅ Réinitialisation avec code
  resetPassword(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/auth/password-reset/confirm`,
      { email, code, newPassword }
    );
  }

  logout(): void {
    this.privateHome.lock();
    this.sessionService.logout();
  }
}