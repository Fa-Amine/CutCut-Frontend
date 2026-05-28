import { Injectable, inject } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { SessionService } from './session.service';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private sessionService = inject(SessionService);
  private client: Client | null = null;
  private audioContext: AudioContext | null = null;

  notifications = signal<string[]>([]);
  unreadCount = signal(0);

  connect() {
    const userId = this.sessionService.userId();
    if (!userId || this.client?.active) return;

    const isBarber = this.sessionService.isBarber();
    const isClient = this.sessionService.isClient();

    const wsUrl = environment.apiBaseUrl.replace('/api', '/ws');

    this.client = new Client({
      webSocketFactory: () => {
        const SockJS = (window as any).SockJS;
        return new SockJS(wsUrl);
      },
      reconnectDelay: 5000,
      onConnect: () => {
        if (isBarber) {
          this.client!.subscribe(`/topic/barber/${userId}`, (message) => {
            this.addNotification(message.body);
            this.showBrowserNotification(message.body);
            this.playNotificationSound('barber');
          });
        }
        if (isClient) {
          this.client!.subscribe(`/topic/client/${userId}`, (message) => {
            this.addNotification(message.body);
            this.showBrowserNotification(message.body);
            this.playNotificationSound('client');
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

  playNotificationSound(type: 'barber' | 'client') {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const ctx = this.audioContext;

      if (type === 'barber') {
        // Son pour barbier — nouvelle réservation (2 bips montants)
        this.playTone(ctx, 440, 0.0, 0.15);
        this.playTone(ctx, 660, 0.2, 0.15);
      } else {
        // Son pour client — confirmation/refus (3 bips)
        this.playTone(ctx, 523, 0.0, 0.1);
        this.playTone(ctx, 659, 0.15, 0.1);
        this.playTone(ctx, 784, 0.3, 0.2);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  }

  private playTone(ctx: AudioContext, frequency: number, startTime: number, duration: number) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

    oscillator.start(ctx.currentTime + startTime);
    oscillator.stop(ctx.currentTime + startTime + duration);
  }

  showBrowserNotification(message: string) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('CutCut ✂️', {
          body: message,
          icon: '/assets/images/logo.png'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('CutCut ✂️', {
              body: message,
              icon: '/assets/images/logo.png'
            });
          }
        });
      }
    }
  }
}