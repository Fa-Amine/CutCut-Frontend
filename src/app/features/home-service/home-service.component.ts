import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import * as L from 'leaflet';
import { from, of, timer, Subscription } from 'rxjs';
import { catchError, finalize, map, mergeMap, timeout, takeWhile } from 'rxjs/operators';
import { REQUEST_TTL, RequestDelivery, remainingSeconds, hasTimelyReply } from './home-tracking.utils';
import { buildHomeRequest } from './home-request.utils';
import type { MultiPolygon } from 'polygon-clipping';

import { BarberService } from '../../core/services/barber.service';
import { BarberListItem } from '../../core/models/barber.models';
import { ChatMessage, ChatService } from '../../core/services/chat.service';
import { SessionService } from '../../core/services/session.service';
import { LanguageService } from '../../core/services/language.service';

import {
  clampRadius,
  distanceKm,
  landZone,
  onLand,
  resizeHandle,
  validPosition,
} from './home-search.utils';

import type { Position } from './home-search.utils';

type NearbyBarber = BarberListItem & {
  km: number;
  latitude: number;
  longitude: number;
};

@Component({
  selector: 'app-home-service',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home-service.component.html',
  styleUrls: ['./home-service.component.css', './home-tracking.css'],
})
export class HomeServiceComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('mapHost', { static: true })
  private mapHost!: ElementRef<HTMLDivElement>;

  private readonly api = inject(BarberService);
  private readonly chat = inject(ChatService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = inject(SessionService);
  readonly lang = inject(LanguageService);

  center: Position = {
    lat: 34.033,
    lng: -6.798,
  };

  positionSource: 'preview' | 'gps' | 'manual' = 'preview';

  radiusKm = 10;

  barbers: BarberListItem[] = [];
  results: NearbyBarber[] = [];

  loading = false;
  dataError = '';
  mapError = '';
  locationError = '';
  landError = '';

  locating = false;
  landLoading = false;
  zoneAvailable = false;

  readonly serviceOptions = ['Coupe', 'Barbe', 'Coiffure', 'Soin du visage'];
  services: string[] = [];
  otherService = '';
  timing: 'now' | 'scheduled' = 'now';
  requestedAt = '';
  deliveries: RequestDelivery[] = [];
  startedAt = 0;
  now = Date.now();
  trackingError = false;
  checkingReplies = false;
  private clock?: Subscription;
  private trackingOwner: number | null = null;

  get secondsLeft(): number { return this.startedAt ? remainingSeconds(this.startedAt, this.now) : 0; }
  get expired(): boolean { return this.startedAt > 0 && this.secondsLeft === 0; }
  get countdown(): string { return `${Math.floor(this.secondsLeft / 60)}:${String(this.secondsLeft % 60).padStart(2, '0')}`; }
  get timeProgress(): number { return this.secondsLeft / 360 * 100; }
  get replyCount(): number { return this.deliveries.filter(item => item.replied).length; }
  get waitingCount(): number { return this.deliveries.filter(item => item.state === 'sent' && !item.replied).length; }
  get canStartAgain(): boolean { return !this.sending && (this.expired || !this.waitingCount); }

  deliveryLabel(item: RequestDelivery): string {
    if (item.state === 'pending') return this.tr('Envoi en cours', 'جارٍ الإرسال');
    if (item.state === 'failed') return this.tr('Envoi non confirmé', 'الإرسال غير مؤكد');
    if (item.replied) return this.tr('Réponse reçue', 'تم استلام رد');
    return this.expired ? this.tr('Expirée', 'منتهي الصلاحية') : this.tr('En attente de réponse', 'في انتظار الرد');
  }

  private storageKey(): string { return `cutcut_client_tracking_v1_${this.trackingOwner}`; }
  private saveTracking(): void {
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify({
      startedAt: this.startedAt, deliveries: this.deliveries, content: this.batchContent,
      services: this.services, otherService: this.otherService, price: this.price,
      timing: this.timing, requestedAt: this.requestedAt,
    })); } catch { /* Tracking still works when browser storage is unavailable. */ }
  }

  private restoreTracking(): void {
    this.trackingOwner = this.session.userId();
    if (!this.trackingOwner || !this.session.isClient()) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.storageKey()) || 'null');
      if (!saved || !Number.isFinite(saved.startedAt) || saved.startedAt > Date.now() ||
          saved.startedAt < Date.now() - 86400000 || typeof saved.content !== 'string' ||
          !Array.isArray(saved.deliveries) || !saved.deliveries.every((item: RequestDelivery) =>
            Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === 'string' &&
            ['pending', 'sent', 'failed'].includes(item.state))) return;
      this.startedAt = saved.startedAt;
      this.batchContent = saved.content;
      this.deliveries = saved.deliveries.map((item: RequestDelivery) => ({...item,
        state: item.state === 'pending' ? 'failed' : item.state}));
      this.services = Array.isArray(saved.services) ? saved.services.filter((x: unknown) => typeof x === 'string') : [];
      this.otherService = typeof saved.otherService === 'string' ? saved.otherService : '';
      this.price = typeof saved.price === 'number' ? saved.price : null;
      this.timing = saved.timing === 'scheduled' ? 'scheduled' : 'now';
      this.requestedAt = typeof saved.requestedAt === 'string' ? saved.requestedAt : '';
      this.startTracking();
    } catch { /* Ignore invalid or unavailable saved state. */ }
  }

  private startTracking(): void {
    this.clock?.unsubscribe();
    this.now = Date.now();
    this.clock = timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tick => {
      if (this.session.userId() !== this.trackingOwner || !this.session.isClient()) {
        this.clock?.unsubscribe(); this.batchContent = null; this.deliveries = []; return;
      }
      const wasExpired = this.expired;
      this.now = Date.now();
      if (tick === 0 || (!this.expired && tick % 10 === 0) || (!wasExpired && this.expired)) this.refreshReplies();
    });
  }

  refreshReplies(): void {
    const owner = this.trackingOwner;
    if (!owner || this.session.userId() !== owner || this.checkingReplies) return;
    const batch = this.batchContent;
    const startedAt = this.startedAt;
    const targets = this.deliveries.filter(item => item.state === 'sent' && !item.replied);
    this.checkingReplies = true;
    this.trackingError = false;
    from(targets).pipe(
      mergeMap(target => this.chat.getConversation(owner, target.id).pipe(
        timeout(10000),
        map(messages => ({target, replied: hasTimelyReply(messages, owner, target, startedAt), error: false})),
        catchError(() => of({target, replied: false, error: true})),
      ), 3),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.checkingReplies = false; }),
    ).subscribe(result => {
      if (this.batchContent !== batch || this.session.userId() !== owner) return;
      result.target.replied = result.replied;
      this.trackingError ||= result.error;
      this.saveTracking();
    });
  }

  batchContent: string | null = null;

  get requestLocked(): boolean { return this.batchContent !== null; }
  get sentCount(): number { return this.deliveries.filter(item => item.state === 'sent').length; }
  get failedCount(): number { return this.deliveries.filter(item => item.state === 'failed').length; }

  serviceLabel(value: string): string {
    const labels: Record<string, string> = {
      'Coupe': 'قص الشعر', 'Barbe': 'اللحية', 'Coiffure': 'تصفيف الشعر', 'Soin du visage': 'العناية بالوجه',
    };
    return this.tr(value, labels[value] || value);
  }

  toggleService(value: string): void {
    if (this.requestLocked) return;
    this.services = this.services.includes(value)
      ? this.services.filter(item => item !== value) : [...this.services, value];
  }

  newRequest(): void {
    if (!this.canStartAgain) return;
    this.clock?.unsubscribe();
    try { sessionStorage.removeItem(this.storageKey()); } catch {}
    this.startedAt = 0;
    this.batchContent = null;
    this.deliveries = [];
    this.sendError = '';
    this.handle?.dragging?.enable();
  }

  price: number | null = null;

  sending = false;
  sendError = '';

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private frame?: number;
  private markers?: L.LayerGroup;
  private me?: L.CircleMarker;
  private area?: L.Polygon;
  private handle?: L.Marker;

  private land: MultiPolygon = [];

  private resize?: ResizeObserver;
  private abort?: AbortController;
  private destroyed = false;

  tr(fr: string, ar: string): string {
    return this.lang.isArabic() ? ar : fr;
  }

  ngOnInit(): void {
    this.restoreTracking();
    this.reloadBarbers();
    void this.loadLand();
  }

  ngAfterViewInit(): void {
    this.frame = requestAnimationFrame(() => {
      if (!this.destroyed) {
        this.zone.run(() => this.retryMap());
      }
    });
  }

  retryMap(): void {
    if (this.destroyed) return;

    if (this.map) {
      this.mapError = '';
      this.tiles?.redraw();
      this.map.invalidateSize();
      return;
    }

    this.mapError = '';

    try {
      this.map = L.map(this.mapHost.nativeElement, {
        zoomControl: true,
      }).setView([this.center.lat, this.center.lng], 12);

      this.tiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        },
      )
        .on('tileerror', () =>
          this.zone.run(() => {
            this.mapError = this.tr(
              'Le fond de carte ne charge pas. Vérifie ta connexion puis recharge la page.',
              'تعذر تحميل الخريطة. تحقق من الاتصال وأعد تحميل الصفحة.',
            );
          }),
        )
        .on('tileload', () =>
          this.zone.run(() => {
            this.mapError = '';
          }),
        )
        .addTo(this.map);

      this.markers = L.layerGroup().addTo(this.map);

      this.me = L.circleMarker(
        [this.center.lat, this.center.lng],
        {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#1676ff',
          fillOpacity: 1,
        },
      ).addTo(this.map);

      this.map.on('click', (event: L.LeafletMouseEvent) =>
        this.zone.run(() => {
          this.setPosition(
            {
              lat: event.latlng.lat,
              lng: event.latlng.lng,
            },
            'manual',
          );
        }),
      );

      this.resize = new ResizeObserver(() => {
        this.map?.invalidateSize({ animate: false });
      });

      this.resize.observe(this.mapHost.nativeElement);

      requestAnimationFrame(() => {
        if (!this.destroyed) {
          this.map?.invalidateSize();
        }
      });

      this.refresh(true);
    } catch {
      this.resize?.disconnect();
      this.map?.remove();

      this.map = undefined;
      this.area = undefined;
      this.handle = undefined;
      this.markers = undefined;
      this.me = undefined;

      this.mapError = this.tr(
        'Impossible de démarrer la carte. Réessaie.',
        'تعذر تشغيل الخريطة. حاول مجدداً.',
      );
    }
  }

  reloadBarbers(): void {
    if (this.loading) return;

    this.loading = true;
    this.dataError = '';

    this.api
      .getAllBarbers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.barbers = Array.isArray(data) ? data : [];
          this.loading = false;
          this.refresh();
        },
        error: () => {
          this.loading = false;
          this.dataError = this.tr(
            'Impossible de charger les barbiers. Réessaie.',
            'تعذر تحميل الحلاقين. حاول مجدداً.',
          );
        },
      });
  }

  async loadLand(): Promise<void> {
    if (this.landLoading || this.destroyed) return;

    this.landLoading = true;
    this.landError = '';
    this.abort = new AbortController();

    try {
      const response = await fetch(
        new URL('geo/morocco-land.geojson', document.baseURI),
        {
          signal: this.abort.signal,
        },
      );

      if (!response.ok) {
        throw new Error('Land data');
      }

      const data = await response.json();

      if (
        data.geometry?.type !== 'MultiPolygon' ||
        !data.geometry.coordinates?.length
      ) {
        throw new Error('Land geometry');
      }

      if (this.destroyed) return;

      this.land = data.geometry.coordinates as MultiPolygon;
      this.refresh(true);
    } catch {
      if (!this.destroyed) {
        this.landError = this.tr(
          'Le littoral ne peut pas être chargé. Réessaie.',
          'تعذر تحميل حدود الساحل. حاول مجدداً.',
        );
      }
    } finally {
      this.landLoading = false;
    }
  }

  locate(): void {
    if (this.locating || this.requestLocked) return;

    if (!navigator.geolocation) {
      this.locationError = this.tr(
        'Clique sur la carte pour choisir ton adresse.',
        'اضغط على الخريطة لتحديد عنوانك.',
      );
      return;
    }

    this.locating = true;
    this.locationError = '';

    navigator.geolocation.getCurrentPosition(
      (position) =>
        this.zone.run(() => {
          if (this.destroyed) return;

          this.locating = false;

          this.setPosition(
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            'gps',
          );
        }),
      () =>
        this.zone.run(() => {
          if (this.destroyed) return;

          this.locating = false;

          this.locationError = this.tr(
            'Position indisponible. Clique sur la carte pour la choisir ou réessaie.',
            'الموقع غير متاح. حدده على الخريطة أو حاول مجدداً.',
          );
        }),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  private setPosition(
    position: Position,
    source: 'gps' | 'manual',
  ): void {
    if (this.requestLocked) return;
    if (
      !validPosition(position.lat, position.lng) ||
      !this.land.length
    ) {
      this.locationError = this.tr(
        'Attends le chargement du littoral puis réessaie.',
        'انتظر تحميل الساحل ثم حاول مجدداً.',
      );
      return;
    }

    if (!onLand(position, this.land)) {
      this.locationError = this.tr(
        'Choisis un point sur les terres. Le tracé côtier est indicatif.',
        'اختر نقطة على اليابسة. حدود الساحل تقريبية.',
      );
      return;
    }

    this.center = position;
    this.positionSource = source;
    this.locationError = '';


    this.me?.setLatLng([position.lat, position.lng]);

    this.refresh(true);
  }

  setRadius(value: number, fit = false): void {
    if (this.requestLocked) return;
    this.radiusKm = clampRadius(Number(value));
    this.refresh(fit);
  }

  refresh(fit = false, keepHandle = false): void {
    this.results = this.barbers
      .filter(
        (barber) =>
          barber.homeService === true &&
          validPosition(barber.latitude, barber.longitude),
      )
      .map((barber) => ({
        ...barber,
        latitude: barber.latitude!,
        longitude: barber.longitude!,
        km: distanceKm(this.center, {
          lat: barber.latitude!,
          lng: barber.longitude!,
        }),
      }))
      .filter(
        (barber) =>
          barber.km <= this.radiusKm &&
          onLand(
            {
              lat: barber.latitude,
              lng: barber.longitude,
            },
            this.land,
          ),
      )
      .sort((a, b) => a.km - b.km);

    this.drawZone(fit, keepHandle);

    if (!this.map || !this.markers) return;

    this.markers.clearLayers();

    for (const barber of this.results) {
      const label = document.createElement('span');
      label.textContent = barber.name.slice(0, 1).toUpperCase();

      const tooltip = document.createElement('span');
      tooltip.textContent = barber.shopName || barber.name;

      L.marker([barber.latitude, barber.longitude], {
        icon: L.divIcon({
          className: 'home-barber-pin',
          html: label,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        title: barber.name,
      })
        .bindTooltip(tooltip)
        .addTo(this.markers);
    }
  }

  private drawZone(fit: boolean, keepHandle: boolean): void {
    if (!this.map) return;

    const polygons = this.land.length
      ? landZone(this.center, this.radiusKm, this.land)
      : [];

    this.zoneAvailable = polygons.length > 0;

    const points = polygons.map((polygon) =>
      polygon.map((ring) =>
        ring.map(
          ([lng, lat]): L.LatLngTuple => [lat, lng],
        ),
      ),
    );

    if (this.area) {
      this.area.setLatLngs(points);
    } else {
      this.area = L.polygon(points, {
        color: '#1676ff',
        fillOpacity: 0.12,
        weight: 2,
        interactive: false,
      }).addTo(this.map);
    }

    const position = resizeHandle(this.center, polygons);

    if (position && !keepHandle) {
      const point: L.LatLngTuple = [
        position.lat,
        position.lng,
      ];

      if (this.handle) {
        this.handle.setLatLng(point);
      } else {
        this.handle = L.marker(point, {
          draggable: true,
          autoPan: true,
          icon: L.divIcon({
            className: 'home-radius-pin',
            html: '↔',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
          title: this.tr(
            'Glisse pour changer le rayon',
            'اسحب لتغيير نطاق البحث',
          ),
        }).addTo(this.map);

        this.handle.on('drag', () =>
          this.zone.run(() => {
            if (this.requestLocked) return;
            this.radiusKm = clampRadius(
              distanceKm(
                this.center,
                this.handle!.getLatLng(),
              ),
            );

            this.refresh(false, true);
          }),
        );

        this.handle.on('dragend', () =>
          this.zone.run(() => this.refresh(true)),
        );
      }
    } else if (!position && !keepHandle) {
      this.handle?.remove();
      this.handle = undefined;
    }

    if (fit) {
      this.fitZone();
    }
  }

  fitZone(): void {
    if (this.map && this.area && this.zoneAvailable) {
      this.map.fitBounds(this.area.getBounds(), {
        padding: [40, 40],
        maxZoom: 13,
        animate: false,
      });
    }
  }

  sendRequest(): void {
    const id = this.session.userId();
    if (this.sending || this.requestLocked) return;
    this.sendError = '';
    if (!id || !this.session.isClient()) return;
    if (this.positionSource === 'preview' || !this.zoneAvailable) {
      this.sendError = this.tr('Confirme ta position sur la carte.', 'أكد موقعك على الخريطة.');
      return;
    }
    if (this.loading || this.dataError || this.landLoading || this.landError) {
      this.sendError = this.tr('Attends le chargement ou réessaie.', 'انتظر التحميل أو حاول مجدداً.');
      return;
    }
    const startedAt = Date.now();
    let content: string;
    try {
      content = buildHomeRequest({
        services: [...this.services, this.otherService], price: Number(this.price),
        timing: this.timing, requestedAt: this.requestedAt,
        center: this.center, radiusKm: this.radiusKm,
      }, startedAt);
    } catch {
      this.sendError = this.tr(
        'Choisis une prestation, un prix entre 0,01 et 100 000 DH et, si nécessaire, un horaire futur.',
        'اختر خدمة وسعراً بين 0,01 و100 000 درهم، وموعداً مستقبلياً عند الحاجة.',
      );
      return;
    }
    // A fixed recipient list prevents new arrivals from receiving a request silently.
    const recipients = [...new Map(this.results
      .filter(item => item.id !== id)
      .map(item => [item.id, item])).values()];
    if (!recipients.length) {
      this.sendError = this.tr(
        'Aucun professionnel à domicile dans ce rayon. Élargis la zone.',
        'لا يوجد مهني للخدمة المنزلية في هذا النطاق. وسّع البحث.',
      );
      return;
    }
    this.startedAt = startedAt;
    this.now = startedAt;
    this.trackingOwner = id;
    this.batchContent = content;
    this.deliveries = recipients.map(item => ({
      id: item.id, name: item.shopName || item.name, state: 'pending',
    }));
    this.sending = true;
    this.saveTracking();
    this.startTracking();
    this.handle?.dragging?.disable();
    from(this.deliveries).pipe(
      // Bound concurrency; each success/error is shown separately. No automatic retries.
      takeWhile(() => Date.now() < startedAt + REQUEST_TTL),
      mergeMap(target => (Date.now() >= startedAt + REQUEST_TTL
        ? of<ChatMessage | null>(null) : this.chat.sendMessage(id, target.id, content).pipe(timeout(15000))).pipe(
        map(message => ({ target, messageId: message?.id, state: message ? 'sent' as const : 'failed' as const })),
        catchError(() => of({ target, messageId: undefined, state: 'failed' as const })),
      ), 3),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.sending = false;
        this.deliveries.filter(item => item.state === 'pending').forEach(item => item.state = 'failed');
        this.saveTracking(); this.refreshReplies();
      }),
    ).subscribe(({ target, state, messageId }) => {
      target.state = state;
      target.messageId = messageId;
      this.saveTracking();
      if (state === 'failed') {
        this.sendError = this.tr(
          'Certains envois ne sont pas confirmés. Consulte les discussions avant de contacter ces professionnels à nouveau.',
          'لم يتم تأكيد بعض الإرسالات. تحقق من المحادثات قبل التواصل مجدداً.',
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clock?.unsubscribe();

    this.abort?.abort();

    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }

    this.resize?.disconnect();
    this.map?.remove();
  }
}