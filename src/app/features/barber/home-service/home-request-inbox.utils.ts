import { ChatMessage } from '../../../core/services/chat.service';

export interface HomeInboxRequest {
  id: number;
  clientId: number;
  clientName: string;
  content: string;
  sentAt: string;
  read: boolean;
}

const HEADERS = [
  'Demande de prestation à domicile — CutCut',
  'Demande de service à domicile / طلب خدمة منزلية',
];

/** Classify existing Messages; this is not an authoritative booking status. */
export function homeInboxRequests(messages: ChatMessage[], ownerId: number, now = Date.now()): HomeInboxRequest[] {
  const unique = new Map<number, HomeInboxRequest>();
  for (const message of messages) {
    if (message.receiver?.id !== ownerId || message.sender?.id === ownerId ||
        !Number.isSafeInteger(message.id) || message.id <= 0 ||
        !Number.isSafeInteger(message.sender?.id) || message.sender.id <= 0 ||
        typeof message.content !== 'string' ||
        !HEADERS.includes(message.content.trim().split(/\r?\n/)[0])) continue;
    const expiry = message.content.match(/^Expiration de la demande \(UTC\) : (.+)$/m);
    if (expiry) {
      const deadline = Date.parse(expiry[1]);
      const replied = messages.some(reply => reply.sender?.id === ownerId &&
        reply.receiver?.id === message.sender.id && reply.id > message.id &&
        Date.parse(reply.sentAt) >= Date.parse(message.sentAt) && Date.parse(reply.sentAt) < deadline);
      if (!Number.isFinite(deadline) || (deadline <= now && !replied)) continue;
    }
    unique.set(message.id, {
      id: message.id, clientId: message.sender.id,
      clientName: message.sender.name || 'Client', content: message.content,
      sentAt: message.sentAt, read: message.read === true,
    });
  }
  return [...unique.values()].sort((a, b) => {
    const dateA = Date.parse(a.sentAt) || 0;
    const dateB = Date.parse(b.sentAt) || 0;
    return dateB - dateA || b.id - a.id;
  });
}

export function hasHomePosition(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
