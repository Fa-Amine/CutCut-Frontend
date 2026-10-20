import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Pair, Ring } from 'polygon-clipping';

export type Position = {
  lat: number;
  lng: number;
};

export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 30;

const EARTH_KM = 6371;

export function clampRadius(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(value)))
    : 10;
}

export function distanceKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;

  const s =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;

  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.min(1, s)));
}

export function circleRing(
  center: Position,
  radiusKm: number,
): Ring {
  const ring: Ring = [];
  const rad = Math.PI / 180;

  const lat = center.lat * rad;
  const lng = center.lng * rad;
  const d = radiusKm / EARTH_KM;

  for (let i = 0; i < 180; i++) {
    const bearing = (i * Math.PI * 2) / 180;

    const y = Math.asin(
      Math.sin(lat) * Math.cos(d) +
        Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
    );

    const x =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(y),
      );

    // GeoJSON utilise [longitude, latitude].
    ring.push([x / rad, y / rad]);
  }

  ring.push([...ring[0]]);

  return ring;
}

export function landZone(
  center: Position,
  radiusKm: number,
  land: MultiPolygon,
): MultiPolygon {
  return polygonClipping.intersection(
    [circleRing(center, radiusKm)],
    land,
  );
}

function insideRing(point: Pair, ring: Ring): boolean {
  let inside = false;
  const [x, y] = point;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

export function onLand(
  position: Position,
  land: MultiPolygon,
): boolean {
  const point: Pair = [position.lng, position.lat];

  return land.some(
    (polygon) =>
      insideRing(point, polygon[0]) &&
      !polygon.slice(1).some((hole) => insideRing(point, hole)),
  );
}

export function resizeHandle(
  center: Position,
  zone: MultiPolygon,
): Position | null {
  let best: Position | null = null;
  let farthest = -1;

  for (const polygon of zone) {
    for (const [lng, lat] of polygon[0]) {
      const candidate: Position = { lat, lng };
      const distance = distanceKm(center, candidate);

      if (distance > farthest + 0.001) {
        farthest = distance;
        best = candidate;
      }
    }
  }

  return best;
}

export function validPosition(
  lat: unknown,
  lng: unknown,
): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
  );
}

export function requestMessage(
  service: string,
  price: number,
  address: string,
  position: Position,
): string {
  if (
    !service.trim() ||
    !address.trim() ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 100000 ||
    !validPosition(position.lat, position.lng)
  ) {
    throw new Error('Invalid home request');
  }

  return [
    'Demande de service à domicile / طلب خدمة منزلية',
    `Service : ${service.trim()}`,
    `Prix proposé : ${price.toFixed(2)} MAD (à confirmer ensemble)`,
    `Adresse : ${address.trim()}`,
    `Position : https://www.google.com/maps?q=${position.lat.toFixed(6)},${position.lng.toFixed(6)}`,
    'Merci de confirmer le prix, la date et votre disponibilité avant tout déplacement.',
  ].join('\n');
}