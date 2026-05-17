import { Injectable, inject } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { SessionService } from './session.service';
import { signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private sessionService = inject(SessionService);
  private client: Client | null = null;

  notifications = signal<string[]>([]);
  unreadCount = signal(0);

  connect() {
    const userId = this.sessionService.userId();
    console.log('WebSocket connecting with userId:', userId);
    if (!userId || this.client?.active) return;

    const isBarber = this.sessionService.isBarber();
    const isClient = this.sessionService.isClient();

    this.client = new Client({
      webSocketFactory: () => {
        const SockJS = (window as any).SockJS;
        return new SockJS('http://localhost:8080/ws');
      },
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('WebSocket connecté ! userId:', userId, 'isBarber:', isBarber, 'isClient:', isClient);

        if (isBarber) {
          console.log('Subscribing to /topic/barber/' + userId);
          this.client!.subscribe(`/topic/barber/${userId}`, (message) => {
            console.log('Notification reçue barber:', message.body);
            this.addNotification(message.body);
            this.showBrowserNotification(message.body);
          });
        }

        if (isClient) {
          console.log('Subscribing to /topic/client/' + userId);
          this.client!.subscribe(`/topic/client/${userId}`, (message) => {
            console.log('Notification reçue client:', message.body);
            this.addNotification(message.body);
            this.showBrowserNotification(message.body);
          });
        }
      }
    });

    this.client.activate();
  }

  disconnect() {
    this.client?.deactivate();
    this.client = null;
  }

  addNotification(message: string) {
    this.notifications.update(n => [message, ...n].slice(0, 10));
    this.unreadCount.update(c => c + 1);
  }

  clearNotifications() {
    this.notifications.set([]);
    this.unreadCount.set(0);
  }

  showBrowserNotification(message: string) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('CutCut 💈', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('CutCut 💈', { body: message });
          }
        });
      }
    }
  }
}