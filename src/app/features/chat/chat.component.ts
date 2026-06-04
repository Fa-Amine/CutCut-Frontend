import { Component, inject, signal, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { SessionService } from '../../core/services/session.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { BarberService } from '../../core/services/barber.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  private route = inject(ActivatedRoute);
  private chatService = inject(ChatService);
  private barberService = inject(BarberService);
  sessionService = inject(SessionService);
  private wsService = inject(WebSocketService);

  messages = signal<ChatMessage[]>([]);
  newMessage = signal('');
  isLoading = signal(true);
  isSending = signal(false);
  partnerName = signal('');
  partnerId = signal<number>(0);
  private wsSubscription: any = null;

  ngOnInit() {
    const partnerId = Number(this.route.snapshot.paramMap.get('id'));
    this.partnerId.set(partnerId);
    this.loadPartnerInfo(partnerId);
    this.loadMessages(partnerId);
    this.subscribeToWebSocket(partnerId);
  }

  loadPartnerInfo(partnerId: number) {
    this.barberService.getBarberById(partnerId).subscribe({
      next: (barber) => this.partnerName.set(barber.name),
      error: () => this.partnerName.set('Utilisateur')
    });
  }

  loadMessages(partnerId: number) {
    const myId = this.sessionService.userId();
    if (!myId) return;
    this.isLoading.set(true);
    this.chatService.getConversation(myId, partnerId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.isLoading.set(false);
        this.chatService.markAsRead(myId, partnerId).subscribe();
      },
      error: () => this.isLoading.set(false)
    });
  }

  subscribeToWebSocket(partnerId: number) {
    const myId = this.sessionService.userId();
    if (!myId) return;
    const client = (this.wsService as any).client;
    if (client?.active) {
      this.wsSubscription = client.subscribe(`/topic/chat/${myId}`, (msg: any) => {
        const parts = msg.body.split('|');
        const senderId = parseInt(parts[0]);
        if (senderId === partnerId) {
          this.loadMessages(partnerId);
        }
      });
    }
  }

  sendMessage() {
    const content = this.newMessage().trim();
    const myId = this.sessionService.userId();
    const partnerId = this.partnerId();
    if (!content || !myId) return;

    this.isSending.set(true);
    this.chatService.sendMessage(myId, partnerId, content).subscribe({
      next: (msg) => {
        this.messages.update(msgs => [...msgs, msg]);
        this.newMessage.set('');
        this.isSending.set(false);
      },
      error: () => this.isSending.set(false)
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.sender.id === this.sessionService.userId();
  }

  formatTime(dateTime: string): string {
    return new Date(dateTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDate(dateTime: string): string {
    return new Date(dateTime).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short'
    });
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
  }
}