import { Component, DestroyRef, OnInit, OnDestroy, effect, inject, signal, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HomePrivateAuthComponent } from '../../../shared/components/home-private/home-private-auth.component';
import { HomeDocumentViewerComponent } from '../../../shared/components/home-private/home-document-viewer.component';
import { HomeAccess, HomeApplication, PrivateHomeService, privateHomeError } from '../../../core/services/private-home-service.service';
import { HomeFileField, homePhotoError, validHomeApplication } from './home-application.utils';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import { SessionService } from '../../../core/services/session.service';
import { LanguageService } from '../../../core/services/language.service';
import { BarberService } from '../../../core/services/barber.service';
import { ChatService } from '../../../core/services/chat.service';
import { BarberDetails } from '../../../core/models/barber.models';
import { hasHomePosition, homeInboxRequests, HomeInboxRequest } from './home-request-inbox.utils';

@Component({
  selector: 'app-barber-home-service',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HomePrivateAuthComponent, HomeDocumentViewerComponent],
  templateUrl: './barber-home-service.component.html',
  styleUrl: './barber-home-service.component.css',
})
export class BarberHomeServiceComponent implements OnInit, OnDestroy {
  readonly session = inject(SessionService);
  readonly lang = inject(LanguageService);
  private readonly barbers = inject(BarberService);
  readonly privateApi = inject(PrivateHomeService);
  private readonly chat = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<BarberDetails | null>(null);
  readonly access = signal<HomeAccess | null>(null);
  readonly application = computed(() => this.access()?.dossier || null);
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly submitSuccess = signal('');
  draft: Partial<HomeApplication> = {city: '', experienceDescription: ''};
  readonly fileFields: {key: HomeFileField; label: string}[] = [
    {key: 'selfie', label: 'Selfie'}, {key: 'diploma', label: 'Diplôme'},
    {key: 'cinFront', label: 'CNI recto'}, {key: 'cinBack', label: 'CNI verso'},
  ];
  fileErrors: Partial<Record<HomeFileField, string>> = {};
  get canSubmit(): boolean { return validHomeApplication(this.draft) && !this.submitting(); }
  get canApply(): boolean { return !!this.access() && !this.access()!.homeServiceEnabled && (!this.application() || this.application()!.status === 'REJECTED'); }

  pickFile(event: Event, field: HomeFileField): void {
    if (this.submitting()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.draft[field] = undefined;
    this.fileErrors[field] = file ? homePhotoError(file) : '';
    if (file && !this.fileErrors[field]) this.draft[field] = file;
    else input.value = '';
  }

  submitApplication(): void {
    if (!this.canSubmit || !this.canApply || !this.privateApi.ready()) return;
    this.submitting.set(true); this.submitError.set(''); this.submitSuccess.set('');
    this.privateApi.submit(this.draft as HomeApplication).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: dossier => {
        const access = this.access()!;
        this.access.set({...access, homeServiceEnabled: false, dossier});
        this.draft = {city: '', experienceDescription: ''};
        this.fileErrors = {};
        this.submitSuccess.set('Dossier envoyé. Il reste en attente de validation par CutCut.');
      },
      error: error => this.submitError.set(privateHomeError(error)),
    });
  }

  readonly loadingStatus = signal(false);
  readonly profileError = signal('');
  readonly applicationError = signal('');
  readonly requests = signal<HomeInboxRequest[]>([]);
  readonly loadingRequests = signal(false);
  readonly inboxError = signal('');
  readonly failedConversations = signal(0);
  readonly updatedAt = signal<Date | null>(null);
  readonly enabled = computed(() => this.access()?.homeServiceEnabled === true);
  readonly positioned = computed(() => hasHomePosition(this.profile()?.latitude, this.profile()?.longitude));
  readonly status = computed(() => (this.application()?.status || '').toUpperCase());
  readonly unread = computed(() => this.requests().filter(item => !item.read).length);

  constructor() {
    effect(() => {
      const ready = this.privateApi.ready();
      untracked(() => {
        if (!ready) {
          this.access.set(null);
          this.draft = {city: '', experienceDescription: ''};
          this.fileErrors = {};
          this.submitSuccess.set('');
          this.requests.set([]);
          this.updatedAt.set(null);
          this.inboxError.set('');
          this.failedConversations.set(0);
        }
      });
    });
  }

  ngOnDestroy(): void { this.draft = {}; this.fileErrors = {}; }

  tr(fr: string, ar: string): string { return this.lang.isArabic() ? ar : fr; }

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    const id = this.session.userId();
    if (!id || !this.session.isBarber() || !this.privateApi.ready() || this.loadingStatus()) return;
    this.loadingStatus.set(true);
    this.profileError.set(''); this.applicationError.set('');
    this.privateApi.access().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingStatus.set(false)),
    ).subscribe({
      next: access => {
        this.access.set(access);
        if (this.enabled()) this.loadRequests();
        else {
          this.requests.set([]); this.updatedAt.set(null);
          this.inboxError.set(''); this.failedConversations.set(0);
        }
      },
      error: error => { this.access.set(null); this.applicationError.set(privateHomeError(error)); },
    });
    this.barbers.getBarberById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: profile => this.profile.set(profile),
      error: () => this.profileError.set(this.tr('Impossible de vérifier ta position enregistrée.', 'تعذر التحقق من موقعك المحفوظ.')),
    });
  }

  loadRequests(): void {
    const id = this.session.userId();
    if (!id || !this.session.isBarber() || !this.privateApi.ready() || !this.enabled() || this.loadingRequests()) return;
    this.loadingRequests.set(true);
    this.inboxError.set('');
    this.failedConversations.set(0);
    this.chat.getPartners(id).pipe(
      switchMap(partners => {
        const ids = [...new Set((Array.isArray(partners) ? partners : [])
          .map(partner => partner.id as number)
          .filter(partnerId => Number.isSafeInteger(partnerId) && partnerId > 0 && partnerId !== id))];
        return from(ids).pipe(
          mergeMap(partnerId => this.chat.getConversation(id, partnerId).pipe(
            map(messages => ({ requests: homeInboxRequests(Array.isArray(messages) ? messages : [], id), failed: false })),
            catchError(() => of({ requests: [] as HomeInboxRequest[], failed: true })),
          ), 4),
          toArray(),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingRequests.set(false)),
    ).subscribe({
      next: batches => {
        if (this.session.userId() !== id || !this.privateApi.ready() || !this.enabled()) return;
        const unique = new Map(batches.flatMap(batch => batch.requests).map(item => [item.id, item]));
        this.requests.set([...unique.values()].sort((a, b) => (Date.parse(b.sentAt) || 0) - (Date.parse(a.sentAt) || 0) || b.id - a.id));
        this.failedConversations.set(batches.filter(batch => batch.failed).length);
        this.updatedAt.set(new Date());
      },
      error: () => {
        if (this.session.userId() === id && this.privateApi.ready() && this.enabled())
          this.inboxError.set(this.tr('Impossible de charger les demandes. La liste affichée peut être ancienne.', 'تعذر تحميل الطلبات. قد تكون القائمة المعروضة قديمة.'));
      },
    });
  }
}
