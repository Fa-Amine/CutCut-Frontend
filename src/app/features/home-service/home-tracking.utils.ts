import { ChatMessage } from '../../core/services/chat.service';

export const REQUEST_TTL = 6 * 60 * 1000;
export interface RequestDelivery {
  id: number;
  name: string;
  state: 'pending' | 'sent' | 'failed';
  messageId?: number;
  replied?: boolean;
}
export function remainingSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.min(360, Math.ceil((startedAt + REQUEST_TTL - now) / 1000)));
}
// A reply is a message, never an acceptance or booking confirmation.
export function hasTimelyReply(messages: ChatMessage[], clientId: number,
  delivery: RequestDelivery, startedAt: number): boolean {
  return messages.some(message => message.sender?.id === delivery.id &&
    message.receiver?.id === clientId &&
    Number.isSafeInteger(delivery.messageId) && message.id > delivery.messageId! &&
    Date.parse(message.sentAt) >= startedAt &&
    Date.parse(message.sentAt) < startedAt + REQUEST_TTL);
}
