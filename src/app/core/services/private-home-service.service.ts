import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuthResponse } from '../models/auth.models';
import { SessionService } from './session.service';
import { AdminDashboardResponse } from '../models/admin.models';
import { environment } from '../../../environments/environment';

export type HomeDocumentType = 'selfie' | 'diploma' | 'cin-front' | 'cin-back';
export interface HomeDossier {
  id: number; barberId: number; barberName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  city: string | null; experienceYears: number | null; experienceDescription: string | null;
  rejectionReason: string | null; createdAt: string; updatedAt: string; reviewedAt: string | null;
}
export interface HomeAccess { barberId: number; homeServiceEnabled: boolean; dossier: HomeDossier | null; }
export interface HomeApplication {
  city: string; experienceYears: number; experienceDescription: string;
  selfie: File; diploma: File; cinFront: File; cinBack: File;
}
interface PrivateCredential { owner: number; role: 'BARBER' | 'ADMIN'; token: string; expiresAt: number; }

@Injectable({ providedIn: 'root' })
export class PrivateHomeService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '') + '/home-service';
  // Tab session only: never place this credential in localStorage, URLs or logs.
  private readonly credential = signal<PrivateCredential | null>(this.restoreCredential());
  readonly ready = computed(() => {
    const credential = this.credential();
    return !!credential && credential.owner === this.session.userId() && credential.role === this.session.role() && credential.expiresAt > Date.now();
  });

  constructor() {
    effect(() => {
      const id = this.session.userId();
      const role = this.session.role();
      untracked(() => {
        const credential = this.credential();
        if (credential && (credential.owner !== id || credential.role !== role)) this.clearCredential();
      });
    });
  }

  private restoreCredential(): PrivateCredential | null {
    try {
      const stored = JSON.parse(sessionStorage.getItem('cutcut_home_session') || 'null');
      if (stored && stored.owner === this.session.userId() && stored.role === this.session.role() &&
          ['BARBER', 'ADMIN'].includes(stored.role) && /^[A-Za-z0-9_-]{43}$/.test(stored.token || '') &&
          Number.isFinite(stored.expiresAt) && stored.expiresAt > Date.now()) return stored;
      sessionStorage.removeItem('cutcut_home_session');
    } catch { /* Storage unavailable: login still works using memory. */ }
    return null;
  }

  acceptLogin(response: AuthResponse): void {
    this.clearCredential();
    if (!['BARBER', 'ADMIN'].includes(response.role) || response.id !== this.session.userId() ||
        response.role !== this.session.role() || !/^[A-Za-z0-9_-]{43}$/.test(response.homeServiceToken || '')) return;
    const credential: PrivateCredential = {owner: response.id, role: response.role as 'BARBER' | 'ADMIN',
      token: response.homeServiceToken!, expiresAt: Date.now() + 24 * 60 * 60 * 1000};
    this.credential.set(credential);
    try { sessionStorage.setItem('cutcut_home_session', JSON.stringify(credential)); } catch { /* Memory fallback. */ }
  }

  private clearCredential(): void {
    this.credential.set(null);
    try { sessionStorage.removeItem('cutcut_home_session'); } catch { /* Storage unavailable. */ }
  }

  lock(): void {
    const credential = this.credential();
    this.clearCredential();
    if (credential) this.http.post<void>(this.base + '/auth/logout', {}, {
      headers: new HttpHeaders({Authorization: 'Bearer ' + credential.token}),
    }).subscribe({error: () => { /* Memory credential remains cleared if the server is unreachable. */ }});
  }

  private headers(): HttpHeaders {
    if ((this.credential()?.expiresAt || 0) <= Date.now()) this.clearCredential();
    if (!this.ready()) throw new Error('Ta session a expiré. Reconnecte-toi depuis la page de connexion.');
    return new HttpHeaders({Authorization: 'Bearer ' + this.credential()!.token});
  }

  private protect<T>(operation: () => Observable<T>): Observable<T> {
    let credential: PrivateCredential | null;
    try {
      credential = this.credential();
      const request = operation();
      return request.pipe(tap(() => {
        if (this.credential() !== credential || !this.ready()) throw new Error('Session privée modifiée.');
      }), catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401 && this.credential() === credential) {
          this.clearCredential();
        }
        return throwError(() => error);
      }));
    } catch (error) { return throwError(() => error); }
  }

  access(): Observable<HomeAccess> {
    return this.protect(() => this.http.get<HomeAccess>(this.base + '/access', {headers: this.headers()}));
  }

  submit(application: HomeApplication): Observable<HomeDossier> {
    return this.protect(() => {
      const body = new FormData();
      body.append('city', application.city.trim());
      body.append('experienceYears', String(application.experienceYears));
      body.append('experienceDescription', application.experienceDescription.trim());
      body.append('selfie', application.selfie);
      body.append('diploma', application.diploma);
      body.append('cinFront', application.cinFront);
      body.append('cinBack', application.cinBack);
      return this.http.post<HomeDossier>(this.base + '/application', body, {headers: this.headers()});
    });
  }

  adminDashboard(): Observable<AdminDashboardResponse> {
    return this.protect(() => this.http.get<AdminDashboardResponse>(
      environment.apiBaseUrl.replace(/\/$/, '') + '/admin/dashboard', {headers: this.headers()},
    ));
  }

  dossiers(): Observable<HomeDossier[]> {
    return this.protect(() => this.http.get<HomeDossier[]>(this.base + '/all', {headers: this.headers()}));
  }
  approve(id: number): Observable<HomeDossier> {
    return this.protect(() => this.http.put<HomeDossier>(this.base + '/approve/' + id, {}, {headers: this.headers()}));
  }
  reject(id: number, reason: string): Observable<HomeDossier> {
    return this.protect(() => this.http.put<HomeDossier>(this.base + '/reject/' + id, {reason: reason.trim()}, {headers: this.headers()}));
  }
  document(id: number, type: HomeDocumentType): Observable<Blob> {
    return this.protect(() => this.http.get(this.base + '/' + id + '/documents/' + type, {
      headers: this.headers(), responseType: 'blob',
    }));
  }
}

export function privateHomeError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 401) return 'Session expirée. Reconnecte-toi depuis la page de connexion.';
  if (status === 403) return 'Ton compte ne peut pas effectuer cette action.';
  if (status === 404 || status === 405) return 'Cette fonction privée est indisponible sur le serveur. Vérifie le déploiement du backend.';
  if (status === 409) return 'Le dossier a déjà changé de statut ou doit être complété. Actualise avant de continuer.';
  if (status === 413) return 'Les fichiers dépassent la limite du serveur. Réduis leur taille.';
  if (status === 400) return 'Dossier invalide : vérifie les champs et les quatre photos JPEG/PNG (5 Mo, 12 mégapixels et 6000 pixels par côté maximum).';
  return 'Opération impossible. Vérifie ta connexion puis réessaie.';
}
