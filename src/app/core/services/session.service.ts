import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse } from '../models/auth.models';

export type UserRole = 'GUEST' | 'CLIENT' | 'BARBER' | 'ADMIN';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private userSignal = signal<AuthResponse | null>(this.loadStoredUser());

  user = computed(() => this.userSignal());
  userId = computed(() => this.userSignal()?.id ?? null);

  role = computed<UserRole>(() => this.userSignal()?.role ?? 'GUEST');

  isGuest = computed(() => this.role() === 'GUEST');
  isClient = computed(() => this.role() === 'CLIENT');
  isBarber = computed(() => this.role() === 'BARBER');
  isAdmin = computed(() => this.role() === 'ADMIN');
  isAuthenticated = computed(() => this.userSignal() !== null);

  private loadStoredUser(): AuthResponse | null {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      localStorage.removeItem('auth_user');
      return null;
    }
  }

  setSession(user: AuthResponse) {
    this.userSignal.set(user);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  clearSession() {
    this.userSignal.set(null);
    localStorage.removeItem('auth_user');
  }

  logout() {
    this.clearSession();
  }
}