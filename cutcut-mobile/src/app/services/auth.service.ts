import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username?: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role?: 'CUSTOMER' | 'BARBER';
}

export interface AuthResponse {
  token: string;
  user?: {
    id: number;
    email: string;
    username?: string;
    role?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'cutcut_auth_token';

  constructor(private http: HttpClient) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    const cleanPayload: LoginPayload = {
      email: payload.email.trim().toLowerCase(),
      password: payload.password
    };

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, cleanPayload)
      .pipe(
        tap(async (response) => {
          if (response?.token) {
            await Preferences.set({
              key: this.tokenKey,
              value: response.token
            });
          }
        })
      );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    const cleanPayload: RegisterPayload = {
      ...payload,
      username: payload.username?.trim().toLowerCase(),
      email: payload.email.trim().toLowerCase()
    };

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/register`, cleanPayload)
      .pipe(
        tap(async (response) => {
          if (response?.token) {
            await Preferences.set({
              key: this.tokenKey,
              value: response.token
            });
          }
        })
      );
  }

  async getToken(): Promise<string | null> {
    const result = await Preferences.get({ key: this.tokenKey });
    return result.value;
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: this.tokenKey });
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}