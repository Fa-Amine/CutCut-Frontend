import { Component, DestroyRef, EventEmitter, Output, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { HomeDossier, HomeDocumentType, PrivateHomeService, privateHomeError } from '../../../core/services/private-home-service.service';
import { SessionService } from '../../../core/services/session.service';
import { HomePrivateAuthComponent } from '../../../shared/components/home-private/home-private-auth.component';
import { HomeDocumentViewerComponent } from '../../../shared/components/home-private/home-document-viewer.component';

@Component({
  selector: 'app-home-service-admin', standalone: true,
  imports: [CommonModule, FormsModule, HomePrivateAuthComponent, HomeDocumentViewerComponent],
  templateUrl: './home-service-admin.component.html', styleUrl: './home-service-admin.component.css',
})
export class HomeServiceAdminComponent implements OnInit {
  @Output() accessReady = new EventEmitter<void>();
  readonly api = inject(PrivateHomeService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly dossiers = signal<HomeDossier[]>([]);
  readonly loading = signal(false);
  readonly busyId = signal<number | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly pendingOnly = signal(true);
  confirmations: Record<number, boolean> = {};
  reasons: Partial<Record<number, string>> = {};
  private readonly viewed = new Map<number, Set<HomeDocumentType>>();
  constructor() {
    effect(() => {
      const ready = this.api.ready();
      untracked(() => {if (!ready) { this.dossiers.set([]); this.viewed.clear(); this.confirmations = {}; this.reasons = {}; }});
    });
  }
  ngOnInit(): void { if (this.api.ready()) this.reload(); }
  unlockComplete(): void { this.reload(); this.accessReady.emit(); }
  reload(): void {
    if (!this.api.ready() || !this.session.isAdmin() || this.loading() || this.busyId() !== null) return;
    this.loading.set(true); this.error.set(''); this.success.set('');
    this.api.dossiers().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: dossiers => {
        this.dossiers.set(Array.isArray(dossiers) ? dossiers : []);
        this.viewed.clear(); this.confirmations = {}; this.reasons = {};
      },
      error: error => this.error.set(privateHomeError(error)),
    });
  }
  visible(): HomeDossier[] {
    return this.dossiers().filter(dossier => !this.pendingOnly() || dossier.status === 'PENDING');
  }
  documentViewed(id: number, type: HomeDocumentType): void {
    const viewed = this.viewed.get(id) || new Set<HomeDocumentType>();
    viewed.add(type); this.viewed.set(id, viewed);
  }
  viewedCount(id: number): number { return this.viewed.get(id)?.size || 0; }
  canApprove(dossier: HomeDossier): boolean {
    return dossier.status === 'PENDING' && this.viewedCount(dossier.id) === 4 && this.confirmations[dossier.id] === true;
  }
  approve(dossier: HomeDossier): void {
    if (!this.session.isAdmin() || !this.api.ready() || this.busyId() !== null || !this.canApprove(dossier)) return;
    this.decide(dossier.id, true);
  }
  reject(dossier: HomeDossier): void {
    const reason = this.reasons[dossier.id]?.trim();
    if (!this.session.isAdmin() || !this.api.ready() || this.busyId() !== null || dossier.status !== 'PENDING' || !reason || reason.length > 255) return;
    this.decide(dossier.id, false);
  }
  private decide(id: number, approved: boolean): void {
    this.busyId.set(id); this.error.set(''); this.success.set('');
    const request = approved ? this.api.approve(id) : this.api.reject(id, this.reasons[id] || '');
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busyId.set(null))).subscribe({
      next: updated => {
        this.dossiers.update(dossiers => dossiers.map(dossier => dossier.id === id ? updated : dossier));
        this.viewed.delete(id); delete this.confirmations[id]; delete this.reasons[id];
        this.success.set(approved ? 'Dossier accepté. Le service à domicile est activé pour ce professionnel.' : 'Dossier refusé. Le professionnel peut consulter le motif et soumettre un nouveau dossier.');
      },
      error: error => this.error.set(privateHomeError(error)),
    });
  }
}
