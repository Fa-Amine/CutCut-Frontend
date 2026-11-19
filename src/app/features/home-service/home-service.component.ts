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
import { from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap } from 'rxjs/operators';
import { buildHomeRequest } from './home-request.utils';
import type { MultiPolygon } from 'polygon-clipping';

import { BarberService } from '../../core/services/barber.service';
import { BarberListItem } from '../../core/models/barber.models';
import { ChatService } from '../../core/services/chat.service';
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
  styleUrl: './home-service.component.css',
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
  deliveries: { id: number; name: string; state: 'pending' | 'sent' | 'failed' }[] = [];
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
    if (this.sending) return;
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
    let content: string;
    try {
      content = buildHomeRequest({
        services: [...this.services, this.otherService], price: Number(this.price),
        timing: this.timing, requestedAt: this.requestedAt,
        center: this.center, radiusKm: this.radiusKm,
      });
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
    this.batchContent = content;
    this.deliveries = recipients.map(item => ({
      id: item.id, name: item.shopName || item.name, state: 'pending',
    }));
    this.sending = true;
    this.handle?.dragging?.disable();
    from(this.deliveries).pipe(
      // Bound concurrency; each success/error is shown separately. No automatic retries.
      mergeMap(target => this.chat.sendMessage(id, target.id, content).pipe(
        map(() => ({ target, state: 'sent' as const })),
        catchError(() => of({ target, state: 'failed' as const })),
      ), 3),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.sending = false; }),
    ).subscribe(({ target, state }) => {
      target.state = state;
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

    this.abort?.abort();

    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }

    this.resize?.disconnect();
    this.map?.remove();
  }
}