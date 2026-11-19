export interface HomeRequestDraft {
  services: string[];
  price: number;
  timing: 'now' | 'scheduled';
  requestedAt: string;
  center: { lat: number; lng: number };
  radiusKm: number;
}

/** A proposal sent to Messages, not a confirmed booking or availability check. */
export function buildHomeRequest(draft: HomeRequestDraft, now = Date.now()): string {
  const services = [...new Set(draft.services.map(item => item.trim().replace(/\s+/g, ' ')).filter(Boolean))];
  if (!services.length || services.join(', ').length > 300 ||
      !Number.isFinite(draft.price) || draft.price < 0.01 || draft.price > 100000 ||
      !Number.isFinite(draft.center.lat) || Math.abs(draft.center.lat) > 90 ||
      !Number.isFinite(draft.center.lng) || Math.abs(draft.center.lng) > 180 ||
      !Number.isFinite(draft.radiusKm) || draft.radiusKm < 1 || draft.radiusKm > 30) {
    throw new Error('Invalid request');
  }
  let time: string;
  if (draft.timing === 'now') {
    time = 'Dès que possible, à confirmer avec vous';
  } else if (draft.timing === 'scheduled') {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.requestedAt)) throw new Error('Invalid date');
    // datetime-local is entered in the customer's device timezone.
    const date = new Date(draft.requestedAt);
    const [day, clock] = draft.requestedAt.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [h, minute] = clock.split(':').map(Number);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= now ||
        date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d ||
        date.getHours() !== h || date.getMinutes() !== minute) throw new Error('Invalid date');
    time = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Casablanca',
    }).format(date) + ' (heure du Maroc)';
  } else {
    throw new Error('Invalid timing');
  }
  // Do not broadcast the exact home location to every professional in the area.
  const area = `${draft.center.lat.toFixed(2)},${draft.center.lng.toFixed(2)}`;
  return [
    'Demande de prestation à domicile — CutCut',
    `Prestations : ${services.join(', ')}`,
    `Prix total proposé : ${draft.price.toFixed(2)} MAD`,
    `Horaire souhaité : ${time}`,
    `Rayon de recherche : ${draft.radiusKm} km`,
    `Secteur approximatif (point arrondi, pas l’adresse exacte) : https://www.google.com/maps?q=${area}`,
    'Pouvez-vous assurer ces prestations à cet horaire et à ce prix ?',
    'Merci de confirmer votre disponibilité et le prix total, déplacement compris, dans cette discussion.',
    'L’adresse exacte sera communiquée après accord. Ce message ne confirme pas de réservation.',
  ].join('\n');
}
